/**
 * Move validation — pure functions, no side effects.
 * All functions return true if the move is legal given the current game state.
 */

import type { GameState, Player, Resources, ResourceType, VertexId, EdgeId, CubeCoord } from "./types.js";
import {
  BUILDING_COSTS,
  RESOURCE_TYPES,
  MAX_HAND_SIZE_BEFORE_DISCARD,
} from "./types.js";
import {
  hexVertexIds,
  hexEdgeIds,
  edgeVertices,
  edgeHexKeys,
} from "./hex.js";
import {
  LAND_COORDS,
  boardAdjacentVertices,
  boardAdjacentEdges,
  isLandHex,
} from "./board.js";

// ── Resource helpers ──────────────────────────────────────────────────────────

export function hasResources(player: Player, cost: Partial<Resources>): boolean {
  return RESOURCE_TYPES.every((r) => (player.resources[r] ?? 0) >= (cost[r] ?? 0));
}

export function totalResources(resources: Resources): number {
  return RESOURCE_TYPES.reduce((sum, r) => sum + resources[r], 0);
}

// ── Settlement placement ──────────────────────────────────────────────────────

/**
 * A vertex is a valid settlement location if:
 * 1. No building already exists there.
 * 2. No building exists on any adjacent vertex ("distance rule").
 * 3. The player has a road leading there (not required in setup phase).
 */
export function canPlaceSettlement(
  state: GameState,
  playerId: string,
  vertexId: VertexId,
  ignoreRoadRule = false
): boolean {
  const { board } = state;

  // No building here
  if (board.buildings[vertexId]) return false;

  // Distance rule: no adjacent buildings
  const adjacent = boardAdjacentVertices(vertexId, board);
  if (adjacent.some((v) => board.buildings[v])) return false;

  if (ignoreRoadRule) return true;

  // Must have a road leading here
  const adjEdges = boardAdjacentEdges(vertexId);
  return adjEdges.some((eid) => board.roads[eid]?.playerId === playerId);
}

/**
 * Valid initial settlement vertices (setup phase — no road rule, no other settlements nearby).
 */
export function validInitialSettlementVertices(state: GameState): VertexId[] {
  const allVertices = new Set<VertexId>();
  for (const hex of LAND_COORDS) {
    for (const v of hexVertexIds(hex)) allVertices.add(v);
  }
  return Array.from(allVertices).filter((v) =>
    canPlaceSettlement(state, "", v, true)
  );
}

// ── City upgrade ──────────────────────────────────────────────────────────────

export function canPlaceCity(state: GameState, playerId: string, vertexId: VertexId): boolean {
  const building = state.board.buildings[vertexId];
  return building?.playerId === playerId && building.type === "settlement";
}

// ── Road placement ────────────────────────────────────────────────────────────

/**
 * A road can be placed on an edge if:
 * 1. No road already there.
 * 2. At least one endpoint vertex has the player's building or a connected road,
 *    AND that endpoint is not blocked by an opponent's building.
 * 3. Both hexes of the edge are land (interior edges only).
 */
export function canPlaceRoad(
  state: GameState,
  playerId: string,
  edgeIdStr: EdgeId
): boolean {
  const { board } = state;

  if (board.roads[edgeIdStr]) return false;

  const [h1Key, h2Key] = edgeHexKeys(edgeIdStr);
  const h1 = h1Key.split(",").map(Number);
  const h2 = h2Key.split(",").map(Number);
  const coord1: CubeCoord = { q: h1[0], r: h1[1], s: h1[2] };
  const coord2: CubeCoord = { q: h2[0], r: h2[1], s: h2[2] };

  // Both hexes must be land — roads cannot be placed on coastal edges
  if (!isLandHex(coord1) || !isLandHex(coord2)) return false;

  const [v1, v2] = edgeVertices(coord1, coord2);

  return [v1, v2].some((v) => vertexConnectsRoadForPlayer(state, playerId, v));
}

/**
 * A vertex "connects" for road building if:
 * - The player has a building there, OR
 * - The player has an adjacent road there AND no opponent building blocks it.
 */
