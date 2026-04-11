/**
 * Move validation — pure functions, no side effects.
 * All functions return true if the move is legal given the current game state.
 */

import type { GameState, Player, Resources, ResourceType, VertexId, EdgeId, CubeCoord } from "./types.js";
import { BUILDING_COSTS, RESOURCE_TYPES, MAX_HAND_SIZE_BEFORE_DISCARD } from "./types.js";
import { hexVertexIds, edgeVertices, edgeHexKeys } from "./hex.js";
import {
  allBoardVertexIds,
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
 * 3. The player has a road leading there (waived during setup).
 */
export function canPlaceSettlement(
  state: GameState,
  playerId: string,
  vertexId: VertexId,
  ignoreRoadRule = false
): boolean {
  const { board } = state;

  if (board.buildings[vertexId]) return false;

  const adjacent = boardAdjacentVertices(vertexId, board);
  if (adjacent.some((v) => board.buildings[v])) return false;

  if (ignoreRoadRule) return true;

  const adjEdges = boardAdjacentEdges(vertexId, board);
  return adjEdges.some((eid) => board.roads[eid]?.playerId === playerId);
}

/** Valid initial settlement vertices: no road rule, just distance rule. */
export function validInitialSettlementVertices(state: GameState): VertexId[] {
  return allBoardVertexIds(state.board).filter((v) =>
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
 * 2. Both hexes of the edge are land (no coastal roads).
 * 3. At least one endpoint vertex connects to the player's network,
 *    and that endpoint is not blocked by an opponent building.
 */
export function canPlaceRoad(
  state: GameState,
  playerId: string,
  edgeIdStr: EdgeId
): boolean {
  const { board } = state;

  if (board.roads[edgeIdStr]) return false;

  const [h1Key, h2Key] = edgeHexKeys(edgeIdStr);
  const parse = (k: string): CubeCoord => {
    const [q, r, s] = k.split(",").map(Number);
    return { q, r, s };
  };
  const coord1 = parse(h1Key);
  const coord2 = parse(h2Key);

  // At least one hex must be land (coastal edges bordering one sea hex are valid)
  if (!isLandHex(coord1, board) && !isLandHex(coord2, board)) return false;

  const [v1, v2] = edgeVertices(coord1, coord2);
  return [v1, v2].some((v) => vertexConnectsRoadForPlayer(state, playerId, v));
}

/**
 * A vertex "connects" for a player's road if:
 * - The player has a building there, OR
 * - The player has an adjacent road and no opponent building blocks it.
 */
function vertexConnectsRoadForPlayer(
  state: GameState,
  playerId: string,
  vertexId: VertexId
): boolean {
  const { board } = state;
  const building = board.buildings[vertexId];

  if (building) return building.playerId === playerId;

  const adjEdges = boardAdjacentEdges(vertexId, board);
  return adjEdges.some((eid) => board.roads[eid]?.playerId === playerId);
}

/** Valid initial road edges adjacent to a just-placed setup settlement. */
export function validInitialRoadEdges(
  state: GameState,
  playerId: string,
  settlementVertex: VertexId
): EdgeId[] {
  return boardAdjacentEdges(settlementVertex, state.board).filter(
    (eid) => !state.board.roads[eid]
  );
}

// ── Longest road ──────────────────────────────────────────────────────────────

/**
 * Computes the longest road for a player using DFS.
 * Roads are broken by opponent settlements/cities.
 */
export function longestRoad(state: GameState, playerId: string): number {
  const { board } = state;
  const playerRoads = Object.keys(board.roads).filter(
    (eid) => board.roads[eid].playerId === playerId
  );

  if (playerRoads.length === 0) return 0;

  let best = 0;

  function dfs(edgeId: string, visited: Set<string>): number {
    visited.add(edgeId);
    let max = visited.size;

    const [h1Key, h2Key] = edgeHexKeys(edgeId);
    const parse = (k: string): CubeCoord => {
      const [q, r, s] = k.split(",").map(Number);
      return { q, r, s };
    };
    const [v1, v2] = edgeVertices(parse(h1Key), parse(h2Key));

    for (const v of [v1, v2]) {
      const building = board.buildings[v];
      if (building && building.playerId !== playerId) continue;

      for (const adjEid of boardAdjacentEdges(v, board)) {
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

/** Returns the best trade ratio a player has for a given resource. */
export function tradeRatioForResource(
  state: GameState,
  playerId: string,
  resource: ResourceType
): number {
  let ratio = 4;
  const { board } = state;

  for (const [vertexId, building] of Object.entries(board.buildings)) {
    if (building.playerId !== playerId) continue;
    const port = board.ports.find((p) => p.vertices.includes(vertexId));
    if (!port) continue;
    if (port.resource === resource || port.resource === "generic") {
      ratio = Math.min(ratio, port.ratio);
    }
  }

  return ratio;
}

// ── Victory points ────────────────────────────────────────────────────────────

/** Total VP for a player (including hidden VP dev cards). */
export function calculateVP(state: GameState, player: Player): number {
  let vp = 0;

  for (const building of Object.values(state.board.buildings)) {
    if (building.playerId !== player.id) continue;
    vp += building.type === "settlement" ? 1 : 2;
  }

  if (player.hasLargestArmy) vp += 2;
  if (player.hasLongestRoad) vp += 2;

  vp += player.devCards.filter((c) => c === "victoryPoint").length;
  vp += player.devCardsPlayed.filter((c) => c === "victoryPoint").length;

  return vp;
}
