/**
 * Board generation and query helpers.
 *
 * generateBoard(layout) produces a randomised Board from any BoardLayout.
 * All query functions (adjacency, land checks, etc.) derive the board
 * shape from board.landHexes rather than a hardcoded global.
 */

import type { Board, BoardLayout, CubeCoord, Port, TerrainType, Tile, VertexId } from "./types.js";
import { cubeAdd, cubeKey, edgeId, hexVertexIds, CUBE_DIRECTIONS } from "./hex.js";

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

/**
 * Generate a randomised Board from a layout definition.
 * Retries until number placement satisfies adjacency fairness constraints.
 */
export function generateBoard(layout: BoardLayout): Board {
  let tiles: Tile[] = [];

  for (let attempt = 0; attempt < 500; attempt++) {
    const terrains = shuffle(layout.terrainDistribution);
    const numbers = shuffle(layout.numberDistribution);
    let numberIndex = 0;

    const candidate: Tile[] = layout.landHexes.map((coord, i) => {
      const terrain = terrains[i] as TerrainType;
      const isDesert = terrain === "desert";
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

  const ports: Port[] = layout.ports.map((def) => {
    const vIds = hexVertexIds(def.hex);
    return {
      vertices: [vIds[def.vertexIndices[0]], vIds[def.vertexIndices[1]]],
      resource: def.resource,
      ratio: def.resource === "generic" ? 3 : 2,
    } satisfies Port;
  });

  return {
    tiles,
    buildings: {},
    roads: {},
    ports,
    landHexes: layout.landHexes,
  };
}

// ── Land hex lookups ──────────────────────────────────────────────────────────

/** O(1) land hex lookup keyed by cubeKey. */
function makeLandKeySet(landHexes: CubeCoord[]): Set<string> {
  return new Set(landHexes.map(cubeKey));
}

export function isLandHex(coord: CubeCoord, board: Board): boolean {
  return makeLandKeySet(board.landHexes).has(cubeKey(coord));
}

// ── Vertex helpers ────────────────────────────────────────────────────────────

/** All vertex IDs present on the board (derived from landHexes). */
export function allBoardVertexIds(board: Board): VertexId[] {
  const seen = new Set<VertexId>();
  for (const hex of board.landHexes) {
    for (const v of hexVertexIds(hex)) seen.add(v);
  }
  return Array.from(seen);
}

/**
 * Vertex IDs adjacent (distance-1) to a given vertex, restricted to vertices
 * that exist on the board.
 */
export function boardAdjacentVertices(vertexId: VertexId, board: Board): VertexId[] {
  const all = new Set(allBoardVertexIds(board));
  const result = new Set<VertexId>();

  for (const hex of board.landHexes) {
    const vIds = hexVertexIds(hex);
    const idx = vIds.indexOf(vertexId);
    if (idx === -1) continue;
    result.add(vIds[(idx + 1) % 6]);
    result.add(vIds[(idx + 5) % 6]);
  }

  return Array.from(result).filter((v) => all.has(v));
}

/**
 * Edge IDs adjacent to a vertex that are on the board.
 * Includes coastal edges (land-sea) since roads can be placed along the coast.
 * Sea-sea edges are never returned because we only iterate over land hexes.
 */
export function boardAdjacentEdges(vertexId: VertexId, board: Board): string[] {
  const result = new Set<string>();

  for (const hex of board.landHexes) {
    const vIds = hexVertexIds(hex);
    const idx = vIds.indexOf(vertexId);
    if (idx === -1) continue;

    for (const edgeDir of [idx, (idx + 5) % 6]) {
      const neighbor = cubeAdd(hex, CUBE_DIRECTIONS[edgeDir]);
      result.add(edgeId(hex, neighbor));
    }
  }

  return Array.from(result);
}

// ── Tile helpers ──────────────────────────────────────────────────────────────

/** Tiles adjacent to a vertex (up to 3). */
export function tilesForVertex(vertexId: VertexId, tiles: Tile[]): Tile[] {
  return tiles.filter((tile) => hexVertexIds(tile.coord).includes(vertexId));
}

/** Returns the port at a given vertex, or undefined if none. */
export function portAtVertex(vertexId: VertexId, ports: Port[]): Port | undefined {
  return ports.find((p) => p.vertices.includes(vertexId));
}

// ── Legacy export ─────────────────────────────────────────────────────────────
// Kept for any direct imports; prefer board.landHexes.
export { STANDARD_LAND_HEXES as LAND_COORDS } from "./hex.js";
