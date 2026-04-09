/**
 * SVG Catan board — renders tiles, roads, settlements/cities, and ports.
 * Click handlers for vertex/edge selection are wired into the store.
 */

import React, { useMemo, useEffect, useState, useRef } from "react";
import type { Board, ClientGameState, CubeCoord, Port, Tile } from "@hexlands/shared";
import { STANDARD_LAND_HEXES, hexCornerPixel, hexEdgeIds, hexToPixel, hexVertexIds, cubeKey, edgeVertices, edgeHexKeys, boardAdjacentEdges, canPlaceSettlement, canPlaceCity, canPlaceRoad, validInitialSettlementVertices, validInitialRoadEdges } from "@hexlands/shared";
import { useGameStore } from "../store.js";
import { triggerFlight } from "../flightBus.js";

// ── Config ────────────────────────────────────────────────────────────────────

const HEX_SIZE = 60;
const ORIGIN = { x: 350, y: 325 };

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

const PORT_COLOR: Record<string, string> = {
  wood: "#2d6a2d",
  sheep: "#90c945",
  wheat: "#f5c518",
  ore: "#7a7a7a",
  brick: "#c0522b",
  generic: "#c8a96e",
};

const PORT_EMOJI: Record<string, string> = {
  wood: "🌲", sheep: "🐑", wheat: "🌾", ore: "⛰️", brick: "🧱", generic: "🚢",
};

const PLAYER_COLOR: Record<string, string> = {
  red: "#e74c3c",
  blue: "#2980b9",
  green: "#27ae60",
  orange: "#e67e22",
};

// Inner (centre) and outer (edge) stops for each terrain's radial gradient
const TERRAIN_GRADIENT: Record<string, [string, string]> = {
  wood:   ["#4a9050", "#1a4420"],
  sheep:  ["#cef08a", "#60a828"],
  wheat:  ["#fce060", "#bf9010"],
  ore:    ["#b0b0b0", "#424242"],
  brick:  ["#d8663e", "#8a2c0e"],
  desert: ["#f4dc94", "#b09838"],
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
  // Find a hex that contains this vertex and get its corner position.
  // hexVertexIds index i (0=top, 1=top-right, …) maps to hexCornerPixel
  // index (i+5)%6 because hexCornerPixel starts at -30° (top-right) not -90° (top).
  for (const coord of STANDARD_LAND_HEXES) {
    const vIds = hexVertexIds(coord);
    const idx = vIds.indexOf(vertexId);
    if (idx === -1) continue;
    const center = hexCenter(coord);
    return hexCornerPixel(center, HEX_SIZE, (idx + 5) % 6);
  }
  return null;
}

type Point = { x: number; y: number };

function edgeEndpoints(edgeId: string): { p1: Point; p2: Point; mid: Point } | null {
  const [h1Key, h2Key] = edgeHexKeys(edgeId);
  const parse = (k: string) => { const [q, r, s] = k.split(",").map(Number); return { q, r, s }; };
  const [v1Id, v2Id] = edgeVertices(parse(h1Key), parse(h2Key));
  const p1 = vertexPixel(v1Id);
  const p2 = vertexPixel(v2Id);
  if (!p1 || !p2) return null;
  return { p1, p2, mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } };
}

