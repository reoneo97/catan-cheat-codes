import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { ClientGameState, Player, ResourceType } from "@catan/shared";
import { RESOURCE_TYPES, longestRoad } from "@catan/shared";
import { useGameStore } from "../store.js";
import { TipOfTheDay } from "./TipOfTheDay.js";
import { TradePanel } from "./TradePanel.js";
import { DevCardPanel } from "./DevCardPanel.js";
import { DiceDisplay } from "./DiceDisplay.js";

const RESOURCE_EMOJI: Record<ResourceType, string> = {
  wood: "🌲", brick: "🧱", wheat: "🌾", ore: "⛰️", sheep: "🐑",
};

const PLAYER_COLOR: Record<string, string> = {
  red: "#e74c3c", blue: "#2980b9", green: "#27ae60", orange: "#e67e22",
};

type GainToast = { id: number; label: string; x: number };

function ResourceGainOverlay({ resources }: { resources: Record<string, number> }) {
  const prevRef = useRef<Record<string, number> | null>(null);
  const [toasts, setToasts] = useState<GainToast[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    if (prevRef.current === null) {
      prevRef.current = { ...resources };
      return;
    }
    const gained: GainToast[] = [];
    const slots = [15, 35, 55, 75, 90];
    let slot = 0;
    for (const r of RESOURCE_TYPES) {
      const diff = (resources[r] ?? 0) - (prevRef.current[r] ?? 0);
      if (diff > 0) {
        gained.push({ id: ++nextId.current, label: `+${diff}${RESOURCE_EMOJI[r]}`, x: slots[slot % slots.length] });
        slot++;
      }
    }
    prevRef.current = { ...resources };
    if (gained.length === 0) return;
    setToasts((prev) => [...prev, ...gained]);
    const ids = new Set(gained.map((t) => t.id));
    const timer = setTimeout(() => setToasts((prev) => prev.filter((t) => !ids.has(t.id))), 1300);
    return () => clearTimeout(timer);
  }, [resources]);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
      {toasts.map((t) => (
        <span
          key={t.id}
          style={{
            position: "absolute",
            left: `${t.x}%`,
            bottom: "50%",
            fontSize: 15,
            fontWeight: "bold",
            color: "#f0c040",
            textShadow: "0 1px 4px rgba(0,0,0,0.8)",
            animation: "resourceFloat 1.3s ease-out forwards",
            whiteSpace: "nowrap",
          }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

function ResourceHand({ resources, isMe }: { resources: Record<string, number>; isMe: boolean }) {
  if (!isMe) {
    const total = RESOURCE_TYPES.reduce((s, r) => s + (resources[r] ?? 0), 0);
    return <span style={{ color: "#aaa" }}>{total} cards</span>;
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "nowrap" }}>
      {RESOURCE_TYPES.map((r) => (
        <span key={r} style={{ fontSize: 20, lineHeight: 1.2 }}>
          {RESOURCE_EMOJI[r]}<span style={{ fontSize: 13, fontWeight: "bold", verticalAlign: "middle" }}>{resources[r] ?? 0}</span>
        </span>
      ))}
    </div>
  );
}

function PlayerCard({ player, state }: { player: Player; state: ClientGameState }) {
  const { setHoveredRoadPlayer } = useGameStore();
  const isMe = player.id === state.myPlayerId;
  const isCurrentPlayer = state.players[state.currentPlayerIndex]?.id === player.id;

  return (
    <div
      style={{
        border: `2px solid ${PLAYER_COLOR[player.color]}`,
        borderLeft: `5px solid ${PLAYER_COLOR[player.color]}`,
        borderRadius: 8,
        padding: "8px 12px",
        background: isCurrentPlayer ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.2)",
        opacity: player.connected ? 1 : 0.5,
        boxShadow: isCurrentPlayer ? `0 0 10px ${PLAYER_COLOR[player.color]}55` : "none",
        transition: "box-shadow 0.2s",
        position: "relative",
      }}
    >
      {isMe && <ResourceGainOverlay resources={player.resources} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <strong style={{ color: PLAYER_COLOR[player.color] }}>
          {player.name}
          {isMe ? " (you)" : ""}
        </strong>
        {isCurrentPlayer && (
          <span style={{ fontSize: 10, background: "#f0c040", color: "#1a1a1a", borderRadius: 4, padding: "1px 5px", fontWeight: "bold", marginLeft: 6 }}>
            ▶ TURN
          </span>
        )}
        <span style={{ color: "#f0c040", fontWeight: "bold" }}>
          {player.publicVP} VP
        </span>
      </div>
      <div data-player-resources={player.id}>
        <ResourceHand resources={player.resources} isMe={isMe} />
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { emoji: "🏠", placed: 5 - player.remainingSettlements, total: 5 },
          { emoji: "🏙️", placed: 4 - player.remainingCities, total: 4 },
        ].map(({ emoji, placed, total }) => (
          <span key={emoji} style={{ fontSize: 18 }}>
            {emoji}{" "}
            {Array.from({ length: total }, (_, i) => (
              <span key={i} style={{ color: i < placed ? PLAYER_COLOR[player.color] : "#555", fontSize: 14 }}>
                {i < placed ? "●" : "○"}
              </span>
            ))}
          </span>
        ))}

        {/* Longest road chain — hover highlights it on the board */}
        <span
          style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer" }}
          title="Longest road chain — hover to highlight on board"
          onMouseEnter={() => setHoveredRoadPlayer(player.id)}
          onMouseLeave={() => setHoveredRoadPlayer(null)}
        >
          <span style={{ fontSize: 16 }}>🛣️</span>
          <span style={{ fontSize: 13, color: "#aaa" }}>road</span>
          <span style={{
            fontSize: 15, fontWeight: "bold",
            color: player.hasLongestRoad ? "#38bdf8" : "#ccc",
            minWidth: 16, textAlign: "center",
          }}>
            {longestRoad(state as any, player.id)}
          </span>
        </span>

        {/* Knights played */}
        <span style={{ display: "flex", alignItems: "center", gap: 3 }} title="Knights played">
          <span style={{ fontSize: 16 }}>⚔️</span>
          <span style={{ fontSize: 13, color: "#aaa" }}>knights</span>
          <span style={{
            fontSize: 15, fontWeight: "bold",
            color: player.hasLargestArmy ? "#c084fc" : "#ccc",
            minWidth: 16, textAlign: "center",
          }}>
            {player.knightsPlayed}
          </span>
        </span>

        {/* Dev cards in hand */}
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 16 }}>🃏</span>
          <span style={{ fontSize: 14, fontWeight: "bold", color: "#aaa" }}>{player.devCards.length}</span>
        </span>

        {/* Special card badges */}
        {player.hasLargestArmy && (
          <span style={{ fontSize: 12, background: "#7c3aed", color: "#fff", borderRadius: 5, padding: "2px 6px", fontWeight: "bold" }}>
            ⚔️ Largest Army
          </span>
        )}
        {player.hasLongestRoad && (
          <span style={{ fontSize: 12, background: "#0369a1", color: "#fff", borderRadius: 5, padding: "2px 6px", fontWeight: "bold" }}>
            🛣️ Longest Road
          </span>
        )}
      </div>
    </div>
  );
}

