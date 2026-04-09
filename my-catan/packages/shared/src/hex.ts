/**
 * Hex grid math using cube coordinates.
 * Reference: https://www.redblobgames.com/grids/hexagons/
 *
 * Pointy-top orientation used throughout.
 */

import type { CubeCoord, EdgeId, VertexId } from "./types.js";

// ── Directions ────────────────────────────────────────────────────────────────

/** The 6 neighbor directions in cube coordinates (pointy-top, clockwise from NE). */
export const CUBE_DIRECTIONS: CubeCoord[] = [
  { q: 1, r: -1, s: 0 },  // NE
  { q: 1, r: 0, s: -1 },  // E
  { q: 0, r: 1, s: -1 },  // SE
  { q: -1, r: 1, s: 0 },  // SW
  { q: -1, r: 0, s: 1 },  // W
  { q: 0, r: -1, s: 1 },  // NW
];

export function cubeAdd(a: CubeCoord, b: CubeCoord): CubeCoord {
  return { q: a.q + b.q, r: a.r + b.r, s: a.s + b.s };
}

export function cubeEqual(a: CubeCoord, b: CubeCoord): boolean {
  return a.q === b.q && a.r === b.r && a.s === b.s;
}

export function cubeKey(c: CubeCoord): string {
  return `${c.q},${c.r},${c.s}`;
}

export function cubeNeighbors(c: CubeCoord): CubeCoord[] {
  return CUBE_DIRECTIONS.map((d) => cubeAdd(c, d));
}

// ── Vertex IDs ────────────────────────────────────────────────────────────────

/**
 * Each vertex is shared by exactly 3 hexes (or 2 at the board edge).
 * We identify a vertex by the set of hexes that touch it, sorted canonically.
 *
 * For a hex at (q,r,s), the 6 vertices are defined by which pair of
 * adjacent-direction hexes it sits between (pointy-top):
 *
 *   Vertex 0 (top):         NW + NE neighbors
 *   Vertex 1 (top-right):   NE + E  neighbors
 *   Vertex 2 (bottom-right):E  + SE neighbors
 *   Vertex 3 (bottom):      SE + SW neighbors
 *   Vertex 4 (bottom-left): SW + W  neighbors
 *   Vertex 5 (top-left):    W  + NW neighbors
 *
 * The three hexes sharing vertex i of hex h are: h, h+dir[i-1], h+dir[i]
 * (where directions are the 6 cube directions, 0-indexed as above).
 */
const VERTEX_NEIGHBOR_DIRS: [number, number][] = [
  [5, 0], // top:          NW, NE
  [0, 1], // top-right:    NE, E
  [1, 2], // bottom-right: E,  SE
  [2, 3], // bottom:       SE, SW
  [3, 4], // bottom-left:  SW, W
  [4, 5], // top-left:     W,  NW
];

function sortedCubeKeys(...coords: CubeCoord[]): string {
  return coords
    .map(cubeKey)
    .sort()
    .join("|");
}

/**
 * Returns the 6 vertex IDs of a hex, in order (top, going clockwise).
 * Each vertex ID is canonical across all adjacent hexes.
 */
export function hexVertexIds(hex: CubeCoord): VertexId[] {
  return VERTEX_NEIGHBOR_DIRS.map(([d1, d2]) => {
    const n1 = cubeAdd(hex, CUBE_DIRECTIONS[d1]);
    const n2 = cubeAdd(hex, CUBE_DIRECTIONS[d2]);
    return sortedCubeKeys(hex, n1, n2);
  });
}

// ── Edge IDs ──────────────────────────────────────────────────────────────────

/**
 * Each edge is shared by exactly 2 hexes.
 * Edge ID = sorted cube keys of both hexes separated by "||".
 */
export function edgeId(a: CubeCoord, b: CubeCoord): EdgeId {
  const keys = [cubeKey(a), cubeKey(b)].sort();
  return keys.join("||");
}

/**
 * Returns the 6 edge IDs of a hex (one per neighbor direction).
 */
export function hexEdgeIds(hex: CubeCoord): EdgeId[] {
  return CUBE_DIRECTIONS.map((d) => {
    const neighbor = cubeAdd(hex, d);
    return edgeId(hex, neighbor);
  });
}

/**
 * Returns the two vertex IDs at the ends of an edge.
 * An edge between hex A and hex B is flanked by the vertex shared with
 * the neighbor to the "left" and the vertex shared with the neighbor to
 * the "right" (relative to the direction A→B).
 */
export function edgeVertices(a: CubeCoord, b: CubeCoord): [VertexId, VertexId] {
  const diff: CubeCoord = { q: b.q - a.q, r: b.r - a.r, s: b.s - a.s };
  const dirIndex = CUBE_DIRECTIONS.findIndex((d) => cubeEqual(d, diff));
  if (dirIndex === -1) throw new Error(`${cubeKey(a)} and ${cubeKey(b)} are not adjacent`);

  // The two vertices flanking this edge from hex A's perspective:
  // vertex at index dirIndex and vertex at index (dirIndex+1)%6
  const verts = hexVertexIds(a);
  return [verts[dirIndex], verts[(dirIndex + 1) % 6]];
}