/** DFS returning the edge IDs that form the longest road chain for a player. */
function longestRoadEdges(board: Board, playerId: string): Set<string> {
  const playerRoads = Object.entries(board.roads)
    .filter(([, r]) => r.playerId === playerId)
    .map(([eid]) => eid);
  if (playerRoads.length === 0) return new Set();

  function dfs(edgeId: string, visited: Set<string>): Set<string> {
    const current = new Set(visited);
    current.add(edgeId);
    let best = new Set(current);

    const [h1Key, h2Key] = edgeHexKeys(edgeId);
    const parse = (k: string) => { const [q, r, s] = k.split(",").map(Number); return { q, r, s }; };
    const [v1, v2] = edgeVertices(parse(h1Key), parse(h2Key));

    for (const v of [v1, v2]) {
      const building = board.buildings[v];
      if (building && building.playerId !== playerId) continue;
      for (const adjEid of boardAdjacentEdges(v)) {
        if (!current.has(adjEid) && board.roads[adjEid]?.playerId === playerId) {
          const result = dfs(adjEid, current);
          if (result.size > best.size) best = result;
        }
      }
    }
    return best;
  }

  let best = new Set<string>();
  for (const startEdge of playerRoads) {
    const result = dfs(startEdge, new Set());
    if (result.size > best.size) best = result;
  }
  return best;
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Returns the 4 corner points of a rectangle from `from` to `to` with given half-width. */
function plankPoints(from: Point, to: Point, halfW: number): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const nx = (-dy / d) * halfW;
  const ny = (dx / d) * halfW;
  return [
    `${from.x + nx},${from.y + ny}`,
    `${to.x + nx},${to.y + ny}`,
    `${to.x - nx},${to.y - ny}`,
    `${from.x - nx},${from.y - ny}`,
  ].join(" ");
}

function PortMarker({ port }: { port: Port }) {
  const p1 = vertexPixel(port.vertices[0]);
  const p2 = vertexPixel(port.vertices[1]);
  if (!p1 || !p2) return null;

  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

  // Perpendicular direction pushed outward (away from board centre)
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const perp = { x: -dy / len, y: dx / len };
  const toCenter = { x: ORIGIN.x - mid.x, y: ORIGIN.y - mid.y };
  const outward = (perp.x * toCenter.x + perp.y * toCenter.y) < 0 ? perp : { x: -perp.x, y: -perp.y };
  const PUSH = 30;
  const badge = { x: mid.x + outward.x * PUSH, y: mid.y + outward.y * PUSH };

  const color = PORT_COLOR[port.resource] ?? "#aaa";
  const PLANK = "#b8915a";

  return (
    <g>
      {/* Two dock planks from each coast vertex to the port badge */}
      <polygon points={plankPoints(p1, badge, 3)} fill={PLANK} opacity={0.9} />
      <polygon points={plankPoints(p2, badge, 3)} fill={PLANK} opacity={0.9} />
      {/* Port badge: rounded rectangle */}
      <rect x={badge.x - 16} y={badge.y - 24} width={32} height={48} rx={6} fill={color} stroke="#fff" strokeWidth={1.5} opacity={0.95} />
      <text x={badge.x} y={badge.y - 13} textAnchor="middle" dominantBaseline="middle" fontSize={14}>⚓</text>
      <text x={badge.x} y={badge.y + 2} textAnchor="middle" dominantBaseline="middle" fontSize={13}>{PORT_EMOJI[port.resource]}</text>
      <text x={badge.x} y={badge.y + 17} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#fff" fontWeight="bold">{port.ratio}:1</text>
    </g>
  );
}

