# Catan Clone

Full-stack multiplayer Settlers of Catan built in TypeScript. Real-time via Socket.io, SVG board, no external game-logic libraries.

---

## How it works

Players open the same URL, type a shared room code, and are dropped into a waiting room. Once 2–4 players are present anyone can start the game. The server runs the authoritative game engine; clients send actions and render whatever state the server pushes back. Each player receives a personalised view (opponents' dev card contents are hidden until played).

---

## System design

```
┌─────────────────────────────────────────────┐
│  Browser (React + Vite + Socket.io client)  │
│                                             │
│  App.tsx ──┬── Lobby / WaitingRoom          │
│            └── Game layout                 │
│                 ├── Board.tsx  (SVG)        │
│                 └── PlayerPanel.tsx         │
│                      ├── DevCardPanel       │
│                      ├── TradePanel         │
│                      └── HelpModal          │
│                                             │
│  store.ts (Zustand) ── socket.ts            │
└───────────────────┬─────────────────────────┘
                    │  WebSocket (Socket.io)
┌───────────────────▼─────────────────────────┐
│  Server (Node.js + Express + Socket.io)     │
│                                             │
│  index.ts  — socket event routing           │
│  GameRoom.ts — lobby state, per-player view │
│                                             │
│  imports @catan/shared (game engine)        │
└─────────────────────────────────────────────┘
```

### Data flow

1. Client emits an **action** event (e.g. `{ type: "rollDice" }`).
2. Server calls `applyAction(state, playerId, action)` from `@catan/shared`.
3. The engine mutates a draft state and throws a string on invalid moves.
4. Server broadcasts personalised `gameState` to every socket in the room.
5. Client Zustand store receives the new state and React re-renders.

### State ownership

- The server holds the single source of truth (`GameState` in memory).
- Clients hold a `ClientGameState` — identical except opponent dev cards are replaced with `"unknown"` strings.
- No client-side prediction; all validation happens server-side.

---

## Key files to read

### Shared (game rules + types)

| File | What it does |
|---|---|
| `packages/shared/src/types.ts` | All TypeScript types: `GameState`, `Player`, `Board`, `Action` union, `PlayerColor`, etc. Start here to understand the data model. |
| `packages/shared/src/engine.ts` | `applyAction(state, playerId, action)` — the single entry point for all game logic. `applyActionMut` is the inner mutable dispatcher. |
| `packages/shared/src/rules.ts` | Pure validation functions (no side effects) called by the engine before mutations. |
| `packages/shared/src/board.ts` | Randomised board generation. Shuffles terrain tiles + number tokens, retries until the placement passes adjacency constraints (no two 6/8 adjacent, no two 2/12 adjacent). |
| `packages/shared/src/hex.ts` | Cube coordinate math. `hexCenter()`, `hexCornerPixel()`, `hexVertexIds()`, `hexEdgeId()`. Everything positional derives from here. |

### Server

| File | What it does |
|---|---|
| `packages/server/src/GameRoom.ts` | Room lifecycle: player join/leave/reconnect, start/restart, action dispatch. Also strips hidden info via `toClientState()`. |
| `packages/server/src/index.ts` | Socket.io event handlers wired to `GameRoom` methods. `ALLOWED_ORIGIN` env var controls CORS. |

### Client

| File | What it does |
|---|---|
| `packages/client/src/store.ts` | Zustand store. Connects/disconnects the socket, handles all incoming events, exposes `sendAction`, `startGame`, `restartGame`, `leave`. |
| `packages/client/src/App.tsx` | Top-level routing: `JoinForm` → `WaitingRoom` → game layout. Routes: `/`, `/game`, `/tutorial`. |
| `packages/client/src/components/Board.tsx` | SVG board renderer. Hex tiles with terrain, number tokens, ports, buildings, roads, the robber, and all interactive overlays (placement highlights, robber targeting with blocked-building indicators, ConfirmAction tick/cross). |
| `packages/client/src/components/PlayerPanel.tsx` | Right sidebar: player cards with resource hands, action buttons (roll/buy/end turn), trade panel, dev cards, game log, restart/quit confirmations, `?` help modal trigger, `DevTestPanel` (room `devtest` only). |
| `packages/client/src/components/DevCardPanel.tsx` | Dev card hand display with SVG icons, play buttons, discard/steal pickers, "next turn" badges for newly bought cards. |
| `packages/client/src/components/HelpModal.tsx` | In-game quick-reference modal: building costs, dev card descriptions, trading rules. |
| `packages/client/src/components/Tutorial.tsx` | Full `/tutorial` page covering all mechanics. |
| `packages/client/src/flightBus.ts` | Tiny pub/sub for flying resource animations (SVG board → HTML player panel coordinate conversion). |

---

## Game phases

```
setup
  → place settlement 1 (snake order, player 1→N)
  → place road 1
  → place settlement 2 (reverse: player N→1)
  → place road 2  (player receives resources for settlement 2)

main
  preRoll  → roll dice  (or play Knight before rolling)
  postRoll → build / trade / play dev card / end turn
    sub-phases: robber (place after 7 or knight), discard (>7 cards on 7),
                steal (pick victim), roadBuilding (place 2 roads)

ended
  → winnerId set, GameOverScreen shown
```

---

## Adding a new action

1. Add the type to the `Action` union in `shared/src/types.ts`.
2. Add validation in `shared/src/rules.ts` (pure function, throw string on failure).
3. Handle in `applyActionMut` in `shared/src/engine.ts`.
   - If the action must bypass phase guards (e.g. dev/cheat actions), handle it at the **top** of `applyActionMut` before the phase switch.
4. Wire up the UI in the relevant client component and call `sendAction(...)`.

---

## Deployment

### Infrastructure

- **Frontend** — static Vite build, deployed to Cloudflare Pages.
- **Backend** — Node.js server, deployed to Fly.io (single region, single instance).
- **No database** — game state is in-memory. On server restart all active games are lost.

### Required environment variables

| Variable | Where set | Value |
|---|---|---|
| `VITE_SERVER_URL` | Cloudflare Pages build env | `https://<your-app>.fly.dev` |
| `ALLOWED_ORIGIN` | Fly.io secret | `https://<your-app>.pages.dev` |

### CI/CD (GitHub Actions)

- **`.github/workflows/ci.yml`** — runs on every push: installs, builds shared+server+client, type-checks.
- **`.github/workflows/deploy.yml`** — runs on push to `master`: builds and deploys server to Fly.io, deploys client dist to Cloudflare Pages.

### Docker

`my-catan/Dockerfile` is a multi-stage build:
1. Build stage — installs all workspace deps, builds shared then server.
2. Production stage — copies only the server `dist/` and `node_modules/`.

`fly.toml` configures the Fly.io app: port 3001, `/health` check, 512 MB RAM.

---

## Local development

```bash
cd my-catan
npm install
npm run dev          # server :3001 + client :5173
```

To test multiplayer locally, open two browser tabs to `http://localhost:5173` and use the same room code.

Use room code `devtest` to get the resource grant panel (sidebar bottom) for fast testing without needing a second player.