function vertexConnectsRoadForPlayer(
  state: GameState,
  playerId: string,
  vertexId: VertexId
): boolean {
  const { board } = state;
  const building = board.buildings[vertexId];

  if (building) {
    return building.playerId === playerId;
  }

  // No building — check for adjacent road (not blocked by opponent)
  const adjEdges = boardAdjacentEdges(vertexId);
  return adjEdges.some((eid) => board.roads[eid]?.playerId === playerId);
}

/**
 * Valid initial road edges after placing first/second settlement in setup.
 */
export function validInitialRoadEdges(
  state: GameState,
  playerId: string,
  settlementVertex: VertexId
): EdgeId[] {
  const adjEdges = boardAdjacentEdges(settlementVertex);
  return adjEdges.filter((eid) => !state.board.roads[eid]);
}

// ── Longest road ──────────────────────────────────────────────────────────────

/**
 * Computes the longest road length for a player using DFS.
 * Roads are "broken" by opponent settlements/cities.
 */
export function longestRoad(state: GameState, playerId: string): number {
  const { board } = state;
  const playerRoads = Object.entries(board.roads)
    .filter(([, r]) => r.playerId === playerId)
    .map(([eid]) => eid);

  if (playerRoads.length === 0) return 0;

  // Build adjacency: edge → adjacent edges (sharing a non-blocked vertex)
  let best = 0;

  function dfs(edgeId: string, visited: Set<string>): number {
    visited.add(edgeId);
    let max = visited.size;

    const [h1Key, h2Key] = edgeHexKeys(edgeId);
    const c1 = h1Key.split(",").map(Number);
    const c2 = h2Key.split(",").map(Number);
    const [v1, v2] = edgeVertices(
      { q: c1[0], r: c1[1], s: c1[2] },
      { q: c2[0], r: c2[1], s: c2[2] }
    );

    for (const v of [v1, v2]) {
      // Check if vertex is blocked by opponent
      const building = board.buildings[v];
      if (building && building.playerId !== playerId) continue;

      // Traverse adjacent roads
      const adjEdges = boardAdjacentEdges(v);
      for (const adjEid of adjEdges) {
        if (!visited.has(adjEid) && board.roads[adjEid]?.playerId === playerId) {
          max = Math.max(max, dfs(adjEid, new Set(visited)));
        }
      }
    }

    return max;
  }

  for (const startEdge of playerRoads) {
    best = Math.max(best, dfs(startEdge, new Set()));
  }

  return best;
}

// ── Bank / Port trading ───────────────────────────────────────────────────────

/**
 * Returns the best trade ratio a player has for a given resource
 * (checking ports at all their settlements/cities).
 */
export function tradeRatioForResource(
  state: GameState,
  playerId: string,
  resource: ResourceType
): number {
  let ratio = 4; // Default bank trade
  const { board } = state;

  for (const [vertexId, building] of Object.entries(board.buildings)) {
    if (building.playerId !== playerId) continue;
    const port = state.board.ports.find((p) => p.vertices.includes(vertexId));
    if (!port) continue;
    if (port.resource === resource) ratio = Math.min(ratio, port.ratio);
    if (port.resource === "generic") ratio = Math.min(ratio, port.ratio);
  }

  return ratio;
}

// ── Victory points ────────────────────────────────────────────────────────────

/** Total VP for a player (including hidden VP dev cards). */
export function calculateVP(state: GameState, player: Player): number {
  let vp = 0;

  for (const [, building] of Object.entries(state.board.buildings)) {
    if (building.playerId !== player.id) continue;
    vp += building.type === "settlement" ? 1 : 2;
  }

  if (player.hasLargestArmy) vp += 2;
  if (player.hasLongestRoad) vp += 2;

  // Count VP dev cards (hidden)
  vp += player.devCards.filter((c) => c === "victoryPoint").length;
  vp += player.devCardsPlayed.filter((c) => c === "victoryPoint").length;

  return vp;
}
