import express from 'express';
import pinoHttp from 'pino-http';
import { logger } from './lib/logger.js';
import { requestId } from './middleware/request-id.js';
import authRouter from './routes/auth.js';
import healthRouter from './routes/health.js';
import { env } from './lib/env.js';

export function createApp(): express.Application {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => req.id as string }));

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', env.CORS_ORIGIN);
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Request-Id');
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, 'unhandled error');
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  });

  return app;
}
