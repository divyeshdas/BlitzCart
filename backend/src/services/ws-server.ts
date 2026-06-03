import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import { URL } from 'url';
import { redisSub } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

// saleId → set of connected clients watching that sale
const rooms = new Map<string, Set<WebSocket>>();

// Track pong receipts for heartbeat
const alive = new WeakMap<WebSocket, boolean>();

export type InventoryUpdateMessage = {
  type: 'inventory-update';
  saleId: string;
  productId: string;
  remaining: number;
  ts: number;
};

export type ConnectedCountMessage = {
  type: 'connected-count';
  saleId: string;
  count: number;
};

type OutboundMessage = InventoryUpdateMessage | ConnectedCountMessage;

function broadcast(saleId: string, msg: OutboundMessage): void {
  const clients = rooms.get(saleId);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function broadcastCount(saleId: string): void {
  broadcast(saleId, {
    type: 'connected-count',
    saleId,
    count: rooms.get(saleId)?.size ?? 0,
  });
}

function addClient(saleId: string, ws: WebSocket): void {
  if (!rooms.has(saleId)) rooms.set(saleId, new Set());
  rooms.get(saleId)!.add(ws);
  alive.set(ws, true);
  broadcastCount(saleId);
  logger.debug({ saleId, total: rooms.get(saleId)!.size }, 'ws client joined');
}

function removeClient(saleId: string, ws: WebSocket): void {
  const room = rooms.get(saleId);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) rooms.delete(saleId);
  broadcastCount(saleId);
  logger.debug({ saleId, total: room.size }, 'ws client left');
}

export function attachWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const saleId = url.searchParams.get('saleId') ?? '';

    if (!saleId) {
      ws.close(1008, 'saleId required');
      return;
    }

    addClient(saleId, ws);

    ws.on('pong', () => alive.set(ws, true));

    ws.on('close', () => removeClient(saleId, ws));

    ws.on('error', (err) => {
      logger.warn({ err: err.message, saleId }, 'ws client error');
      removeClient(saleId, ws);
    });
  });

  // Heartbeat: ping every 30s, drop clients that miss a pong
  const heartbeat = setInterval(() => {
    for (const [saleId, clients] of rooms) {
      for (const ws of clients) {
        if (alive.get(ws) === false) {
          ws.terminate();
          removeClient(saleId, ws);
          continue;
        }
        alive.set(ws, false);
        ws.ping();
      }
    }
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  // Redis pattern subscriber — receives all inventory-update:* channels
  void redisSub.psubscribe('inventory-update:*', (err) => {
    if (err) logger.error({ err }, 'psubscribe failed');
    else logger.info('subscribed to inventory-update:* pattern');
  });

  redisSub.on('pmessage', (_pattern: string, channel: string, message: string) => {
    try {
      const saleId = channel.replace('inventory-update:', '');
      const data = JSON.parse(message) as { productId: string; remaining: number; ts: number };

      broadcast(saleId, {
        type: 'inventory-update',
        saleId,
        productId: data.productId,
        remaining: data.remaining,
        ts: data.ts,
      });
    } catch (err) {
      logger.warn({ err, channel }, 'failed to parse inventory update');
    }
  });

  logger.info('websocket server attached');
  return wss;
}

export function getRoomSize(saleId: string): number {
  return rooms.get(saleId)?.size ?? 0;
}

export function getAllRoomSizes(): Map<string, number> {
  const out = new Map<string, number>();
  for (const [saleId, clients] of rooms) out.set(saleId, clients.size);
  return out;
}