export function PlayerPanel({ state }: { state: ClientGameState }) {
  const { sendAction, restartGame, leave } = useGameStore();
  const navigate = useNavigate();
  const myId = state.myPlayerId;
  const me = state.players.find((p) => p.id === myId);
  const isMyTurn = state.players[state.currentPlayerIndex]?.id === myId;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {state.players.map((p) => (
        <PlayerCard key={p.id} player={p} state={state} />
      ))}

      {/* Dice */}
      {state.phase === "main" && <DiceDisplay state={state} />}

      {/* Action buttons */}
      {isMyTurn && state.phase === "main" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {state.turnPhase === "preRoll" && (
            <button onClick={() => sendAction({ type: "rollDice" })}>🎲 Roll Dice</button>
          )}
          {state.turnPhase === "postRoll" && (
            <>
              <button onClick={() => sendAction({ type: "buyDevCard" })}>🃏 Buy Dev Card</button>
              <button onClick={() => sendAction({ type: "endTurn" })}>➡️ End Turn</button>
            </>
          )}
        </div>
      )}

      {/* Dev cards, discard, steal */}
      {state.phase === "main" && <DevCardPanel state={state} />}

      {/* Trading */}
      {state.phase === "main" && (isMyTurn && state.turnPhase === "postRoll" || state.tradeOffer !== null) && (
        <TradePanel state={state} isMyTurn={isMyTurn} />
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={restartGame} style={{ flex: 1, background: "#7f1d1d", color: "#fff", border: "none", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}>
          🔄 Restart
        </button>
        <button
          onClick={() => { leave(); navigate("/"); }}
          style={{ flex: 1, background: "#1a1a2e", color: "#aaa", border: "1px solid #30363d", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}
        >
          🚪 Quit
        </button>
      </div>

      {/* Game log */}
      <div
        style={{
          background: "rgba(0,0,0,0.3)",
          borderRadius: 6,
          padding: 8,
          maxHeight: 160,
          overflowY: "auto",
          fontSize: 11,
          color: "#ccc",
          fontFamily: "monospace",
        }}
      >
        {[...state.log].reverse().map((entry, i) => (
          <div key={i}>{entry}</div>
        ))}
      </div>
      <TipOfTheDay />
    </div>
  );
}
