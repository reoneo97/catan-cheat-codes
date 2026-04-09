# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository structure

Two independent projects live here:

| Directory | What it is |
|---|---|
| `extension/` | Chrome MV3 extension — resource tracker for colonist.io |
| `my-catan/` | Full-stack multiplayer Catan (TypeScript monorepo) |

They share no code and have separate `package.json` files. Work in the correct directory.

---

## extension/ — Chrome Resource Tracker

### Commands

```bash
cd extension
npm install
npm run build     # one-off build → extension/dist/
npm run dev       # watch mode — rebuilds on file save
```

After rebuilding, reload the extension at `chrome://extensions` and refresh the colonist.io tab.

### Architecture

```
colonist.io DOM
  └── public/content.js   (MutationObserver — vanilla JS, no build step)
        └── parses "PlayerName received: [resources]" log messages
              └── chrome.storage.local
                    └── src/App.jsx   (React popup — chrome.storage.onChanged)
```

`content.js` is plain JS (not transpiled) because it runs inside the colonist.io page context. The popup is React + Vite.

**Key selectors in `content.js`:** `CHAT_CONTAINER_SELECTOR` and `MESSAGE_ROW_SELECTOR` target the colonist.io game log. If parsing breaks, these need updating — inspect the live DOM in DevTools to find the current selectors.

**Data flow:** content.js → `chrome.storage.local` → popup React state via `chrome.storage.onChanged`. Reset is triggered by the popup sending a `RESET` message to the content script via `chrome.tabs.sendMessage`.

---

## catan-clone/ — Full-stack Catan

See `my-catan/CLAUDE.md` for the full architecture, game phases, socket events, implemented features, and instructions for adding new actions.

### Commands (run from `my-catan/`)

```bash
cd my-catan
npm install                          # install all workspaces
npm run dev                          # server (:3001) + client (:5173) concurrently
npm run dev -w @catan/server         # server only
npm run dev -w @catan/client         # client only
npm run build                        # build all packages (shared → server → client, in order)
```

### Package dependency order

`@catan/shared` must be built before `@catan/server` and `@catan/client` since both import from it. The root `build` script handles this order.
