/**
 * Board generation for the standard Catan setup.
 * Produces a randomized board following official tile and number token distributions.
 */

import type { Board, CubeCoord, Port, ResourceType, TerrainType, Tile, VertexId } from "./types.js";
import { STANDARD_LAND_HEXES, cubeAdd, cubeKey, edgeId, hexVertexIds, CUBE_DIRECTIONS } from "./hex.js";

// ── Tile distribution ─────────────────────────────────────────────────────────

const TERRAIN_DISTRIBUTION: TerrainType[] = [
  "wood", "wood", "wood", "wood",
  "sheep", "sheep", "sheep", "sheep",
  "wheat", "wheat", "wheat", "wheat",
  "ore", "ore", "ore",
  "brick", "brick", "brick",
  "desert",
];

/** Official number token distribution (excludes desert, which gets no number). */
const NUMBER_DISTRIBUTION = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

// ── Port configuration ────────────────────────────────────────────────────────

/**
 * Ports are placed on the edge of the board. Each port occupies two adjacent
 * vertices on the coast. We define them by the hex coord just inside the board
 * and the two vertex indices (0–5) facing outward.
 *
 * Standard Catan has 9 ports (5 specific + 4 generic 3:1).
 */
interface PortDef {
  hex: CubeCoord;
  vertexIndices: [number, number];
  resource: ResourceType | "generic";
}

const PORT_DEFINITIONS: PortDef[] = [
  // NW coast
  { hex: { q: 0, r: -2, s: 2 },  vertexIndices: [5, 0], resource: "generic" },
  { hex: { q: 1, r: -2, s: 1 },  vertexIndices: [0, 1], resource: "ore" },
  // NE coast
  { hex: { q: 2, r: -2, s: 0 },  vertexIndices: [0, 1], resource: "generic" },
  { hex: { q: 2, r: -1, s: -1 }, vertexIndices: [1, 2], resource: "wheat" },
  // E coast
  { hex: { q: 2, r: 0, s: -2 },  vertexIndices: [1, 2], resource: "generic" },
  // SE coast
  { hex: { q: 1, r: 1, s: -2 },  vertexIndices: [2, 3], resource: "generic" },
  { hex: { q: 0, r: 2, s: -2 },  vertexIndices: [3, 4], resource: "sheep" },
  // SW coast
  { hex: { q: -1, r: 2, s: -1 }, vertexIndices: [3, 4], resource: "brick" },
  { hex: { q: -2, r: 1, s: 1 },  vertexIndices: [4, 5], resource: "wood" },
];

// ── Fisher-Yates shuffle ──────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Placement validation ──────────────────────────────────────────────────────

/**
 * Returns true if no two "red" numbers (6 or 8) are on adjacent hexes,
 * and no two extreme numbers (2 or 12) are on adjacent hexes.
 * These are the standard fair-play constraints used by virtually every
 * digital Catan implementation.
 */
function hasValidNumberPlacement(tiles: Tile[]): boolean {
  const byKey = new Map(tiles.map((t) => [cubeKey(t.coord), t]));
  for (const tile of tiles) {
    if (!tile.number) continue;
    const isRed = tile.number === 6 || tile.number === 8;
    const isExtreme = tile.number === 2 || tile.number === 12;
    if (!isRed && !isExtreme) continue;
    for (const dir of CUBE_DIRECTIONS) {
      const n = byKey.get(cubeKey(cubeAdd(tile.coord, dir)));
      if (!n?.number) continue;
      if (isRed && (n.number === 6 || n.number === 8)) return false;
      if (isExtreme && (n.number === 2 || n.number === 12)) return false;
    }
  }
  return true;
}

// ── Board generation ──────────────────────────────────────────────────────────

