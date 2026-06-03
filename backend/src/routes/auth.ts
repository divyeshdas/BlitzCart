import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import { signAccess, signRefresh, verifyRefresh } from '../lib/jwt.js';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', async (req, res) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR', requestId: req.id, details: result.error.flatten() });
    return;
  }

  const { email, password } = result.data;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: 'Email already registered', code: 'CONFLICT', requestId: req.id });
    return;
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const [user] = await db.insert(users).values({ email, passwordHash }).returning({ id: users.id, email: users.email, role: users.role });

  if (!user) {
    res.status(500).json({ error: 'Failed to create user', code: 'INTERNAL_ERROR', requestId: req.id });
    return;
  }

  const tokenPayload = { sub: user.id, email: user.email, role: user.role };
  logger.info({ userId: user.id }, 'user registered');

  res.status(201).json({
    accessToken: signAccess(tokenPayload),
    refreshToken: signRefresh(tokenPayload),
    user: { id: user.id, email: user.email, role: user.role },
  });
});

router.post('/login', async (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR', requestId: req.id });
    return;
  }

  const { email, password } = result.data;

  const [user] = await db
    .select({ id: users.id, email: users.email, passwordHash: users.passwordHash, role: users.role })
    .from(users)
    .where(eq(users.email, email));

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid credentials', code: 'UNAUTHORIZED', requestId: req.id });
    return;
  }

  const tokenPayload = { sub: user.id, email: user.email, role: user.role };
  logger.info({ userId: user.id }, 'user logged in');

  res.json({
    accessToken: signAccess(tokenPayload),
    refreshToken: signRefresh(tokenPayload),
    user: { id: user.id, email: user.email, role: user.role },
  });
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required', code: 'VALIDATION_ERROR', requestId: req.id });
    return;
  }

  try {
    const payload = verifyRefresh(refreshToken);
    const tokenPayload = { sub: payload.sub, email: payload.email, role: payload.role };
    res.json({ accessToken: signAccess(tokenPayload) });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token', code: 'UNAUTHORIZED', requestId: req.id });
  }
});

export default router;
