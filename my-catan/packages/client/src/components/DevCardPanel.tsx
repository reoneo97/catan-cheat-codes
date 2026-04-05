import React, { useState } from "react";
import type { ClientGameState, DevCardType, ResourceType } from "@hexlands/shared";
import { RESOURCE_TYPES, hexVertexIds } from "@hexlands/shared";
import { useGameStore } from "../store.js";

// ── Shared constants ──────────────────────────────────────────────────────────

const EMOJI: Record<ResourceType, string> = {
  wood: "🌲", brick: "🧱", wheat: "🌾", ore: "⛰️", sheep: "🐑",
};

const RESOURCE_LABEL: Record<ResourceType, string> = {
  wood: "Wood", brick: "Brick", wheat: "Wheat", ore: "Ore", sheep: "Sheep",
};

const PLAYER_COLOR: Record<string, string> = {
  red: "#e74c3c", blue: "#2980b9", green: "#27ae60", orange: "#e67e22",
};

const DEV_LABEL: Record<DevCardType, string> = {
  knight: "Knight",
  roadBuilding: "Road Building",
  yearOfPlenty: "Year of Plenty",
  monopoly: "Monopoly",
  victoryPoint: "VP",
};

// ── Dev card SVG icons ────────────────────────────────────────────────────────

function KnightIcon({ size = 18 }: { size?: number }) {
  // Purple shield with sword diagonal across it
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      {/* Shield */}
      <path d="M10,1 L17,4 L17,11 Q17,16 10,18.5 Q3,16 3,11 L3,4 Z"
        fill="#7c3aed" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
      {/* Sword blade */}
      <line x1="5" y1="15.5" x2="16" y2="4.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      {/* Crossguard */}
      <line x1="13" y1="6.5" x2="16.5" y2="10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      {/* Pommel */}
      <circle cx="5" cy="16" r="1.6" fill="rgba(255,255,255,0.85)" />
    </svg>
  );
}

function YearOfPlentyIcon({ size = 18 }: { size?: number }) {
  // Green circle with bold "+2"
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      <circle cx="10" cy="10" r="9" fill="#27ae60" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <text x="10" y="14.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white"
        fontFamily="-apple-system, BlinkMacSystemFont, sans-serif">+2</text>
    </svg>
  );
}

function RoadBuildingIcon({ size = 18 }: { size?: number }) {
  // Two road planks forming a corner (L-shape)
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      {/* Horizontal plank */}
      <rect x="1" y="12" width="12" height="5" rx="2" fill="#2980b9" />
      {/* Vertical plank */}
      <rect x="11" y="3" width="5" height="12" rx="2" fill="#3498db" />
      {/* Corner join */}
      <rect x="11" y="12" width="5" height="5" rx="2" fill="#1f6fa3" />
    </svg>
  );
}

function MonopolyIcon({ size = 18 }: { size?: number }) {
  // Orange coin with an outward arrow (taking from all)
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      <circle cx="10" cy="10" r="9" fill="#e67e22" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      {/* Arrow pointing outward (down-left) — taking */}
      <line x1="12" y1="7" x2="6" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <polyline points="6,9 6,13 10,13" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VictoryPointIcon({ size = 18 }: { size?: number }) {
  // 5-pointed gold star
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      <polygon
        points="10,1.5 12.6,7.3 18.8,7.6 14.2,11.9 15.9,18.1 10,14.5 4.1,18.1 5.8,11.9 1.2,7.6 7.4,7.3"
        fill="#f0c040" stroke="rgba(180,130,0,0.6)" strokeWidth="0.8"
      />
    </svg>
  );
}

function DevCardIcon({ card, size = 16 }: { card: DevCardType; size?: number }) {
  if (card === "knight") return <KnightIcon size={size} />;
  if (card === "yearOfPlenty") return <YearOfPlentyIcon size={size} />;
  if (card === "roadBuilding") return <RoadBuildingIcon size={size} />;
  if (card === "monopoly") return <MonopolyIcon size={size} />;
  if (card === "victoryPoint") return <VictoryPointIcon size={size} />;
  return null;
}