function HexTile({ tile, onClick, animDelay, skipAnim, activated }: { tile: Tile; onClick?: () => void; animDelay: number; skipAnim: boolean; activated: boolean }) {
  const points = hexPolygonPoints(tile.coord);
  const center = hexCenter(tile.coord);
  const color = TERRAIN_COLOR[tile.terrain] ?? "#ccc";

  const flipBase: React.CSSProperties = skipAnim ? {} : {
    transformBox: "fill-box",
    transformOrigin: "center",
    animationDuration: "0.8s",
    animationTimingFunction: "ease-in-out",
    animationFillMode: "both",
    animationDelay: `${animDelay}ms`,
  };

  return (
    <g onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      {/* Back face — only shown during the flip animation */}
      {!skipAnim && (
        <polygon
          points={points}
          fill="#5c3317"
          stroke="#1a1a1a"
          strokeWidth={2}
          style={{ ...flipBase, animationName: "hexFlipBack" }}
        />
      )}
      {/* Front face */}
      <g style={skipAnim ? undefined : { ...flipBase, animationName: "hexFlipFront" }}>
        <polygon points={points} fill={`url(#grad-${tile.terrain})`} stroke="#1a1a1a" strokeWidth={2} />
        <text x={center.x} y={center.y - 8} textAnchor="middle" fontSize={20}>
          {TERRAIN_LABEL[tile.terrain] ?? ""}
        </text>
        {tile.number && (() => {
          const n = 6 - Math.abs(7 - tile.number);
          const isHot = tile.number === 6 || tile.number === 8;
          const dotColor = isHot ? "#c0392b" : "#444";
          const dotSpacing = 6;
          const dotY = center.y + 27;
          const dotStartX = center.x - ((n - 1) * dotSpacing) / 2;
          return (
            <g>
              {/* Glow halo around the token when this number is rolled */}
              {activated && (
                <rect
                  x={center.x - 21} y={center.y - 1}
                  width={42} height={36} rx={8}
                  fill="rgba(255,220,50,0.3)"
                  stroke="#f0c040"
                  strokeWidth={3}
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    animation: "tokenGlow 1.8s ease-in-out both",
                    pointerEvents: "none",
                  }}
                />
              )}
              <g filter="url(#token-shadow)">
                <rect x={center.x - 16} y={center.y + 3} width={32} height={28} rx={5} fill="white" opacity={0.92} />
                <text
                  x={center.x} y={center.y + 14}
                  textAnchor="middle" fontSize={13} fontWeight="bold" dominantBaseline="middle"
                  fill={isHot ? "#c0392b" : "#222"}
                >
                  {tile.number}
                </text>
                {Array.from({ length: n }, (_, i) => (
                  <circle key={i} cx={dotStartX + i * dotSpacing} cy={dotY} r={2.5} fill={dotColor} />
                ))}
              </g>
            </g>
          );
        })()}
        {tile.hasRobber && (
          <g>
            <circle cx={center.x} cy={center.y + 22} r={16} fill="rgba(0,0,0,0.55)" />
            <text x={center.x} y={center.y + 22} textAnchor="middle" dominantBaseline="middle" fontSize={20}>🥷</text>
          </g>
        )}
        {/* Red X rises when this tile's number is rolled but the robber blocks production */}
        {activated && tile.hasRobber && (
          <text
            x={center.x} y={center.y - 5}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={32} fontWeight="bold" fill="#e74c3c"
            style={{
              transformBox: "fill-box",
              transformOrigin: "center bottom",
              animation: "resourceRise 1.4s ease-out both",
              pointerEvents: "none",
            }}
          >
            ✕
          </text>
        )}
      </g>
    </g>
  );
}

// ── Confirm overlay ───────────────────────────────────────────────────────────

function ConfirmAction({ pos, onConfirm, onCancel }: { pos: Point; onConfirm: () => void; onCancel: () => void }) {
  const R = 14;
  const gap = 22;
  return (
    <g>
      <g onClick={(e) => { e.stopPropagation(); onConfirm(); }} style={{ cursor: "pointer" }}>
        <circle cx={pos.x + gap} cy={pos.y - gap} r={R} fill="#27ae60" stroke="#fff" strokeWidth={2} />
        <text x={pos.x + gap} y={pos.y - gap + 5} textAnchor="middle" fontSize={15} fontWeight="bold" fill="white">✓</text>
      </g>
      <g onClick={(e) => { e.stopPropagation(); onCancel(); }} style={{ cursor: "pointer" }}>
        <circle cx={pos.x - gap} cy={pos.y - gap} r={R} fill="#e74c3c" stroke="#fff" strokeWidth={2} />
        <text x={pos.x - gap} y={pos.y - gap + 5} textAnchor="middle" fontSize={15} fontWeight="bold" fill="white">✕</text>
      </g>
    </g>
  );
}

// ── Main Board ────────────────────────────────────────────────────────────────

interface BoardProps {
  state: ClientGameState;
}

