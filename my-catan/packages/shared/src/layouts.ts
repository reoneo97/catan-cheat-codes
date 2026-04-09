/**
 * Board layouts for Catan.
 *
 * ── HOW TO ADD A NEW LAYOUT ───────────────────────────────────────────────────
 *
 * 1. Define a new `BoardLayout` object below (copy an existing one as a template).
 * 2. Set a unique `id` and human-readable `label`.
 * 3. Define `landHexes` using cube coordinates (q, r, s) where q + r + s = 0.
 *    Lay them out in rows in the source code to match the visual shape — it makes
 *    them much easier to edit. Use the hex grid visualizer at:
 *    https://www.redblobgames.com/grids/hexagons/
 * 4. Fill `terrainDistribution` — must have exactly landHexes.length entries.
 * 5. Fill `numberDistribution` — must have exactly (non-desert tile count) entries.
 * 6. Define `ports` — each port references a coastal hex by coord and specifies
 *    which two vertex indices (0–5, clockwise from top) face the sea.
 * 7. Add your layout to the `LAYOUTS` map at the bottom of this file.
 *
 * ── CUBE COORDINATE CHEAT SHEET ──────────────────────────────────────────────
 *
 * Pointy-top hex grid. s is always computed as -q - r.
 * Visualised (each cell is one hex):
 *
 *      (-2,-1) (-1,-1) ( 0,-1) ( 1,-1)
 *    (-2, 0) (-1, 0) ( 0, 0) ( 1, 0)
 *      (-2, 1) (-1, 1) ( 0, 1) ( 1, 1)
 *
 * ── VERTEX INDICES ────────────────────────────────────────────────────────────
 *
 * For a pointy-top hex, vertex indices go clockwise from the top:
 *
 *        0
 *      /   \
 *    5       1
 *    |       |
 *    4       2
 *      \   /
 *        3
 *
 */

import type { BoardLayout } from "./types.js";

// ── Standard (3–4 Players) ────────────────────────────────────────────────────

export const STANDARD_LAYOUT: BoardLayout = {
  id: "standard",
  label: "Standard (3–4 Players)",
  players: { min: 2, max: 4 },

  // Classic 19-hex diamond shape (radius 2)
  landHexes: [
    // Row  0 — 3 hexes
    { q:  0, r: -2, s:  2 }, { q:  1, r: -2, s:  1 }, { q:  2, r: -2, s:  0 },
    // Row  1 — 4 hexes
    { q: -1, r: -1, s:  2 }, { q:  0, r: -1, s:  1 }, { q:  1, r: -1, s:  0 }, { q:  2, r: -1, s: -1 },
    // Row  2 — 5 hexes (centre)
    { q: -2, r:  0, s:  2 }, { q: -1, r:  0, s:  1 }, { q:  0, r:  0, s:  0 }, { q:  1, r:  0, s: -1 }, { q:  2, r:  0, s: -2 },
    // Row  3 — 4 hexes
    { q: -2, r:  1, s:  1 }, { q: -1, r:  1, s:  0 }, { q:  0, r:  1, s: -1 }, { q:  1, r:  1, s: -2 },
    // Row  4 — 3 hexes
    { q: -2, r:  2, s:  0 }, { q: -1, r:  2, s: -1 }, { q:  0, r:  2, s: -2 },
  ],

  // 19 terrain tiles (must match landHexes.length)
  terrainDistribution: [
    "wood",  "wood",  "wood",  "wood",
    "sheep", "sheep", "sheep", "sheep",
    "wheat", "wheat", "wheat", "wheat",
    "ore",   "ore",   "ore",
    "brick", "brick", "brick",
    "desert",
  ],

  // 18 number tokens — one per non-desert tile (must match non-desert count)
  numberDistribution: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],

  // 9 ports (5 specific resource + 4 generic 3:1)
  ports: [
    // NW coast
    { hex: { q:  0, r: -2, s:  2 }, vertexIndices: [5, 0], resource: "generic" },
    { hex: { q:  1, r: -2, s:  1 }, vertexIndices: [0, 1], resource: "ore"     },
    // NE coast
    { hex: { q:  2, r: -2, s:  0 }, vertexIndices: [0, 1], resource: "generic" },
    { hex: { q:  2, r: -1, s: -1 }, vertexIndices: [1, 2], resource: "wheat"   },
    // E coast
    { hex: { q:  2, r:  0, s: -2 }, vertexIndices: [1, 2], resource: "generic" },
    // SE coast
    { hex: { q:  1, r:  1, s: -2 }, vertexIndices: [2, 3], resource: "generic" },
    { hex: { q:  0, r:  2, s: -2 }, vertexIndices: [3, 4], resource: "sheep"   },
    // SW coast
    { hex: { q: -1, r:  2, s: -1 }, vertexIndices: [3, 4], resource: "brick"   },
    { hex: { q: -2, r:  1, s:  1 }, vertexIndices: [4, 5], resource: "wood"    },
  ],
};

