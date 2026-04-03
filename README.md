# Catan Resource Tracker

A Chrome extension that tracks resources gained by each player while playing on [colonist.io](https://colonist.io). It reads the game log in real time and displays a running tally in a popup.

![Resource tracker popup showing per-player wood, brick, wheat, ore, sheep counts](docs/preview.png)

## Installation (no build required)

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the `extension/dist/` folder
6. Open [colonist.io](https://colonist.io), start a game, and click the extension icon to see the tracker

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
cd extension
npm install
```

### Build

```bash
npm run build        # one-off build → extension/dist/
npm run dev          # watch mode — rebuilds on every file save
```

After rebuilding, go to `chrome://extensions` and click the refresh icon on the extension, then reload your colonist.io tab.

### Project structure

```
extension/
  public/
    manifest.json   Chrome extension manifest (MV3)
    content.js      Vanilla JS — attaches MutationObserver to the game log,
                    parses resource gain messages, writes to chrome.storage.local
  src/
    App.jsx         React popup — reads storage and renders the resource table
    App.css
    main.jsx
  index.html        Popup entry point
  vite.config.js
  dist/             Built output — load this folder as the unpacked extension
```

### How it works

```
colonist.io DOM
  └── content.js (MutationObserver)
        └── parses "PlayerName received: [resources]" messages
              └── chrome.storage.local
                    └── React popup (chrome.storage.onChanged)
                          └── re-renders resource table
```

`content.js` stays vanilla JS because it runs inside the colonist.io page context and only needs DOM access. The popup is React + Vite so the UI is easy to extend.

### Adjusting selectors

If messages stop being parsed, the colonist.io DOM may have changed. Open DevTools on colonist.io, inspect the game log panel, and update `CHAT_CONTAINER_SELECTOR` at the top of `public/content.js` to match the current selector.

## Publishing to the Chrome Web Store

1. Zip the `extension/dist/` folder
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Pay the one-time $5 developer registration fee (if not already done)
4. Upload the zip and fill in the store listing
5. Submit for review (~1–3 business days)
