import http from 'http';
import { createApp } from './app.js';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { connectRedis, closeRedis } from './lib/redis.js';
import { closeDb } from './db/index.js';
import { startScheduler } from './services/scheduler.js';

async function main(): Promise<void> {
  await connectRedis();
  logger.info('redis connected');

  const app = createApp();
  const server = http.createServer(app);
  const schedulerTask = startScheduler();

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'server listening');
  });

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'shutdown signal received');
    schedulerTask.stop();
    server.close(async () => {
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
