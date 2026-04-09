# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

RUN npm ci

# Copy source and build
COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/

RUN npm run build -w @catan/shared && npm run build -w @catan/server

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Re-install production deps only (workspace symlinks are re-created by npm ci)
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "packages/server/dist/index.js"]
