# ⚡ BlitzCart

**A high-performance flash sale engine built to handle 10,000 simultaneous buyers competing for 100 items — with zero oversells, guaranteed.**

Live demo: [blitzcart-app.vercel.app](https://blitzcart-app.vercel.app)  
Backend API: [blitzcart-production.up.railway.app](https://blitzcart-production.up.railway.app/health)

---

## The Problem This Solves

Flash sales are a concurrency nightmare. The moment a limited-stock item goes live, thousands of users hammer the buy endpoint at the same millisecond. A naive implementation — `SELECT stock`, check if > 0, then `UPDATE stock = stock - 1` — will let multiple requests read the same stock value simultaneously, pass the check, and both write. You end up selling items you don't have.

BlitzCart solves this at the infrastructure level using a **Redis Lua script** that makes the read-check-decrement operation atomic. No two requests can ever interleave. Oversell rate: exactly 0.

```lua
-- Runs atomically on Redis — nothing can execute between these lines
local stock = redis.call('GET', KEYS[1])
if tonumber(stock) < 1 then return -1 end   -- sold out
return redis.call('DECRBY', KEYS[1], 1)     -- yours
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | SvelteKit 5 + TypeScript + Tailwind CSS v4 |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL via Drizzle ORM |
| Cache / Atomic ops | Redis (Lua scripts, Pub/Sub, token bucket) |
| Job queue | BullMQ |
| Real-time | WebSockets + Redis Pub/Sub |
| Monitoring | Prometheus + Grafana |
| Containerisation | Docker Compose |
| Load testing | k6 |
| Backend hosting | Railway |
| Frontend hosting | Vercel |

---

## Architecture

```
Browser ──── SvelteKit (Vercel)
                │
                │ REST + WebSocket (wss://)
                ▼
         Express API (Railway)
         ┌──────────────────────────────┐
         │  /auth  /sales  /orders      │
         │  /admin  /metrics  /ws       │
         └──────┬───────────────────────┘
                │
        ┌───────┼──────────┐
        ▼       ▼          ▼
      Redis  Postgres   BullMQ
     Lua +   Drizzle   (order
    PubSub    ORM)      worker)
        │
        └─── Redis Pub/Sub ──▶ WebSocket ──▶ All browsers
```

**Buy request lifecycle (full path, ~10ms end to end):**

1. **JWT auth** — 401 if missing or expired
2. **Rate limiter** — Redis token bucket, 5 buys per user per 10 seconds. Returns 429 + `Retry-After` if blocked
3. **Atomic decrement** — Lua script on Redis. If stock = 0, returns 410 Sold Out. If stock ≥ 1, decrements and returns remaining
4. **Order created** — Pending order inserted in Postgres, job pushed to BullMQ queue
5. **202 Accepted** — Response sent immediately. No waiting for DB confirmation
6. **Pub/Sub broadcast** — Redis publishes `inventory-update:{saleId}`. WebSocket server broadcasts new stock count to every connected browser tab in < 100ms
7. **Worker confirms** — 10 concurrent BullMQ workers process the queue, update orders to `confirmed` in Postgres

---

## Performance Targets

| Metric | Target |
|---|---|
| Concurrent users | 10,000 simultaneous buy requests |
| Oversell rate | **0** — enforced by Lua atomicity |
| Buy endpoint p95 latency | < 50ms |
| Buy endpoint p99 latency | < 120ms |
| Throughput | ≥ 5,000 req/s sustained |
| WebSocket broadcast lag | < 100ms from buy → all clients updated |
| Queue drain time | < 2s for all orders after sale ends |
| Rate limit | 5 buy attempts / user / 10 seconds |

---

## Features

- **Flash sale management** — Admin dashboard to create sales with multiple products, set start/end times, and seed inventory into Redis instantly
- **Live inventory** — Every browser watching a sale sees the stock counter drop in real time via WebSocket. No polling
- **Atomic buying** — Redis Lua EVALSHA on every buy request. SHA loaded at startup, never re-parsed
- **Token bucket rate limiting** — Per-user, Redis-native, same Lua pattern as the buy script
- **BullMQ job queue** — Buy responses never wait for Postgres. Workers confirm orders asynchronously with retry and exponential backoff
- **Inventory restore on failure** — If a worker exhausts retries, inventory is incremented back. No silent loss
- **Grafana dashboard** — 7 panels: buy req/s by result, p50/p95/p99 latency, queue depth, live inventory per sale, rate limited req/s, WebSocket client count
- **Dark / light mode** — Persisted to localStorage, system preference detection on first load
- **Responsive UI** — Mobile-first, glass-blur navbar, gradient sale cards, animated stock progress bars, urgency indicators

---

## Why Redis Lua over other approaches?

**Naive SQL transaction:** Works for low traffic. At 10,000 concurrent requests, Postgres row-level locks create a queue under the hood — latency climbs, throughput drops.

**Redis `WATCH`/`MULTI`/`EXEC` (optimistic lock):** Under heavy contention, most transactions fail and retry. With 10,000 VUs hitting one key, nearly all retry multiple times. Throughput collapses.

**Redlock (distributed mutex):** Adds a full roundtrip to acquire a lock before every buy. Latency doubles. Requires multiple Redis nodes. Clock drift creates edge cases. Complete overkill for a counter.

**Lua script via `EVALSHA`:** Redis executes the script atomically — the scheduler cannot preempt it, no command can interleave. One network roundtrip. Zero retries. No locks. The SHA is loaded once at startup; hot-path uses `EVALSHA` only, never `EVAL`. This is the correct primitive for this problem.

---

## Local Development

Requires Docker Desktop.

```bash
git clone https://github.com/divyeshdas/BlitzCart
cd BlitzCart

cp backend/.env.example backend/.env
# Fill in JWT_SECRET and JWT_REFRESH_SECRET (min 32 chars each)

docker compose up
```

Services:

| Service | URL |
|---|---|
| Backend API | http://localhost:3000 |
| SvelteKit frontend | http://localhost:4000 |
| Grafana | http://localhost:3001 (admin / admin) |
| Prometheus | http://localhost:9090 |

Run migrations and seed admin on first start:

```bash
docker compose exec backend npm run db:migrate
docker compose exec backend npm run db:seed
# Admin: admin@blitzcart.dev / admin_dev_pass_123
```

---

## Environment Variables

### Backend

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Min 32 chars — signs access tokens (15 min TTL) |
| `JWT_REFRESH_SECRET` | Min 32 chars — signs refresh tokens (7 day TTL) |
| `BCRYPT_ROUNDS` | Password hash cost factor (default: 12) |
| `PORT` | HTTP server port (default: 3000) |
| `CORS_ORIGIN` | Allowed CORS origin |

### Frontend

| Variable | Description |
|---|---|
| `PUBLIC_API_URL` | Backend base URL (https://) |
| `PUBLIC_WS_URL` | Backend WebSocket URL (wss://) |

---

## API Reference

```
POST /auth/register          { email, password } → 201 { accessToken, refreshToken, user }
POST /auth/login             { email, password } → 200 { accessToken, refreshToken, user }
POST /auth/refresh           { refreshToken }    → 200 { accessToken }

GET  /sales                  → 200 { sales[] }          active sales only
GET  /sales/:id              → 200 { sale, products[] }  Redis-first inventory

POST /sales/:saleId/buy      [auth] { productId }
                             → 202 { orderId, remaining, position }
                             → 410 sold out
                             → 429 rate limited (Retry-After: 10)

GET  /orders/me              [auth] → 200 { orders[] }

POST /admin/sales            [admin] { name, startsAt, endsAt, products[] } → 201
GET  /admin/sales            [admin] → 200 { sales[] }
GET  /admin/sales/:id/orders [admin] → 200 { orders[], stats }

GET  /health                 → 200 { status, uptime, redis, postgres }
GET  /metrics                → Prometheus text format

WS   /ws?saleId=:id          ← inventory-update | connected-count
```

---

## Load Testing

```bash
# Install k6
brew install k6

# Buy flood — 10,000 VUs all hitting buy simultaneously
k6 run \
  -e BASE_URL=https://blitzcart-production.up.railway.app \
  -e SALE_ID=<uuid> \
  -e PRODUCT_ID=<uuid> \
  load-tests/buy-flood.js

# WebSocket broadcast — 500 concurrent connections
k6 run \
  -e BASE_URL=https://blitzcart-production.up.railway.app \
  -e BASE_WS=wss://blitzcart-production.up.railway.app \
  -e SALE_ID=<uuid> \
  load-tests/ws-broadcast.js
```

Results are saved to `load-tests/results/`.
