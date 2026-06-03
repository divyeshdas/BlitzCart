import client from 'prom-client';

client.collectDefaultMetrics({ prefix: 'blitzcart_' });

export const buyRequestsTotal = new client.Counter({
  name: 'buy_requests_total',
  help: 'Total buy requests by result',
  labelNames: ['result'] as const,
});

export const buyLatencyMs = new client.Histogram({
  name: 'buy_latency_ms',
  help: 'Buy endpoint latency in milliseconds',
  buckets: [5, 10, 25, 50, 100, 250],
});

export const queueDepthGauge = new client.Gauge({
  name: 'queue_depth',
  help: 'Current BullMQ order queue depth',
});

export const inventoryGauge = new client.Gauge({
  name: 'inventory_remaining',
  help: 'Remaining inventory per sale',
  labelNames: ['sale_id', 'product_id'] as const,
});

export const wsClientsGauge = new client.Gauge({
  name: 'ws_connected_clients',
  help: 'Currently connected WebSocket clients per sale',
  labelNames: ['sale_id'] as const,
});

export const registry = client.register;
