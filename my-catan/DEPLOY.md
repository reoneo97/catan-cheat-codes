# Deployment Guide

## Two-environment setup

### Local dev

```
Browser :5173 (Vite dev server)
    │
    │  /socket.io  ──proxy──▶  Node server :3001
    │
```

- `VITE_SERVER_URL` is not set → `socket.ts` defaults to `""` → Vite proxies `/socket.io` to `localhost:3001`
- `ALLOWED_ORIGIN` is not set → server defaults to `"http://localhost:5173"`
- No env files needed

```bash
cd my-catan
npm install
npm run dev
```

### Production

```
Browser → Cloudflare Pages (static HTML/JS bundle)
              │
              │  wss://catan-server-app.fly.dev/socket.io
              ▼
          Fly.io (Docker container, Node.js server)
```

- `VITE_SERVER_URL=https://catan-server-app.fly.dev` — baked into the JS bundle at Vite build time
- `ALLOWED_ORIGIN=https://your-app.pages.dev` — Fly.io secret, read at runtime by the server

---

## One-time setup

### 1. Fly.io (server)

```bash
# Run from my-catan/
fly launch --no-deploy        # creates the app, generates fly.toml if missing
fly secrets set ALLOWED_ORIGIN=https://your-app.pages.dev
fly deploy                    # first manual deploy to verify it works
```

### 2. Cloudflare Pages (client)

In the Cloudflare dashboard, create a new Pages project connected to your GitHub repo with:

- **Build command:** `cd my-catan && npm ci && npm run build -w @catan/shared && npm run build -w @catan/client`
- **Build output directory:** `my-catan/packages/client/dist`
- **Environment variable:** `VITE_SERVER_URL=https://catan-server-app.fly.dev`

Or use the GitHub Actions workflow (see below) and point Pages at the uploaded artifact instead.

### 3. GitHub Actions secrets

In your repo → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|---|---|
| `FLY_API_TOKEN` | From `fly tokens create deploy` |
| `VITE_SERVER_URL` | `https://catan-server-app.fly.dev` |
| `CLOUDFLARE_API_TOKEN` | From Cloudflare dashboard → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | From Cloudflare dashboard → right sidebar |

---

## CI/CD (GitHub Actions)

Two workflows in `.github/workflows/`:

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Every push | Install, build shared + server + client, type-check |
| `deploy.yml` | Push to `master` (paths: `my-catan/**`) or manual | Deploy server to Fly.io, deploy client to Cloudflare Pages |

After the one-time setup, every push to `master` deploys automatically.

---

## Environment variables reference

| Variable | Package | How it's set | Default (local) |
|---|---|---|---|
| `VITE_SERVER_URL` | client | Build-time env (Vite bakes it into the JS bundle) | `""` (uses Vite proxy) |
| `ALLOWED_ORIGIN` | server | Runtime env / Fly.io secret | `"http://localhost:5173"` |
| `PORT` | server | Runtime env / fly.toml | `3001` |

---

## Testing against the production server locally

Create `packages/client/.env.local` (gitignored by Vite automatically):

```
VITE_SERVER_URL=https://catan-server-app.fly.dev
```

Then run `npm run dev -w @catan/client`. The client will connect to the live server instead of the local one.

---

## Docker (server only)

The `Dockerfile` is a multi-stage build:

1. **Builder stage** — installs all workspace deps, builds `@catan/shared` then `@catan/server`
2. **Runtime stage** — installs production deps only, copies compiled `dist/` from builder

```bash
# Build and run locally
docker build -t catan-server .
docker run -p 3001:3001 -e ALLOWED_ORIGIN=http://localhost:5173 catan-server
```

The client is not containerised — it's a static file bundle deployed directly to Cloudflare Pages.
