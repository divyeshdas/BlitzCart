import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const messagesReceived = new Counter('ws_messages_received');
const broadcastLag = new Trend('ws_broadcast_lag_ms', true);
const missedBroadcasts = new Counter('ws_missed_broadcasts');

const BASE_URL = __ENV['BASE_URL'] || 'http://localhost:3000';
const BASE_WS = __ENV['BASE_WS'] || 'ws://localhost:3000';
const SALE_ID = __ENV['SALE_ID'] || '';
const PRODUCT_ID = __ENV['PRODUCT_ID'] || '';

export const options = {
  scenarios: {
    ws_listeners: {
      executor: 'constant-vus',
      vus: 500,
      duration: '60s',
    },
  },
  thresholds: {
    // p95 broadcast lag must be under 100ms
    ws_broadcast_lag_ms: ['p(95)<100'],
    // Very low missed broadcast rate
    ws_missed_broadcasts: ['count<5'],
  },
};

export function setup() {
  const reg = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email: `ws-test-${Date.now()}@test.invalid`, password: 'wstest_pass_123' }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (reg.status !== 201) return { token: null };
  const body = JSON.parse(reg.body);
  return { token: body.accessToken };
}

export default function (data) {
  if (!SALE_ID) {
    console.error('Set SALE_ID env var');
    return;
  }

  // Each VU connects via WebSocket and waits for broadcasts
  const url = `${BASE_WS}/ws?saleId=${SALE_ID}`;

  const res = ws.connect(url, {}, function (socket) {
    let connected = false;

    socket.on('open', () => {
      connected = true;
    });

    socket.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'inventory-update') {
          messagesReceived.add(1);
          const lag = Date.now() - msg.ts;
          broadcastLag.add(lag);

          check(msg, {
            'broadcast lag under 100ms': (m) => Date.now() - m.ts < 100,
          });
        }
      } catch {
        // ignore
      }
    });

    socket.on('error', () => {
      missedBroadcasts.add(1);
    });

    socket.on('close', () => {
      connected = false;
    });

    // Hold connection open for test duration
    socket.setTimeout(() => {
      socket.close();
    }, 55000);
  });

  check(res, { 'ws connected': (r) => r && r.status === 101 });
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    scenarios: '500 concurrent WS connections, 60s duration',
    metrics: {
      messages_received: data.metrics.ws_messages_received?.values?.count,
      broadcast_lag_p50: data.metrics.ws_broadcast_lag_ms?.values?.['p(50)'],
      broadcast_lag_p95: data.metrics.ws_broadcast_lag_ms?.values?.['p(95)'],
      broadcast_lag_p99: data.metrics.ws_broadcast_lag_ms?.values?.['p(99)'],
      missed_broadcasts: data.metrics.ws_missed_broadcasts?.values?.count,
    },
    thresholds_passed: !Object.values(data.metrics).some(
      (m) => m && typeof m === 'object' && 'thresholds' in m &&
        Object.values(m.thresholds ?? {}).some((t) => !t.ok),
    ),
  };

  return {
    'load-tests/results/phase4-ws-results.txt': JSON.stringify(summary, null, 2),
    stdout: `
=== k6 WS BROADCAST RESULTS ===
messages received: ${summary.metrics.messages_received ?? 0}
p50 lag: ${summary.metrics.broadcast_lag_p50?.toFixed(2) ?? 'n/a'}ms
p95 lag: ${summary.metrics.broadcast_lag_p95?.toFixed(2) ?? 'n/a'}ms
p99 lag: ${summary.metrics.broadcast_lag_p99?.toFixed(2) ?? 'n/a'}ms
missed: ${summary.metrics.missed_broadcasts ?? 0}
thresholds passed: ${summary.thresholds_passed}
================================
`,
  };
}