// ── Large Map (5–6 Players) ───────────────────────────────────────────────────

export const LARGE_MAP_LAYOUT: BoardLayout = {
  id: "largemap",
  label: "Large Map (5–6 Players)",
  players: { min: 3, max: 6 },

  // 30-hex shape: rows of 3-4-5-6-5-4-3
  landHexes: [
    // Row  0 — 3 hexes
    { q:  0, r: -3, s:  3 }, { q:  1, r: -3, s:  2 }, { q:  2, r: -3, s:  1 },
    // Row  1 — 4 hexes
    { q: -1, r: -2, s:  3 }, { q:  0, r: -2, s:  2 }, { q:  1, r: -2, s:  1 }, { q:  2, r: -2, s:  0 },
    // Row  2 — 5 hexes
    { q: -2, r: -1, s:  3 }, { q: -1, r: -1, s:  2 }, { q:  0, r: -1, s:  1 }, { q:  1, r: -1, s:  0 }, { q:  2, r: -1, s: -1 },
    // Row  3 — 6 hexes (widest)
    { q: -3, r:  0, s:  3 }, { q: -2, r:  0, s:  2 }, { q: -1, r:  0, s:  1 }, { q:  0, r:  0, s:  0 }, { q:  1, r:  0, s: -1 }, { q:  2, r:  0, s: -2 },
    // Row  4 — 5 hexes
    { q: -3, r:  1, s:  2 }, { q: -2, r:  1, s:  1 }, { q: -1, r:  1, s:  0 }, { q:  0, r:  1, s: -1 }, { q:  1, r:  1, s: -2 },
    // Row  5 — 4 hexes
    { q: -3, r:  2, s:  1 }, { q: -2, r:  2, s:  0 }, { q: -1, r:  2, s: -1 }, { q:  0, r:  2, s: -2 },
    // Row  6 — 3 hexes
    { q: -3, r:  3, s:  0 }, { q: -2, r:  3, s: -1 }, { q: -1, r:  3, s: -2 },
  ],

  // 30 terrain tiles (must match landHexes.length)
  terrainDistribution: [
    "wood",  "wood",  "wood",  "wood",  "wood",  "wood",
    "sheep", "sheep", "sheep", "sheep", "sheep", "sheep",
    "wheat", "wheat", "wheat", "wheat", "wheat", "wheat",
    "ore",   "ore",   "ore",   "ore",   "ore",
    "brick", "brick", "brick", "brick", "brick",
    "desert", "desert",
  ],

  // 28 number tokens — one per non-desert tile (30 tiles − 2 deserts = 28)
  numberDistribution: [
    2,  2,
    3,  3,  3,
    4,  4,  4,
    5,  5,  5,
    6,  6,  6,
    8,  8,  8,
    9,  9,  9,
    10, 10, 10,
    11, 11, 11,
    12, 12,
  ],

  // 11 ports (5 specific resource + 6 generic 3:1) around the larger perimeter
  ports: [
    // N coast
    { hex: { q:  0, r: -3, s:  3 }, vertexIndices: [5, 0], resource: "generic" },
    { hex: { q:  1, r: -3, s:  2 }, vertexIndices: [0, 1], resource: "ore"     },
    { hex: { q:  2, r: -3, s:  1 }, vertexIndices: [0, 1], resource: "generic" },
    // NE / E coast
    { hex: { q:  2, r: -2, s:  0 }, vertexIndices: [1, 2], resource: "wheat"   },
    { hex: { q:  2, r: -1, s: -1 }, vertexIndices: [1, 2], resource: "generic" },
    { hex: { q:  2, r:  0, s: -2 }, vertexIndices: [1, 2], resource: "sheep"   },
    // SE / S coast
    { hex: { q:  1, r:  1, s: -2 }, vertexIndices: [2, 3], resource: "generic" },
    { hex: { q:  0, r:  2, s: -2 }, vertexIndices: [3, 4], resource: "brick"   },
    { hex: { q: -1, r:  3, s: -2 }, vertexIndices: [3, 4], resource: "generic" },
    // SW / W coast
    { hex: { q: -2, r:  3, s: -1 }, vertexIndices: [3, 4], resource: "wood"    },
    { hex: { q: -3, r:  2, s:  1 }, vertexIndices: [4, 5], resource: "generic" },
  ],
};

// ── Layout registry ───────────────────────────────────────────────────────────
// Add new layouts here. The key is used as the layoutId in GameState.

export const LAYOUTS: Record<string, BoardLayout> = {
  [STANDARD_LAYOUT.id]:  STANDARD_LAYOUT,
  [LARGE_MAP_LAYOUT.id]: LARGE_MAP_LAYOUT,
};

export const DEFAULT_LAYOUT_ID = STANDARD_LAYOUT.id;