function btnStyle(enabled: boolean): React.CSSProperties {
  return {
    background: "none", border: "none",
    color: enabled ? "#ccc" : "#444",
    fontSize: 16, lineHeight: 1, padding: "0 3px",
    cursor: enabled ? "pointer" : "default",
    minWidth: "unset",
  };
}

function chipStyle(active: boolean, disabled = false): React.CSSProperties {
  return {
    background: active ? "#f0c040" : "#0d1117",
    color: active ? "#1a1a1a" : disabled ? "#555" : "#eee",
    border: `1px solid ${active ? "#f0c040" : disabled ? "#333" : "#555"}`,
    borderRadius: 6, padding: "3px 10px",
    fontSize: 13, cursor: disabled ? "default" : "pointer", minWidth: "unset",
  };
}

// ── Discard panel ─────────────────────────────────────────────────────────────

function DiscardPanel({ state }: { state: ClientGameState }) {
  const { sendAction } = useGameStore();
  const myId = state.myPlayerId;
  const me = state.players.find((p) => p.id === myId)!;
  const required = state.pendingDiscards[myId]!;

  const [selected, setSelected] = useState<Partial<Record<ResourceType, number>>>({});
  const totalSelected = RESOURCE_TYPES.reduce((s, r) => s + (selected[r] ?? 0), 0);
  const ready = totalSelected === required;

  function change(r: ResourceType, delta: number) {
    setSelected((prev) => {
      const cur = prev[r] ?? 0;
      const next = Math.max(0, Math.min(me.resources[r] ?? 0, cur + delta));
      return { ...prev, [r]: next };
    });
  }

  const totalHand = RESOURCE_TYPES.reduce((s, r) => s + (me.resources[r] ?? 0), 0);

  return (
    <div style={{ border: "2px solid #e74c3c", borderRadius: 8, padding: 10, background: "rgba(231,76,60,0.08)" }}>
      <div style={{ fontSize: 13, fontWeight: "bold", color: "#e74c3c", marginBottom: 8 }}>
        ⚠️ Discard {required} card{required !== 1 ? "s" : ""} (you have {totalHand})
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {RESOURCE_TYPES.map((r) => {
          const have = me.resources[r] ?? 0;
          const disc = selected[r] ?? 0;
          if (have === 0) return null;
          return (
            <div
              key={r}
              style={{
                display: "flex", alignItems: "center", gap: 2,
                background: "#0d1117",
                border: `1px solid ${disc > 0 ? "#e74c3c" : "#30363d"}`,
                borderRadius: 6, padding: "3px 5px",
              }}
            >
              <span style={{ fontSize: 16 }}>{EMOJI[r]}</span>
              <button style={btnStyle(disc > 0)} onClick={() => change(r, -1)} disabled={disc <= 0}>−</button>
              <span style={{ fontSize: 12, fontWeight: "bold", minWidth: 14, textAlign: "center", color: disc > 0 ? "#e74c3c" : "#444" }}>
                {disc}
              </span>
              <button style={btnStyle(disc < have)} onClick={() => change(r, 1)} disabled={disc >= have}>+</button>
              <span style={{ fontSize: 10, color: "#555" }}>/{have}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: ready ? "#27ae60" : "#888" }}>
          {totalSelected}/{required} selected{ready ? " ✓" : ""}
        </span>
        <button
          disabled={!ready}
          onClick={() => sendAction({ type: "discard", resources: selected })}
          style={{ background: "#e74c3c", color: "#fff", padding: "4px 14px", fontSize: 12 }}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

// ── Waiting-for-others-to-discard banner ──────────────────────────────────────

function WaitingForDiscards({ state }: { state: ClientGameState }) {
  const myId = state.myPlayerId;
  const waiting = state.players.filter(
    (p) => p.id !== myId && state.pendingDiscards[p.id] !== undefined,
  );
  if (waiting.length === 0) return null;
  return (
    <div style={{ fontSize: 12, color: "#888", padding: "6px 10px", border: "1px solid #30363d", borderRadius: 6 }}>
      Waiting for {waiting.map((p) => (
        <strong key={p.id} style={{ color: PLAYER_COLOR[p.color] }}>{p.name}</strong>
      )).reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ", ", el], [])} to discard…
    </div>
  );
}

// ── Steal target picker ───────────────────────────────────────────────────────

function StealPanel({ state }: { state: ClientGameState }) {
  const { sendAction } = useGameStore();
  const myId = state.myPlayerId;

  const robberTile = state.board.tiles.find((t) => t.hasRobber);
  if (!robberTile) return null;

  const adjVertices = hexVertexIds(robberTile.coord);
  const victimIds = new Set<string>();
  for (const vid of adjVertices) {
    const building = state.board.buildings[vid];
    if (building && building.playerId !== myId) victimIds.add(building.playerId);
  }

  const victims = state.players.filter((p) => victimIds.has(p.id));
  if (victims.length === 0) return null;

  return (
    <div style={{ border: "1px solid #f0c040", borderRadius: 8, padding: 10, background: "rgba(240,192,64,0.06)" }}>
      <div style={{ fontSize: 12, color: "#f0c040", fontWeight: "bold", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
        <KnightIcon size={14} /> Choose who to steal from:
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {victims.map((p) => (
          <button
            key={p.id}
            onClick={() => sendAction({ type: "steal", victimId: p.id })}
            style={{ background: PLAYER_COLOR[p.color], color: "#fff", padding: "5px 14px", fontSize: 13, fontWeight: "bold" }}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Dev card hand ─────────────────────────────────────────────────────────────

function DevCardHand({ state }: { state: ClientGameState }) {
  const { sendAction } = useGameStore();
  const myId = state.myPlayerId;
  const me = state.players.find((p) => p.id === myId)!;

  const [pending, setPending] = useState<"yearOfPlenty" | "monopoly" | null>(null);
  const [yopRes1, setYopRes1] = useState<ResourceType | null>(null);
  const [yopRes2, setYopRes2] = useState<ResourceType | null>(null);
  const [monoRes, setMonoRes] = useState<ResourceType | null>(null);

  const phase = state.turnPhase;
  const canPlayKnight = phase === "preRoll" || phase === "postRoll";
  const canPlayOther = phase === "postRoll";

  // Group playable cards by type
  const counts = me.devCards.reduce<Partial<Record<DevCardType, number>>>((acc, c) => {
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});

  const newCount = me.devCardsBoughtThisTurn.length;
  if (Object.keys(counts).length === 0 && newCount === 0) return null;

  function playYoP() {
    if (!yopRes1 || !yopRes2) return;
    sendAction({ type: "playYearOfPlenty", resource1: yopRes1, resource2: yopRes2 });
    setPending(null); setYopRes1(null); setYopRes2(null);
  }

  function playMono() {
    if (!monoRes) return;
    sendAction({ type: "playMonopoly", resource: monoRes });
    setPending(null); setMonoRes(null);
  }

  return (
    <div style={{ border: "1px solid #30363d", borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Dev Cards
      </div>

      {/* Card buttons */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: pending ? 10 : 0 }}>
        {(Object.entries(counts) as [DevCardType, number][]).map(([card, count]) => {
          const isVP = card === "victoryPoint";
          const canPlay = !isVP && (card === "knight" ? canPlayKnight : canPlayOther);
          return (
            <button
              key={card}
              disabled={!canPlay}
              title={isVP ? "Counted automatically toward your score" : undefined}
              onClick={() => {
                if (card === "knight") { sendAction({ type: "playKnight" }); return; }
                if (card === "roadBuilding") { sendAction({ type: "playRoadBuilding" }); return; }
                if (card === "yearOfPlenty") { setPending("yearOfPlenty"); return; }
                if (card === "monopoly") { setPending("monopoly"); return; }
              }}
              style={{
                background: "#0d1117",
                border: `1px solid ${canPlay ? "#666" : "#2a2a2a"}`,
                color: canPlay ? "#eee" : "#444",
                borderRadius: 6, padding: "4px 9px", fontSize: 12,
                cursor: canPlay ? "pointer" : "default", minWidth: "unset",
                display: "flex", alignItems: "center", gap: 5,
                opacity: canPlay ? 1 : 0.45,
              }}
            >
              <DevCardIcon card={card} size={15} />
              {DEV_LABEL[card]}{count > 1 ? ` ×${count}` : ""}
            </button>
          );
        })}
        {me.devCardsBoughtThisTurn.map((card, i) => (
          <div
            key={`new-${i}`}
            title="Bought this turn — playable from next turn"
            style={{
              background: "#0d1117",
              border: "1px dashed #333",
              borderRadius: 6, padding: "4px 9px", fontSize: 12,
              display: "flex", alignItems: "center", gap: 5,
              opacity: 0.55, cursor: "default",
            }}
          >
            <DevCardIcon card={card} size={15} />
            <span style={{ color: "#888" }}>{DEV_LABEL[card]}</span>
            <span style={{
              fontSize: 9, background: "#1e2530", color: "#666",
              borderRadius: 3, padding: "1px 5px", lineHeight: 1.5,
            }}>
              next turn
            </span>
          </div>
        ))}
      </div>

      {/* Year of Plenty picker */}
      {pending === "yearOfPlenty" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 5 }}>First resource:</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            {RESOURCE_TYPES.map((r) => (
              <button key={`r1-${r}`} style={chipStyle(yopRes1 === r)} onClick={() => setYopRes1(r === yopRes1 ? null : r)}>
                {EMOJI[r]}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 5 }}>Second resource:</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            {RESOURCE_TYPES.map((r) => (
              <button key={`r2-${r}`} style={chipStyle(yopRes2 === r)} onClick={() => setYopRes2(r === yopRes2 ? null : r)}>
                {EMOJI[r]}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              disabled={!yopRes1 || !yopRes2}
              onClick={playYoP}
              style={{ flex: 1, background: "#f0c040", color: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <YearOfPlentyIcon size={15} />
              Take {yopRes1 ? EMOJI[yopRes1] : "?"} + {yopRes2 ? EMOJI[yopRes2] : "?"}
            </button>
            <button onClick={() => { setPending(null); setYopRes1(null); setYopRes2(null); }} style={{ background: "#30363d", color: "#aaa" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Monopoly picker */}
      {pending === "monopoly" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 5 }}>Monopolize which resource?</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            {RESOURCE_TYPES.map((r) => (
              <button key={r} style={chipStyle(monoRes === r)} onClick={() => setMonoRes(r === monoRes ? null : r)}>
                {EMOJI[r]} {RESOURCE_LABEL[r]}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              disabled={!monoRes}
              onClick={playMono}
              style={{ flex: 1, background: "#f0c040", color: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <MonopolyIcon size={15} />
              Monopolize {monoRes ? EMOJI[monoRes] : "?"}
            </button>
            <button onClick={() => { setPending(null); setMonoRes(null); }} style={{ background: "#30363d", color: "#aaa" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Exported panel ────────────────────────────────────────────────────────────

export function DevCardPanel({ state }: { state: ClientGameState }) {
  const myId = state.myPlayerId;
  const isMyTurn = state.players[state.currentPlayerIndex]?.id === myId;
  const myNeedsDiscard = state.turnPhase === "discarding" && state.pendingDiscards[myId] !== undefined;
  const othersNeedDiscard = state.turnPhase === "discarding" && !myNeedsDiscard;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {myNeedsDiscard && <DiscardPanel state={state} />}
      {othersNeedDiscard && <WaitingForDiscards state={state} />}
      {isMyTurn && state.turnPhase === "stealing" && <StealPanel state={state} />}
      {isMyTurn && state.phase === "main" &&
        (state.turnPhase === "preRoll" || state.turnPhase === "postRoll") &&
        <DevCardHand state={state} />
      }
    </div>
  );
}
