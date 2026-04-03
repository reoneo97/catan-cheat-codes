import type { ClientGameState, Player, ResourceType } from "@catan/shared";
import { RESOURCE_TYPES } from "@catan/shared";
import { useGameStore } from "../store.js";

const RESOURCE_EMOJI: Record<ResourceType, string> = {
  wood: "🌲", brick: "🧱", wheat: "🌾", ore: "⛰️", sheep: "🐑",
};

const PLAYER_COLOR: Record<string, string> = {
  red: "#e74c3c", blue: "#2980b9", green: "#27ae60", orange: "#e67e22",
};

function ResourceHand({ resources, isMe }: { resources: Record<string, number>; isMe: boolean }) {
  if (!isMe) {
    const total = RESOURCE_TYPES.reduce((s, r) => s + (resources[r] ?? 0), 0);
    return <span style={{ color: "#aaa" }}>{total} cards</span>;
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {RESOURCE_TYPES.map((r) => (
        <span key={r} style={{ fontSize: 12 }}>
          {RESOURCE_EMOJI[r]} {resources[r] ?? 0}
        </span>
      ))}
    </div>
  );
}

function PlayerCard({ player, state }: { player: Player; state: ClientGameState }) {
  const isMe = player.id === state.myPlayerId;
  const isCurrentPlayer = state.players[state.currentPlayerIndex]?.id === player.id;

  return (
    <div
      style={{
        border: `2px solid ${PLAYER_COLOR[player.color]}`,
        borderRadius: 8,
        padding: "8px 12px",
        background: isCurrentPlayer ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.2)",
        opacity: player.connected ? 1 : 0.5,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <strong style={{ color: PLAYER_COLOR[player.color] }}>
          {isCurrentPlayer ? "▶ " : ""}{player.name}
          {isMe ? " (you)" : ""}
          {player.hasLargestArmy ? " 🗡️" : ""}
          {player.hasLongestRoad ? " 🛣️" : ""}
        </strong>
        <span style={{ color: "#f0c040", fontWeight: "bold" }}>
          {player.publicVP} VP
        </span>
      </div>
      <ResourceHand resources={player.resources} isMe={isMe} />
      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
        🏠 {5 - player.remainingSettlements} &nbsp;
        🏙️ {4 - player.remainingCities} &nbsp;
        🛣️ {15 - player.remainingRoads} roads &nbsp;
        🃏 {player.devCards.length} dev
      </div>
    </div>
  );
}

export function PlayerPanel({ state }: { state: ClientGameState }) {
  const { sendAction } = useGameStore();
  const myId = state.myPlayerId;
  const me = state.players.find((p) => p.id === myId);
  const isMyTurn = state.players[state.currentPlayerIndex]?.id === myId;

  const needsDiscard =
    state.turnPhase === "discarding" && state.pendingDiscards[myId] !== undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {state.players.map((p) => (
        <PlayerCard key={p.id} player={p} state={state} />
      ))}

      {/* Action buttons */}
      {isMyTurn && (
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

      {needsDiscard && (
        <div style={{ color: "#e74c3c", fontWeight: "bold", padding: 8, border: "1px solid #e74c3c", borderRadius: 6 }}>
          You must discard {state.pendingDiscards[myId]} cards!
          {/* TODO: implement discard UI */}
        </div>
      )}

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
    </div>
  );
}
