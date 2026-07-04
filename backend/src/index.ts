import http from 'http';
import { createApp } from './app.js';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { connectRedis, closeRedis } from './lib/redis.js';
import { closeDb } from './db/index.js';
import { startScheduler } from './services/scheduler.js';
import { loadLuaScripts } from './services/lua-scripts.js';
import { startOrderWorker } from './workers/order.worker.js';
import { attachWebSocketServer, getAllRoomSizes } from './services/ws-server.js';
import { wsClientsGauge } from './lib/metrics.js';

async function main(): Promise<void> {
  // Start listening first so the health check responds immediately, before
  // the slower Redis/Lua/worker setup runs.
  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'server listening');
  });

  await connectRedis();
  logger.info('redis connected');

  await loadLuaScripts();

  const wss = attachWebSocketServer(server);
  const schedulerTask = startScheduler();
  const orderWorker = startOrderWorker();

  setInterval(() => {
    for (const [saleId, count] of getAllRoomSizes()) {
      wsClientsGauge.set({ sale_id: saleId }, count);
    }
  }, 5000);

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'shutdown signal received');
    schedulerTask.stop();
    wss.close();
    server.close(async () => {
      await orderWorker.close();
      await closeRedis();
      await closeDb();
      logger.info('graceful shutdown complete');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'startup failed');
  process.exit(1);
});
