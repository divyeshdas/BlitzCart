import jwt from 'jsonwebtoken';
import { env } from './env.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'user' | 'admin';
  type: 'access' | 'refresh';
}

export function signAccess(payload: Omit<JwtPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'access' }, env.JWT_SECRET, { expiresIn: '15m' });
}

export function signRefresh(payload: Omit<JwtPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccess(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export function verifyRefresh(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}
