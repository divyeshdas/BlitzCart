# BlitzCart

Flash-sale engine that handles 10,000 simultaneous buy requests for 100 items without a single oversell. The core problem is a classic concurrency race: naive `SELECT stock WHERE id = $1` followed by `UPDATE SET stock = stock - 1` lets two requests both read `stock = 1`, both pass the check, and both write — producing `stock = -1` and one phantom order. BlitzCart solves this with a Redis Lua script that makes the read-check-decrement atomic at the interpreter level.

---

## Architecture

```
Browser ──── SvelteKit (Vercel)
                │
                │ REST + WebSocket
                ▼
         Express (Railway)
         ┌─────┴──────────────────────┐
         │  /auth  /sales  /orders    │
         │  /admin  /metrics  /ws     │
         └─────┬──────────────────────┘
               │
       ┌───────┼───────────┐
       ▼       ▼           ▼
     Redis   Postgres    BullMQ
    (Lua +  (Drizzle    (order
    PubSub)  ORM)       worker)
       │
       └── Redis Pub/Sub ──▶ WebSocket broadcast
```

**Data flow for a buy request:**

1. JWT auth middleware validates token (~0.1ms)
2. Rate-limit Lua script checks token bucket in Redis — 5 req/user/10s (~0.5ms)
3. `atomic_buy.lua` runs `GET` + conditional `DECRBY` as a single atomic unit (~0.5ms)
4. On success: insert pending order row, push BullMQ job, publish `inventory-update:{saleId}`
5. Return `202 Accepted` — total hot path ~5–15ms
6. Worker (concurrency 10) confirms the order in Postgres asynchronously
7. Redis subscriber fires on the channel → WS server broadcasts to all connected clients

---

## Why Redis Lua, not a transaction or Redlock?

**Naive `WATCH`/`MULTI`/`EXEC` (optimistic lock):** Works, but under high contention every competing request retries. At 10,000 VUs hitting the same key, nearly all of them retry multiple times — throughput collapses.

**Redlock (distributed mutex):** Adds a lock acquisition roundtrip (multiple Redis nodes) before every buy. Latency doubles. Clock drift creates correctness edge cases. Overkill for a single-node inventory counter.

**Lua script via `EVALSHA`:** Redis executes the entire script atomically — no other command can interleave. One roundtrip, no retries, no locks, no clock issues. The SHA is loaded once at startup (`SCRIPT LOAD`); every request uses `EVALSHA` to avoid re-parsing. This is the correct tool for this exact problem.

**Why BullMQ instead of writing to Postgres directly in the buy path?**

Postgres writes are ~5–20ms under load. Putting that in the buy handler would blow the p95 target. BullMQ decouples the fast Redis path from the slower Postgres write. The order is already committed in Redis (inventory decremented); Postgres is just the durable record. If the worker fails, it retries with backoff and can restore inventory on exhausted retries.

**Token bucket over a sliding window counter?**

Token bucket is simpler to implement atomically in Lua (one key, one decrement) and has better burst behavior — a user gets 5 tokens that refill together after 10s, rather than a sliding count that's more expensive to compute atomically.

---

## Performance targets

| Metric | Target |
|---|---|
| Concurrent users | 10,000 simultaneous buy requests |
| Oversell rate | 0 — enforced by Lua atomicity |
| p95 latency | < 50ms |
| p99 latency | < 120ms |
| Throughput | ≥ 5,000 req/s sustained |
| WS broadcast lag | < 100ms buy → all clients |
| Worker drain | < 2s for all 100 orders after sale ends |
| Rate limit | 5 buy attempts / user / 10s |

---

## Local development

Requires Docker and Docker Compose.

```bash
git clone https://github.com/your-org/blitzcart
cd blitzcart

# Copy and fill env vars
cp backend/.env.example backend/.env

# Start everything
docker compose up

# Run migrations + seed admin user
docker compose exec backend npm run db:migrate
docker compose exec backend npm run db:seed

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

Services after `docker compose up`:

| Service | URL |
|---|---|
| Backend API | http://localhost:3000 |
| SvelteKit | http://localhost:5173 |
| Grafana | http://localhost:3001 (admin/admin) |
| Prometheus | http://localhost:9090 |
| Redis | localhost:6379 |
| Postgres | localhost:5432 |

Default admin: `admin@blitzcart.dev` / `admin_dev_pass_123`

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Min 32 chars, signs access tokens (15m TTL) |
| `JWT_REFRESH_SECRET` | Min 32 chars, signs refresh tokens (7d TTL) |
| `BCRYPT_ROUNDS` | Password hash cost factor (default: 12) |
| `PORT` | HTTP server port (default: 3000) |
| `CORS_ORIGIN` | Allowed origin for CORS |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `PUBLIC_API_URL` | Backend base URL |
| `PUBLIC_WS_URL` | Backend WebSocket URL (ws://) |

---

## API reference

```
POST /auth/register          { email, password } → { accessToken, refreshToken, user }
POST /auth/login             { email, password } → { accessToken, refreshToken, user }
POST /auth/refresh           { refreshToken } → { accessToken }

GET  /sales                  → { sales[] }  (active only)
GET  /sales/:id              → { sale, products[] }

POST /sales/:saleId/buy      [auth] { productId } → 202 { orderId, remaining, position }
                                                  → 410 sold out
                                                  → 429 rate limited

GET  /orders/me              [auth] → { orders[] }

POST /admin/sales            [admin] { name, startsAt, endsAt, products[] } → 201
GET  /admin/sales            [admin] → { sales[] }
GET  /admin/sales/:id        [admin] → { sale, products[] }
GET  /admin/sales/:id/orders [admin] → { orders[], stats }

GET  /health                 → { status, uptime, redis, postgres }
GET  /metrics                → Prometheus text format

WS   /ws?saleId=:id          → inventory-update | connected-count messages
```

---

## Load tests

k6 must be installed. Docker Compose must be running. Create a sale via admin UI first.

```bash
# Buy flood — 10,000 VUs
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e SALE_ID=<uuid> \
  -e PRODUCT_ID=<uuid> \
  load-tests/buy-flood.js

# WebSocket broadcast — 500 concurrent connections
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e BASE_WS=ws://localhost:3000 \
  -e SALE_ID=<uuid> \
  load-tests/ws-broadcast.js
```

Results are written to `load-tests/results/`.

---

## Deployment

**Backend → Railway**

1. Create a new Railway project, add a Postgres and Redis service
2. Connect this repo, set root to `/`
3. Set env vars from the table above (generate secrets with `openssl rand -base64 32`)
4. Railway reads `railway.toml` for build config

**Frontend → Vercel**

1. Import the repo on Vercel, set root to `frontend/`
2. Set `PUBLIC_API_URL` and `PUBLIC_WS_URL` to the Railway backend URL
3. Vercel auto-detects SvelteKit via `@sveltejs/adapter-vercel`
