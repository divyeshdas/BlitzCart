import { Router } from 'express';
import { registry } from '../lib/metrics.js';

const router = Router();

router.get('/', async (_req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});

export default router;
