# Catan Clone

Full-stack multiplayer Settlers of Catan in TypeScript. npm workspaces monorepo.

## Packages

| Package | Description |
|---|---|
| `@catan/shared` | Pure TS — types, hex math, board gen, game engine, rules |
| `@catan/server` | Node.js + Express + Socket.io game server |
| `@catan/client` | Vite + React + Zustand + SVG board |

## Dev

```bash
npm install          # install all workspaces from repo root
npm run dev          # start server (:3001) + client (:5173) concurrently
```

Or run individually:
```bash
npm run dev -w @catan/server
npm run dev -w @catan/client
```

## Build

```bash
npm run build        # build all packages in dependency order
```

Shared must be built before server/client since they import from it.

## Architecture

```
packages/shared/src/
  ├── types.ts       All game types (GameState, Player, Action, Board…)
  ├── hex.ts         Cube coordinate math, vertex/edge IDs, SVG pixel positions
  ├── board.ts       Board generation — randomised tiles, number tokens, ports
  ├── rules.ts       Move validation — pure functions, no side effects
  └── engine.ts      applyAction(state, playerId, action) → GameState

packages/server/src/
  ├── index.ts       Express + Socket.io server, socket event routing
  └── GameRoom.ts    Room/lobby management, per-player state filtering

packages/client/src/
  ├── socket.ts      Shared Socket.io client instance (VITE_SERVER_URL env var)
  ├── store.ts       Zustand store — wires socket events to React state
  ├── flightBus.ts   Pub/sub for flying resource animations (SVG→HTML coord conversion)
  ├── App.tsx        Lobby → waiting room → game layout, routes: / /game /tutorial
  ├── App.css        Global styles + CSS keyframe animations
  └── components/
        ├── Board.tsx              SVG board — tiles, buildings, roads, robber, overlays
        ├── PlayerPanel.tsx        Sidebar — hands, actions, log, help, confirmations, DevTestPanel
        ├── DiceDisplay.tsx        Animated physical dice with pip dots
        ├── DevCardPanel.tsx       Dev card hand, SVG icons, play/discard/steal UI
        ├── TradePanel.tsx         Bank trade + player-to-player trade UI
        ├── HelpModal.tsx          In-game quick reference modal (costs, dev cards, trading)
        ├── Tutorial.tsx           Full /tutorial page (all mechanics)
        ├── TradeOfferOverlay.tsx  Active trade offers shown as board overlay
        ├── FlyingResourcesOverlay.tsx  Flying resource card animations
        └── TipOfTheDay.tsx        Rotating tips shown in sidebar
```

**The engine lives in `shared/`** and runs on the server authoritatively. The server is the single source of truth — clients send actions, server validates and applies them, then broadcasts updated state to all players. Each player receives a personalised view (opponent dev card contents are hidden).

## Key concepts

**Hex grid:** Cube coordinates `(q, r, s)` where `q + r + s = 0`. See `hex.ts`.

**Vertex IDs:** Derived from the sorted cube keys of the 2–3 hexes that share the vertex. Canonical across all adjacent hexes.

**Edge IDs:** Derived from the sorted cube keys of the 2 hexes sharing the edge.

**Vertex-to-corner mapping:** `hexVertexIds` index `i` (0 = top, clockwise) maps to `hexCornerPixel` index `(i+5)%6` because `hexCornerPixel` starts at -30° (top-right). This offset is critical — all port, road, and building positions depend on it.

**Game phases:**
- `setup` — snake draft: players place 2 settlements + 2 roads each (reverse order for round 2)
- `main` — normal play: preRoll → postRoll, with sub-phases for robber/discarding/road-building
- `ended` — winner determined

**Socket events:**
- Client → Server: `joinRoom`, `startGame`, `restartGame`, `action`
- Server → Client: `gameState`, `gameStarted`, `playerJoined`, `playerLeft`, `error`

**Environment variables:**
- Server: `ALLOWED_ORIGIN` (CORS — defaults to `http://localhost:5173`)
- Client: `VITE_SERVER_URL` (socket URL — defaults to `""` which uses Vite proxy)

## What's implemented

- [x] Full board generation (randomised tiles, numbers, ports)
- [x] Board fairness constraints — no two 6/8 adjacent, no two 2/12 adjacent (retry-based generation)
- [x] Setup phase (snake draft, round-2 free resources)
- [x] Dice rolling + resource distribution
- [x] Robber on 7 (discard >7, move robber, steal) with interactive SVG targeting + blocked-building indicators
- [x] Building: settlements, cities, roads
- [x] Development cards: knight, road building, year of plenty, monopoly, VP cards
- [x] Dev card SVG icons (shield+sword knight, +2 YoP, L-plank road building, coin monopoly, star VP)
- [x] Newly bought dev cards show type + "next turn" badge; unplayable until next turn
- [x] Largest army / longest road
- [x] Bank trading (4:1 default, port ratios)
- [x] Player-to-player trade offers
- [x] Victory point tracking + win condition (10 VP)
- [x] Per-player hidden state (opponent dev cards masked)
- [x] Discard UI, steal picker, dev card play UI (YoP/Monopoly pickers)
- [x] Animated physical dice (pip dots, shake animation, ROBBER! label)
- [x] Tile pulse animation on roll — tiles matching rolled number glow gold
- [x] Resource gain floaters — `+N emoji` floats up in your player card on resource gain
- [x] Flying resource card animations (flightBus.ts — SVG→HTML coordinate conversion)
- [x] Valid placement highlighting — vertex/edge dots only shown on legal spots
- [x] Largest army / longest road badges per player; hover road icon to highlight longest road on board
- [x] Hex flip animation on new game; skipped on reconnect (fingerprint in localStorage)
- [x] Radial-gradient terrain, number token shadows, pip dots, animated sea waves, round road caps
- [x] Port markers: anchor + resource + ratio badge with dock planks from coast vertices
- [x] Castle SVG icon for cities (two towers with battlements, bezier arch gate)
- [x] In-game `?` help modal (building costs, dev card descriptions, trading summary)
- [x] Restart / quit confirmation UI (two-step confirm before action)
- [x] Last-player-wins: server sets winner if only one connected player remains
- [x] Reconnection handling: server marks player disconnected, re-connects on same socket with same playerId
- [x] Full tutorial page at `/tutorial`
- [x] `devtest` room: resource grant panel in sidebar for testing (5 resource buttons, no second player needed)
- [x] Deployment infrastructure: Dockerfile, fly.toml, GitHub Actions CI + deploy workflows

## What's not yet implemented (TODO)

- [ ] Road rotation to align with actual hex edge angles in SVG
- [ ] Game persistence (currently in-memory only — server restart loses all games)
- [ ] Spectator mode

## Adding a new action

1. Add the action type to the `Action` union in `shared/src/types.ts`
2. Add validation logic in `shared/src/rules.ts` (pure function)
3. Handle the action in `shared/src/engine.ts` → `applyActionMut`
   - **Important:** If the action must bypass phase guards (e.g. dev/cheat actions like `devGrant`), handle it at the **very top** of `applyActionMut`, before any phase-based early returns. Otherwise the phase guard will throw "Invalid action" before your handler runs.
4. Wire up the UI in the relevant client component

## Deployment

Frontend → Cloudflare Pages, backend → Fly.io.

Set `VITE_SERVER_URL` in Cloudflare Pages build env to your Fly.io URL.
Set `ALLOWED_ORIGIN` as a Fly.io secret to your Pages URL.

`Dockerfile` and `fly.toml` are in `my-catan/`. GitHub Actions workflows are in `.github/workflows/`.
