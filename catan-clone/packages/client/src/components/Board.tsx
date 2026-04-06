/**
 * SVG Catan board — renders tiles, roads, settlements/cities, and ports.
 * Click handlers for vertex/edge selection are wired into the store.
 */

import type { ClientGameState, CubeCoord, Tile } from "@catan/shared";
import { STANDARD_LAND_HEXES, hexCornerPixel, hexEdgeIds, hexToPixel, hexVertexIds, cubeKey, edgeVertices, edgeHexKeys } from "@catan/shared";
import { useGameStore } from "../store.js";

// ── Config ────────────────────────────────────────────────────────────────────

const HEX_SIZE = 60;
const SVG_WIDTH = 700;
const SVG_HEIGHT = 650;
const ORIGIN = { x: SVG_WIDTH / 2, y: SVG_HEIGHT / 2 };

const TERRAIN_COLOR: Record<string, string> = {
  wood: "#2d6a2d",
  sheep: "#90c945",
  wheat: "#f5c518",
  ore: "#7a7a7a",
  brick: "#c0522b",
  desert: "#d9b96a",
  sea: "#3a7bd5",
};

const TERRAIN_LABEL: Record<string, string> = {
  wood: "🌲",
  sheep: "🐑",
  wheat: "🌾",
  ore: "⛰️",
  brick: "🧱",
  desert: "🏜️",
};