export function BoardView({ state }: BoardProps) {
  const { board } = state;
  const { selectedVertexId, selectedEdgeId, selectVertex, selectEdge, sendAction, hoveredRoadPlayerId } = useGameStore();

  // Tile pulse + resource flights after dice settle
  const svgRef = useRef<SVGSVGElement>(null);
  const prevDiceKey = useRef("");
  const [activatedNumber, setActivatedNumber] = useState<number | null>(null);
  useEffect(() => {
    if (!state.dice) return;
    const key = JSON.stringify(state.dice);
    if (key === prevDiceKey.current) return;
    prevDiceKey.current = key;
    const sum = state.dice[0] + state.dice[1];

    const settle = setTimeout(() => {
      setActivatedNumber(sum);

      // Fire resource flights for every building on an activated tile
      const svg = svgRef.current;
      if (!svg) return;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;

      for (const tile of board.tiles) {
        if (tile.number !== sum || !TERRAIN_LABEL[tile.terrain] || tile.hasRobber) continue;

        const c = hexCenter(tile.coord);
        const pt = svg.createSVGPoint();
        pt.x = c.x; pt.y = c.y;
        const sp = pt.matrixTransform(ctm);

        const owners = new Set<string>();
        for (const vid of hexVertexIds(tile.coord)) {
          const b = board.buildings[vid];
          if (b) owners.add(b.playerId);
        }

        owners.forEach((ownerId) => {
          const targetEl = document.querySelector(`[data-player-resources="${ownerId}"]`);
          if (!targetEl) return;
          const rect = targetEl.getBoundingClientRect();
          triggerFlight({
            id: `${cubeKey(tile.coord)}-${ownerId}-${Date.now()}-${Math.random()}`,
            emoji: TERRAIN_LABEL[tile.terrain],
            fromX: sp.x,
            fromY: sp.y,
            toX: rect.left + rect.width / 2,
            toY: rect.top + rect.height / 2,
          });
        });
      }
    }, 700);

    const clear = setTimeout(() => setActivatedNumber(null), 2700);
    return () => { clearTimeout(settle); clearTimeout(clear); };
  }, [state.dice]);

  const myId = state.myPlayerId;
  const isMyTurn = state.players[state.currentPlayerIndex]?.id === myId;
  const playerColors: Record<string, string> = Object.fromEntries(
    state.players.map((p) => [p.id, PLAYER_COLOR[p.color] ?? "#999"])
  );
  const turnPhase = state.turnPhase;

  // Robber placement — two-step: select tile then confirm
  const [selectedRobberCoord, setSelectedRobberCoord] = useState<CubeCoord | null>(null);
  useEffect(() => {
    if (turnPhase !== "movingRobber") setSelectedRobberCoord(null);
  }, [turnPhase]);

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
      selectVertex(vertexId);
    } else if (turnPhase === "postRoll") {
      selectVertex(vertexId);
    }
  }

  function handleEdgeClick(edgeId: string) {
    if (!isMyTurn) return;
    if (state.phase === "setup" && state.lastSetupSettlementVertex) {
      selectEdge(edgeId);
    } else if (turnPhase === "postRoll" || turnPhase === "roadBuilding") {
      selectEdge(edgeId);
    }
  }

  function confirmVertex() {
    if (!selectedVertexId) return;
    if (state.phase === "setup" && !state.lastSetupSettlementVertex) {
      sendAction({ type: "placeInitialSettlement", vertexId: selectedVertexId });
    } else if (turnPhase === "postRoll") {
      const building = board.buildings[selectedVertexId];
      if (!building) {
        sendAction({ type: "buildSettlement", vertexId: selectedVertexId });
      } else if (building.playerId === myId && building.type === "settlement") {
        sendAction({ type: "buildCity", vertexId: selectedVertexId });
      }
    }
  }

  function confirmEdge() {
    if (!selectedEdgeId) return;
    if (state.phase === "setup" && state.lastSetupSettlementVertex) {
      sendAction({ type: "placeInitialRoad", edgeId: selectedEdgeId });
    } else if (turnPhase === "postRoll" || turnPhase === "roadBuilding") {
      sendAction({ type: "buildRoad", edgeId: selectedEdgeId });
    }
  }

  // Longest road highlight
  const highlightedRoadEdges = useMemo(
    () => hoveredRoadPlayerId ? longestRoadEdges(board, hoveredRoadPlayerId) : new Set<string>(),
    [hoveredRoadPlayerId, board],
  );

  // Valid placement highlights — only computed when it's my turn
  const validVertexIds = useMemo<Set<string>>(() => {
    if (!isMyTurn) return new Set();
    if (state.phase === "setup" && !state.lastSetupSettlementVertex) {
      return new Set(validInitialSettlementVertices(state as any));
    }
    if (state.phase === "main" && turnPhase === "postRoll") {
      const result = new Set<string>();
      for (const vid of allVertexIds) {
        if (canPlaceSettlement(state as any, myId, vid) || canPlaceCity(state as any, myId, vid)) {
          result.add(vid);
        }
      }
      return result;
    }
    return new Set();
  }, [isMyTurn, state, turnPhase, allVertexIds, myId]);

  const validEdgeIds = useMemo<Set<string>>(() => {
    if (!isMyTurn) return new Set();
    if (state.phase === "setup" && state.lastSetupSettlementVertex) {
      return new Set(validInitialRoadEdges(state as any, myId, state.lastSetupSettlementVertex));
    }
    if (state.phase === "main" && (turnPhase === "postRoll" || turnPhase === "roadBuilding")) {
      const result = new Set<string>();
      for (const eid of allEdgeIds) {
        if (canPlaceRoad(state as any, myId, eid)) result.add(eid);
      }
      return result;
    }
    return new Set();
  }, [isMyTurn, state, turnPhase, allEdgeIds, myId]);

  // Stable fingerprint of the board layout — changes only on restart/new game
  const boardFingerprint = board.tiles.map((t) => t.terrain + (t.number ?? "")).join("");

  // Detect reconnect: if we've seen this exact board before (stored in localStorage),
  // skip the flip animation so tiles appear face-up immediately.
  // useMemo re-evaluates when boardFingerprint changes (new game / restart),
  // so restarts correctly get skipAnim=false even mid-session.
  const skipAnim = useMemo(
    () => localStorage.getItem("catan_board_fp") === boardFingerprint,
    [boardFingerprint],
  );
  useEffect(() => {
    localStorage.setItem("catan_board_fp", boardFingerprint);
  }, [boardFingerprint]);

  // Compute tight viewBox from all rendered tiles
  const allCorners = board.tiles.flatMap((tile) => {
    const center = hexCenter(tile.coord);
    return Array.from({ length: 6 }, (_, i) => hexCornerPixel(center, HEX_SIZE, i));
  });
  const xs = allCorners.map((p) => p.x);
  const ys = allCorners.map((p) => p.y);
  const PAD_H = 55;
  const PAD_TOP = 75;   // extra water above to push hexes down
  const PAD_BOTTOM = 35;
  const vx = Math.min(...xs) - PAD_H;
  const vy = Math.min(...ys) - PAD_TOP;
  const vw = Math.max(...xs) - vx + PAD_H * 2;
  const vh = Math.max(...ys) - vy + PAD_BOTTOM;

  return (
    <svg
      ref={svgRef}
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", display: "block", background: TERRAIN_COLOR.sea }}
    >
      <defs>
        {/* Radial gradient per terrain: lighter centre → darker edge */}
        {Object.entries(TERRAIN_GRADIENT).map(([terrain, [inner, outer]]) => (
          <radialGradient key={terrain} id={`grad-${terrain}`} cx="50%" cy="50%" r="55%" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor={inner} />
            <stop offset="100%" stopColor={outer} />
          </radialGradient>
        ))}
        {/* Drop shadow for number tokens */}
        <filter id="token-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.45)" />
        </filter>
        {/* Animated sea wave pattern */}
        <pattern id="sea-waves" x="0" y="0" width="80" height="40" patternUnits="userSpaceOnUse">
          <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="80 0" dur="9s" repeatCount="indefinite" />
          <path d="M-80 13 Q-60 6 -40 13 Q-20 20 0 13 Q20 6 40 13 Q60 20 80 13 Q100 6 120 13 Q140 20 160 13" stroke="rgba(255,255,255,0.11)" strokeWidth="2" fill="none" />
          <path d="M-80 27 Q-60 21 -40 27 Q-20 33 0 27 Q20 21 40 27 Q60 33 80 27 Q100 21 120 27 Q140 33 160 27" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" />
        </pattern>
      </defs>
      {/* Animated sea wave overlay */}
      <rect x={vx} y={vy} width={vw} height={vh} fill="url(#sea-waves)" />
      {/* Tiles */}
      {board.tiles.map((tile, index) => {
        const isRobberTarget = isMyTurn && turnPhase === "movingRobber" && tile.terrain !== "sea" && !tile.hasRobber;
        return (
          <HexTile
            key={`${boardFingerprint}-${cubeKey(tile.coord)}`}
            tile={tile}
            animDelay={index * 60}
            skipAnim={skipAnim}
            activated={activatedNumber !== null && tile.number === activatedNumber}
            onClick={isRobberTarget ? () => setSelectedRobberCoord(tile.coord) : undefined}
          />
        );
      })}

      {/* Robber placement circles — one per valid target tile */}
      {isMyTurn && turnPhase === "movingRobber" && board.tiles
        .filter((tile) => tile.terrain !== "sea" && !tile.hasRobber)
        .map((tile) => {
          const c = hexCenter(tile.coord);
          const key = cubeKey(tile.coord);
          const isSelected = selectedRobberCoord !== null && cubeKey(selectedRobberCoord) === key;
          return (
            <circle
              key={key}
              cx={c.x} cy={c.y} r={isSelected ? 18 : 14}
              fill={isSelected ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)"}
              stroke={isSelected ? "#fff" : "rgba(255,255,255,0.6)"}
              strokeWidth={2}
              style={{ cursor: "pointer" }}
              onClick={() => setSelectedRobberCoord(tile.coord)}
            />
          );
        })
      }

      {/* Ports */}
      {board.ports.map((port, i) => (
        <PortMarker key={i} port={port} />
      ))}

      {/* Edges (roads + clickable areas) */}
      {Array.from(allEdgeIds).map((eid) => {
        const ep = edgeEndpoints(eid);
        if (!ep) return null;
        const { p1, p2, mid } = ep;
        const road = board.roads[eid];
        const isSelected = selectedEdgeId === eid;

        // Roads run the full edge so connected roads are clearly joined
        const rx1 = p1.x;
        const ry1 = p1.y;
        const rx2 = p2.x;
        const ry2 = p2.y;

        const isHighlighted = highlightedRoadEdges.has(eid);
        return (
          <g key={eid} onClick={() => handleEdgeClick(eid)} style={{ cursor: isMyTurn ? "pointer" : "default" }}>
            {/* Wide invisible hit area */}
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={14} />
            {road ? (
              <>
                {/* Glow layer behind the road when highlighted */}
                {isHighlighted && (
                  <line x1={rx1} y1={ry1} x2={rx2} y2={ry2}
                    stroke="#fff" strokeWidth={12} strokeLinecap="round" opacity={0.5} />
                )}
                <line
                  x1={rx1} y1={ry1} x2={rx2} y2={ry2}
                  stroke={playerColors[road.playerId] ?? "#999"}
                  strokeWidth={isHighlighted ? 8 : 6}
                  strokeLinecap="round"
                />
              </>
            ) : validEdgeIds.has(eid) ? (
              <circle
                cx={mid.x} cy={mid.y} r={5}
                fill={isSelected ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)"}
                stroke={isSelected ? "#fff" : "rgba(255,255,255,0.5)"}
                strokeWidth={1.5}
              />
            ) : null}
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
              building.type === "city" ? (
                <path
                  d={`M ${pos.x-13},${pos.y+9} L ${pos.x-13},${pos.y-13} L ${pos.x-10},${pos.y-13} L ${pos.x-10},${pos.y-3} L ${pos.x-7},${pos.y-3} L ${pos.x-7},${pos.y-13} L ${pos.x-4},${pos.y-13} L ${pos.x-4},${pos.y-1} L ${pos.x-4},${pos.y-8} L ${pos.x-1},${pos.y-8} L ${pos.x-1},${pos.y-1} L ${pos.x+1},${pos.y-1} L ${pos.x+1},${pos.y-8} L ${pos.x+4},${pos.y-8} L ${pos.x+4},${pos.y-1} L ${pos.x+4},${pos.y-3} L ${pos.x+4},${pos.y-13} L ${pos.x+7},${pos.y-13} L ${pos.x+7},${pos.y-3} L ${pos.x+10},${pos.y-3} L ${pos.x+10},${pos.y-13} L ${pos.x+13},${pos.y-13} L ${pos.x+13},${pos.y+9} L ${pos.x+2.5},${pos.y+9} L ${pos.x+2.5},${pos.y+4} Q ${pos.x},${pos.y+1} ${pos.x-2.5},${pos.y+4} L ${pos.x-2.5},${pos.y+9} Z`}
                  fill={playerColors[building.playerId] ?? "#999"}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              ) : (
                <polygon
                  points={`${pos.x},${pos.y-12} ${pos.x+9},${pos.y-3} ${pos.x+9},${pos.y+7} ${pos.x-9},${pos.y+7} ${pos.x-9},${pos.y-3}`}
                  fill={playerColors[building.playerId] ?? "#999"}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              )
            ) : validVertexIds.has(vid) ? (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isSelected ? 8 : 5}
                fill={isSelected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)"}
                stroke={isSelected ? "#fff" : "rgba(255,255,255,0.5)"}
                strokeWidth={1.5}
              />
            ) : null}
          </g>
        );
      })}

      {/* Robber-blocked building indicators — semi-transparent ✕ over each building on the selected tile */}
      {selectedRobberCoord && hexVertexIds(selectedRobberCoord).flatMap((vid) => {
        const building = board.buildings[vid];
        if (!building) return [];
        const bpos = vertexPixel(vid);
        if (!bpos) return [];
        const S = 8;
        return [(
          <g key={`robber-block-${vid}`} pointerEvents="none">
            <line x1={bpos.x - S} y1={bpos.y - S} x2={bpos.x + S} y2={bpos.y + S} stroke="#e74c3c" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
            <line x1={bpos.x + S} y1={bpos.y - S} x2={bpos.x - S} y2={bpos.y + S} stroke="#e74c3c" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
          </g>
        )];
      })}

      {/* Vertex confirmation */}
      {selectedVertexId && (() => {
        const pos = vertexPixel(selectedVertexId);
        if (!pos) return null;
        return <ConfirmAction pos={pos} onConfirm={confirmVertex} onCancel={() => selectVertex(null)} />;
      })()}

      {/* Edge confirmation */}
      {selectedEdgeId && (() => {
        const ep = edgeEndpoints(selectedEdgeId);
        if (!ep) return null;
        return <ConfirmAction pos={ep.mid} onConfirm={confirmEdge} onCancel={() => selectEdge(null)} />;
      })()}

      {/* Robber placement confirmation */}
      {selectedRobberCoord && (() => {
        const c = hexCenter(selectedRobberCoord);
        return (
          <ConfirmAction
            pos={c}
            onConfirm={() => {
              sendAction({ type: "moveRobber", coord: selectedRobberCoord });
              setSelectedRobberCoord(null);
            }}
            onCancel={() => setSelectedRobberCoord(null)}
          />
        );
      })()}
    </svg>
  );
}
