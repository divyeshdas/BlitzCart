import type { Request, Response, NextFunction } from 'express';
import { verifyAccess } from '../lib/jwt.js';
import type { JwtPayload } from '../lib/jwt.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header', code: 'UNAUTHORIZED', requestId: req.id });
    return;
  }

  try {
    req.user = verifyAccess(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED', requestId: req.id });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN', requestId: req.id });
      return;
    }
    next();
  });
}
