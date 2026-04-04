import React, { useState } from "react";
import type { ClientGameState, DevCardType, ResourceType } from "@catan/shared";
import { RESOURCE_TYPES, hexVertexIds } from "@catan/shared";
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
  knight: "⚔️ Knight",
  roadBuilding: "🛣️ Road Building",
  yearOfPlenty: "🌟 Year of Plenty",
  monopoly: "💰 Monopoly",
  victoryPoint: "⭐ VP",
};

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
      <div style={{ fontSize: 12, color: "#f0c040", fontWeight: "bold", marginBottom: 8 }}>
        🗡️ Choose who to steal from:
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
              }}
            >
              {DEV_LABEL[card]}{count > 1 ? ` ×${count}` : ""}
            </button>
          );
        })}
        {newCount > 0 && (
          <span style={{ fontSize: 12, color: "#555", padding: "4px 9px", border: "1px solid #222", borderRadius: 6 }}>
            🆕 ×{newCount} (next turn)
          </span>
        )}
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
              style={{ flex: 1, background: "#f0c040", color: "#1a1a1a" }}
            >
              🌟 Take {yopRes1 ? EMOJI[yopRes1] : "?"} + {yopRes2 ? EMOJI[yopRes2] : "?"}
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
              style={{ flex: 1, background: "#f0c040", color: "#1a1a1a" }}
            >
              💰 Monopolize {monoRes ? EMOJI[monoRes] : "?"}
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
