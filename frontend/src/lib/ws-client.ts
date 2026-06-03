import { writable } from 'svelte/store';
import { PUBLIC_WS_URL } from '$env/static/public';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

const BASE_WS = PUBLIC_WS_URL ?? 'ws://localhost:3000';

export type WsMessage =
  | { type: 'inventory-update'; saleId: string; productId: string; remaining: number; ts: number }
  | { type: 'connected-count'; saleId: string; count: number };

type MessageHandler = (msg: WsMessage) => void;

export function createSaleSocket(saleId: string, onMessage: MessageHandler) {
  const status = writable<WsStatus>('connecting');
  const connectedCount = writable<number>(0);

  let ws: WebSocket | null = null;
  let destroyed = false;
  let retryDelay = 1000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (destroyed) return;
    status.set('connecting');

    ws = new WebSocket(`${BASE_WS}/ws?saleId=${saleId}`);

    ws.onopen = () => {
      retryDelay = 1000;
      status.set('connected');
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        if (msg.type === 'connected-count') {
          connectedCount.set(msg.count);
        } else {
          onMessage(msg);
        }
      } catch {
        // malformed frame — ignore
      }
    };

    ws.onclose = () => {
      if (destroyed) return;
      status.set('disconnected');
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  function scheduleReconnect() {
    if (destroyed) return;
    retryTimer = setTimeout(() => {
      retryDelay = Math.min(retryDelay * 2, 30_000);
      connect();
    }, retryDelay);
  }

  connect();

  return {
    status,
    connectedCount,
    destroy() {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    },
  };
}