const PLAYER_COLOR: Record<string, string> = {
  red: "#e74c3c",
  blue: "#2980b9",
  green: "#27ae60",
  orange: "#e67e22",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexCenter(coord: CubeCoord) {
  const { x, y } = hexToPixel(coord, HEX_SIZE);
  return { x: ORIGIN.x + x, y: ORIGIN.y + y };
}

function hexPolygonPoints(coord: CubeCoord): string {
  const center = hexCenter(coord);
  return Array.from({ length: 6 }, (_, i) => {
    const { x, y } = hexCornerPixel(center, HEX_SIZE, i);
    return `${x},${y}`;
  }).join(" ");
}

function vertexPixel(vertexId: string): { x: number; y: number } | null {
  // Find a hex that contains this vertex and get its corner position
  for (const coord of STANDARD_LAND_HEXES) {
    const vIds = hexVertexIds(coord);
    const idx = vIds.indexOf(vertexId);
    if (idx === -1) continue;
    const center = hexCenter(coord);
    return hexCornerPixel(center, HEX_SIZE, idx);
  }
  return null;
}

function parseHexKey(k: string): CubeCoord {
  const [q, r, s] = k.split(",").map(Number);
  return { q, r, s };
}

function edgeEndpoints(edgeId: string): [{ x: number; y: number }, { x: number; y: number }] | null {
  const [h1Key, h2Key] = edgeHexKeys(edgeId);
  const [v1Id, v2Id] = edgeVertices(parseHexKey(h1Key), parseHexKey(h2Key));
  const p1 = vertexPixel(v1Id);
  const p2 = vertexPixel(v2Id);
  if (!p1 || !p2) return null;
  return [p1, p2];
}

function edgeMidpoint(edgeId: string): { x: number; y: number } | null {
  const pts = edgeEndpoints(edgeId);
  if (!pts) return null;
  return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HexTile({ tile }: { tile: Tile }) {
  const points = hexPolygonPoints(tile.coord);
  const center = hexCenter(tile.coord);
  const color = TERRAIN_COLOR[tile.terrain] ?? "#ccc";

  return (
    <g>
      <polygon
        points={points}
        fill={color}
        stroke="#1a1a1a"
        strokeWidth={2}
      />
      <text x={center.x} y={center.y - 8} textAnchor="middle" fontSize={20}>
        {TERRAIN_LABEL[tile.terrain] ?? ""}
      </text>
      {tile.number && (
        <g>
          <circle cx={center.x} cy={center.y + 10} r={13} fill="white" opacity={0.85} />
          <text
            x={center.x}
            y={center.y + 15}
            textAnchor="middle"
            fontSize={13}
            fontWeight="bold"
            fill={tile.number === 6 || tile.number === 8 ? "#c0392b" : "#222"}
          >
            {tile.number}
          </text>
        </g>
      )}
      {tile.hasRobber && (
        <text x={center.x} y={center.y + 35} textAnchor="middle" fontSize={18}>
          🏴‍☠️
        </text>
      )}
    </g>
  );
}

// ── Main Board ────────────────────────────────────────────────────────────────

interface BoardProps {
  state: ClientGameState;
}

export function BoardView({ state }: BoardProps) {
  const { board } = state;
  const { selectedVertexId, selectedEdgeId, selectVertex, selectEdge, sendAction } = useGameStore();

  const myId = state.myPlayerId;
  const isMyTurn = state.players[state.currentPlayerIndex]?.id === myId;
  const turnPhase = state.turnPhase;

  // Collect all unique vertex IDs on the board
  const allVertexIds = new Set<string>();
  const allEdgeIds = new Set<string>();
  for (const hex of STANDARD_LAND_HEXES) {
    hexVertexIds(hex).forEach((v) => allVertexIds.add(v));
    hexEdgeIds(hex).forEach((e) => allEdgeIds.add(e));
  }

  function handleVertexClick(vertexId: string) {
    if (!isMyTurn) return;

    if (state.phase === "setup" && !state.lastSetupSettlementVertex) {
      sendAction({ type: "placeInitialSettlement", vertexId });
    } else if (turnPhase === "postRoll") {
      if (selectedVertexId === vertexId) {
        // Double-click to build
        const building = board.buildings[vertexId];
        if (!building) {
          sendAction({ type: "buildSettlement", vertexId });
        } else if (building.playerId === myId && building.type === "settlement") {
          sendAction({ type: "buildCity", vertexId });
        }
        selectVertex(null);
      } else {
        selectVertex(vertexId);
      }
    }
  }

  function handleEdgeClick(edgeId: string) {
    if (!isMyTurn) return;

    if (state.phase === "setup" && state.lastSetupSettlementVertex) {
      sendAction({ type: "placeInitialRoad", edgeId });
    } else if (turnPhase === "postRoll" || turnPhase === "roadBuilding") {
      if (selectedEdgeId === edgeId) {
        sendAction({ type: "buildRoad", edgeId });
        selectEdge(null);
      } else {
        selectEdge(edgeId);
      }
    }
  }

  return (
    <svg width={SVG_WIDTH} height={SVG_HEIGHT} style={{ background: TERRAIN_COLOR.sea }}>
      {/* Tiles */}
      {board.tiles.map((tile) => (
        <HexTile key={cubeKey(tile.coord)} tile={tile} />
      ))}

      {/* Edges (roads + clickable areas) */}
      {Array.from(allEdgeIds).map((eid) => {
        const pts = edgeEndpoints(eid);
        const mid = pts ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : null;
        if (!pts || !mid) return null;
        const road = board.roads[eid];
        const isSelected = selectedEdgeId === eid;

        return (
          <g key={eid} onClick={() => handleEdgeClick(eid)} style={{ cursor: isMyTurn ? "pointer" : "default" }}>
            {road ? (
              // Draw along actual edge geometry — stable across re-renders
              <line
                x1={pts[0].x}
                y1={pts[0].y}
                x2={pts[1].x}
                y2={pts[1].y}
                stroke={PLAYER_COLOR[road.playerId] ?? "#999"}
                strokeWidth={6}
                strokeLinecap="round"
              />
            ) : (
              <circle
                cx={mid.x}
                cy={mid.y}
                r={7}
                fill={isSelected ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.15)"}
                stroke={isSelected ? "#fff" : "transparent"}
                strokeWidth={2}
              />
            )}
          </g>
        );
      })}

      {/* Vertices (settlements/cities + clickable areas) */}
      {Array.from(allVertexIds).map((vid) => {
        const pos = vertexPixel(vid);
        if (!pos) return null;
        const building = board.buildings[vid];
        const isSelected = selectedVertexId === vid;

        return (
          <g key={vid} onClick={() => handleVertexClick(vid)} style={{ cursor: isMyTurn ? "pointer" : "default" }}>
            {building ? (
              <polygon
                points={
                  building.type === "city"
                    ? `${pos.x},${pos.y - 14} ${pos.x + 12},${pos.y + 7} ${pos.x - 12},${pos.y + 7}`
                    : `${pos.x},${pos.y - 11} ${pos.x + 9},${pos.y + 5} ${pos.x - 9},${pos.y + 5}`
                }
                fill={PLAYER_COLOR[building.playerId] ?? "#999"}
                stroke="#fff"
                strokeWidth={2}
              />
            ) : (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isSelected ? 8 : 5}
                fill={isSelected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)"}
                stroke={isSelected ? "#fff" : "transparent"}
                strokeWidth={2}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
