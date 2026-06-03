import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const oversells = new Counter('oversells');
const accepted = new Counter('accepted_buys');
const soldOuts = new Counter('sold_out_responses');
const buyDuration = new Trend('buy_duration_ms', true);

// Configurable via env: BASE_URL, SALE_ID, PRODUCT_ID
const BASE_URL = __ENV['BASE_URL'] || 'http://localhost:3000';
const SALE_ID = __ENV['SALE_ID'] || '';
const PRODUCT_ID = __ENV['PRODUCT_ID'] || '';

export const options = {
  scenarios: {
    buy_flood: {
      executor: 'shared-iterations',
      vus: 10000,
      iterations: 10000,
      maxDuration: '60s',
    },
  },
  thresholds: {
    // p99 must be under 150ms
    http_req_duration: ['p(99)<150'],
    // p95 under 50ms on the Redis path
    'http_req_duration{expected_response:true}': ['p(95)<50'],
    // No 5xx errors
    http_req_failed: ['rate<0.001'],
    oversells: ['count==0'],
  },
};

export function setup() {
  // Register a test user and get a token
  const reg = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email: `flood-${Date.now()}@test.invalid`, password: 'loadtest_pass_123' }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (reg.status !== 201) {
    console.error(`Setup failed: ${reg.body}`);
    return { token: null };
  }

  const body = JSON.parse(reg.body);
  return { token: body.accessToken };
}

export default function (data) {
  if (!SALE_ID || !PRODUCT_ID) {
    console.error('Set BASE_URL, SALE_ID, PRODUCT_ID env vars before running');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
  };

  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/sales/${SALE_ID}/buy`,
    JSON.stringify({ productId: PRODUCT_ID }),
    { headers, tags: { expected_response: 'true' } },
  );
  buyDuration.add(Date.now() - start);

  // 202 = accepted, 410 = sold out — both are correct
  // Anything else is a failure
  const ok = check(res, {
    'status is 202 or 410': (r) => r.status === 202 || r.status === 410,
    'no server error': (r) => r.status < 500,
  });

  if (res.status === 202) accepted.add(1);
  if (res.status === 410) soldOuts.add(1);

  // 5xx means an inventory operation failed — potential oversell
  if (res.status >= 500) oversells.add(1);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    scenarios: '10,000 VUs x 1 iteration',
    metrics: {
      http_req_duration_p50: data.metrics.http_req_duration?.values?.['p(50)'],
      http_req_duration_p95: data.metrics.http_req_duration?.values?.['p(95)'],
      http_req_duration_p99: data.metrics.http_req_duration?.values?.['p(99)'],
      throughput_rps: data.metrics.http_reqs?.values?.rate,
      accepted_buys: data.metrics.accepted_buys?.values?.count,
      sold_out_responses: data.metrics.sold_out_responses?.values?.count,
      oversells: data.metrics.oversells?.values?.count,
      http_req_failed_rate: data.metrics.http_req_failed?.values?.rate,
    },
    thresholds_passed: !Object.values(data.metrics).some(
      (m) => m && typeof m === 'object' && 'thresholds' in m &&
        Object.values(m.thresholds ?? {}).some((t) => !t.ok),
    ),
  };

  return {
    'load-tests/results/phase3-results.txt': JSON.stringify(summary, null, 2),
    stdout: `
=== k6 BUY FLOOD RESULTS ===
p50: ${summary.metrics.http_req_duration_p50?.toFixed(2)}ms
p95: ${summary.metrics.http_req_duration_p95?.toFixed(2)}ms
p99: ${summary.metrics.http_req_duration_p99?.toFixed(2)}ms
throughput: ${summary.metrics.throughput_rps?.toFixed(0)} req/s
accepted buys: ${summary.metrics.accepted_buys ?? 0}
sold out: ${summary.metrics.sold_out_responses ?? 0}
oversells: ${summary.metrics.oversells ?? 0}
thresholds passed: ${summary.thresholds_passed}
============================
`,
  };
}
