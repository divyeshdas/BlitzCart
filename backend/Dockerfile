FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl

FROM base AS deps
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --include=dev

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ .
CMD ["npm", "run", "dev"]

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ .
RUN npm run build && cp -r src/scripts dist/scripts && cp -r src/db/migrations dist/db/migrations

FROM base AS prod
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY backend/package.json ./
EXPOSE 3000
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/db/seed.js && node dist/index.js"]