/**
 * Returns the two hexes sharing an edge (as cube coord strings).
 * Inverse of edgeId.
 */
export function edgeHexKeys(eid: EdgeId): [string, string] {
  const parts = eid.split("||");
  return [parts[0], parts[1]] as [string, string];
}

// ── Vertex adjacency ──────────────────────────────────────────────────────────

/**
 * Returns all edge IDs adjacent to a vertex.
 * A vertex touches at most 3 edges.
 *
 * We derive this by finding which hex "owns" (is part of) this vertex,
 * then checking which edges of that hex share this vertex.
 */
export function vertexAdjacentEdges(
  vertexId: VertexId,
  allHexCoords: CubeCoord[]
): EdgeId[] {
  const edges = new Set<EdgeId>();
  for (const hex of allHexCoords) {
    const vIds = hexVertexIds(hex);
    const vIndex = vIds.indexOf(vertexId);
    if (vIndex === -1) continue;
    // This hex touches the vertex at vIndex.
    // The two edges of this hex that touch vertex vIndex are:
    // edge towards direction vIndex and edge towards direction (vIndex+5)%6
    const eIds = hexEdgeIds(hex);
    edges.add(eIds[vIndex]);
    edges.add(eIds[(vIndex + 5) % 6]);
  }
  return Array.from(edges);
}

/**
 * Returns all vertex IDs adjacent to a vertex (connected by an edge).
 * A vertex has at most 3 neighbors.
 */
export function vertexAdjacentVertices(
  vertexId: VertexId,
  allHexCoords: CubeCoord[]
): VertexId[] {
  const result = new Set<VertexId>();
  const adjEdges = vertexAdjacentEdges(vertexId, allHexCoords);
  for (const eid of adjEdges) {
    const [h1Key, h2Key] = edgeHexKeys(eid);
    const h1 = keyToCoord(h1Key);
    const h2 = keyToCoord(h2Key);
    const [v1, v2] = edgeVertices(h1, h2);
    if (v1 !== vertexId) result.add(v1);
    if (v2 !== vertexId) result.add(v2);
  }
  return Array.from(result);
}

function keyToCoord(key: string): CubeCoord {
  const [q, r, s] = key.split(",").map(Number);
  return { q, r, s };
}

// ── SVG pixel positions (pointy-top) ──────────────────────────────────────────

/**
 * Returns the pixel center of a hex given its cube coord and the hex size
 * (distance from center to middle of a flat edge).
 */
export function hexToPixel(hex: CubeCoord, size: number): { x: number; y: number } {
  const x = size * (Math.sqrt(3) * hex.q + (Math.sqrt(3) / 2) * hex.r);
  const y = size * ((3 / 2) * hex.r);
  return { x, y };
}

/**
 * Pixel position of vertex i (0–5) of a hex, clockwise from top.
 */
export function hexCornerPixel(
  hexCenter: { x: number; y: number },
  size: number,
  cornerIndex: number
): { x: number; y: number } {
  // Pointy-top: angle offset of 30°, step 60°
  const angleDeg = 60 * cornerIndex - 30;
  const angleRad = (Math.PI / 180) * angleDeg;
  return {
    x: hexCenter.x + size * Math.cos(angleRad),
    y: hexCenter.y + size * Math.sin(angleRad),
  };
}

// ── Standard board hex coordinates ───────────────────────────────────────────

/**
 * The 19 land hex cube coordinates for the standard Catan board.
 */
export const STANDARD_LAND_HEXES: CubeCoord[] = [
  // Row 0 (3 hexes)
  { q: 0, r: -2, s: 2 }, { q: 1, r: -2, s: 1 }, { q: 2, r: -2, s: 0 },
  // Row 1 (4 hexes)
  { q: -1, r: -1, s: 2 }, { q: 0, r: -1, s: 1 }, { q: 1, r: -1, s: 0 }, { q: 2, r: -1, s: -1 },
  // Row 2 (5 hexes — center row)
  { q: -2, r: 0, s: 2 }, { q: -1, r: 0, s: 1 }, { q: 0, r: 0, s: 0 }, { q: 1, r: 0, s: -1 }, { q: 2, r: 0, s: -2 },
  // Row 3 (4 hexes)
  { q: -2, r: 1, s: 1 }, { q: -1, r: 1, s: 0 }, { q: 0, r: 1, s: -1 }, { q: 1, r: 1, s: -2 },
  // Row 4 (3 hexes)
  { q: -2, r: 2, s: 0 }, { q: -1, r: 2, s: -1 }, { q: 0, r: 2, s: -2 },
];
