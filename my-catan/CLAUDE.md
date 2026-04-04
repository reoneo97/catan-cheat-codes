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
colonist.io DOM (browser)
  └── packages/shared/src/
        ├── types.ts       All game types (GameState, Player, Action, Board…)
        ├── hex.ts         Cube coordinate math, vertex/edge IDs, SVG pixel positions
        ├── board.ts       Board generation — randomised tiles, number tokens, ports
        ├── rules.ts       Move validation — pure functions, no side effects
        └── engine.ts      applyAction(state, playerId, action) → GameState

packages/server/src/
  ├── index.ts       Express + Socket.io server, socket event routing
  └── GameRoom.ts    Room/lobby management, per-player state filtering

packages/client/src/
  ├── socket.ts      Shared Socket.io client instance
  ├── store.ts       Zustand store — wires socket events to React state
  ├── App.tsx        Lobby → waiting room → game layout
  ├── App.css        Global styles + CSS keyframe animations (hexFlip, diceShake, tilePulse, resourceFloat)
  └── components/
        ├── Board.tsx         SVG board — hex tiles, vertices, edges, buildings, roads
        ├── PlayerPanel.tsx   Player hands, action buttons, game log
        ├── DiceDisplay.tsx   Animated physical dice with pip dots
        ├── DevCardPanel.tsx  Discard picker, steal picker, dev card hand
        └── TradePanel.tsx    Bank trade + player-to-player trade UI
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
- Client → Server: `joinRoom`, `startGame`, `action`
- Server → Client: `gameState`, `gameStarted`, `playerJoined`, `playerLeft`, `error`

## What's implemented

- [x] Full board generation (randomised tiles, numbers, ports)
- [x] Setup phase (snake draft, round-2 free resources)
- [x] Dice rolling + resource distribution
- [x] Robber on 7 (discard >7, move robber, steal)
- [x] Building: settlements, cities, roads
- [x] Development cards: knight, road building, year of plenty, monopoly, VP cards
- [x] Largest army / longest road
- [x] Bank trading (4:1 default, port ratios)
- [x] Player-to-player trade offers
- [x] Victory point tracking + win condition (10 VP)
- [x] Per-player hidden state (opponent dev cards masked)
- [x] Discard UI, steal picker, dev card play UI (YoP/Monopoly pickers)
- [x] Animated physical dice (pip dots, shake animation, ROBBER! label)
- [x] Tile pulse animation on roll — tiles matching rolled number glow gold
- [x] Resource gain floaters — `+N emoji` floats up in your player card on resource gain
- [x] Valid placement highlighting — vertex/edge dots only shown on legal spots
- [x] Largest army / longest road badges per player; hover road icon to highlight longest road on board
- [x] Hex flip animation on new game; skipped on reconnect (fingerprint in localStorage)
- [x] Radial-gradient terrain, number token shadows, pip dots, animated sea waves, round road caps
- [x] Port markers: anchor + resource + ratio badge with dock planks from coast vertices

## What's not yet implemented (TODO)

- [ ] Road rotation to align with actual hex edge angles in SVG
- [ ] Reconnection handling (socket drops mid-game)
- [ ] Game persistence (currently in-memory only)
- [ ] Spectator mode

## Adding a new action

1. Add the action type to the `Action` union in `shared/src/types.ts`
2. Add validation logic in `shared/src/rules.ts` (pure function)
3. Handle the action in the `switch` in `shared/src/engine.ts` → `applyActionMut`
4. Wire up the UI in the relevant client component