export function generateBoard(): Board {
  // Retry until the number placement satisfies adjacency constraints.
  // In practice this converges in < 20 attempts on average.
  let tiles: Tile[] = [];
  let desertCoord: CubeCoord | undefined;

  for (let attempt = 0; attempt < 500; attempt++) {
    const terrains = shuffle(TERRAIN_DISTRIBUTION);
    const numbers = shuffle(NUMBER_DISTRIBUTION);
    let numberIndex = 0;
    desertCoord = undefined;

    const candidate: Tile[] = STANDARD_LAND_HEXES.map((coord, i) => {
      const terrain = terrains[i];
      const isDesert = terrain === "desert";
      if (isDesert) desertCoord = coord;
      return {
        coord,
        terrain,
        number: isDesert ? undefined : numbers[numberIndex++],
        hasRobber: isDesert,
      };
    });

    if (hasValidNumberPlacement(candidate)) {
      tiles = candidate;
      break;
    }
  }

  // Build ports from definitions
  const ports: Port[] = PORT_DEFINITIONS.map((def) => {
    const vIds = hexVertexIds(def.hex);
    const resource = def.resource === "generic" ? "generic" : def.resource;
    return {
      vertices: [vIds[def.vertexIndices[0]], vIds[def.vertexIndices[1]]],
      resource,
      ratio: resource === "generic" ? 3 : 2,
    } satisfies Port;
  });

  return {
    tiles,
    buildings: {},
    roads: {},
    ports,
  };
}

// ── Board query helpers ───────────────────────────────────────────────────────

/** All land hex cube coords. */
export const LAND_COORDS = STANDARD_LAND_HEXES;

/** Set of land hex keys for O(1) lookup. */
const LAND_KEY_SET = new Set(STANDARD_LAND_HEXES.map(cubeKey));

export function isLandHex(coord: CubeCoord): boolean {
  return LAND_KEY_SET.has(cubeKey(coord));
}

/**
 * All vertex IDs on the standard board (derived from all land hexes).
 */
export function allVertexIds(): VertexId[] {
  const seen = new Set<VertexId>();
  for (const hex of STANDARD_LAND_HEXES) {
    for (const v of hexVertexIds(hex)) {
      seen.add(v);
    }
  }
  return Array.from(seen);
}

/**
 * Vertices adjacent (distance-1) to a given vertex that are on the board.
 */
export function boardAdjacentVertices(vertexId: VertexId, board: Board): VertexId[] {
  const all = allVertexIds();
  // Find adjacent hexes: a vertex is in up to 3 hexes
  const result: VertexId[] = [];
  for (const hex of STANDARD_LAND_HEXES) {
    const vIds = hexVertexIds(hex);
    const idx = vIds.indexOf(vertexId);
    if (idx === -1) continue;
    // Neighbors within this hex
    result.push(vIds[(idx + 1) % 6]);
    result.push(vIds[(idx + 5) % 6]);
  }
  return [...new Set(result)].filter((v) => all.includes(v));
}

/**
 * Edge IDs adjacent to a vertex that are on the board.
 */
export function boardAdjacentEdges(vertexId: VertexId): string[] {
  const result = new Set<string>();
  for (const hex of STANDARD_LAND_HEXES) {
    const vIds = hexVertexIds(hex);
    const idx = vIds.indexOf(vertexId);
    if (idx === -1) continue;
    // Edges of this hex touching vertex idx
    const neighbors = CUBE_DIRECTIONS.map((d) => cubeAdd(hex, d));
    // edge idx: between this hex and neighbor[idx]
    // edge (idx+5)%6: between this hex and neighbor[(idx+5)%6]
    [idx, (idx + 5) % 6].forEach((edgeDir) => {
      const neighbor = neighbors[edgeDir];
      // Only add edge if at least one of the hexes is a land hex
      result.add(edgeId(hex, neighbor));
    });
  }
  return Array.from(result);
}

/**
 * Tiles that produce resources for a given vertex (settlement/city location).
 */
export function tilesForVertex(vertexId: VertexId, tiles: Tile[]): Tile[] {
  return tiles.filter((tile) => hexVertexIds(tile.coord).includes(vertexId));
}

/**
 * Returns the port at a given vertex, or undefined if none.
 */
export function portAtVertex(vertexId: VertexId, ports: Port[]): Port | undefined {
  return ports.find((p) => p.vertices.includes(vertexId));
}
