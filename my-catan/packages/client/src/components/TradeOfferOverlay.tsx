import type { ClientGameState, ResourceType } from "@hexlands/shared";
import { RESOURCE_TYPES } from "@hexlands/shared";
import { useGameStore } from "../store.js";

const EMOJI: Record<ResourceType, string> = {
  wood: "🌲", brick: "🧱", wheat: "🌾", ore: "⛰️", sheep: "🐑",
};

const PLAYER_COLOR: Record<string, string> = {
  red: "#e74c3c", blue: "#2980b9", green: "#27ae60", orange: "#e67e22",
};

function resSummary(res: Partial<Record<ResourceType, number>>): string {
  const parts = RESOURCE_TYPES.filter((r) => (res[r] ?? 0) > 0).map((r) => `${res[r]}×${EMOJI[r]}`);
  return parts.length > 0 ? parts.join("  ") : "—";
}

export function TradeOfferOverlay({ state }: { state: ClientGameState }) {
  const { sendAction } = useGameStore();
  const offer = state.tradeOffer;
  if (!offer) return null;

  const myId = state.myPlayerId;
  const isMyOffer = offer.fromPlayerId === myId;
  const offerer = state.players.find((p) => p.id === offer.fromPlayerId);
  const me = state.players.find((p) => p.id === myId)!;
  const myResponse = offer.responses[myId];
  const canAccept = RESOURCE_TYPES.every((r) => (me.resources[r] ?? 0) >= (offer.want[r] ?? 0));

  const others = state.players.filter((p) => p.id !== offer.fromPlayerId);

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        width: 260,
        background: "#161b22",
        border: "1px solid #f0c040",
        borderRadius: 10,
        padding: "14px 16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid #30363d", paddingBottom: 8 }}>
        <span style={{ fontSize: 16 }}>🤝</span>
        <span style={{ fontSize: 13, fontWeight: "bold", color: "#f0c040" }}>Trade Offer</span>
        {offerer && (
          <span style={{ fontSize: 12, color: PLAYER_COLOR[offerer.color], marginLeft: "auto" }}>
            from {offerer.name}
          </span>
        )}
      </div>

      {/* Offer terms */}
      <div style={{ background: "#0d1117", borderRadius: 6, padding: "8px 10px", fontSize: 13, lineHeight: 1.9 }}>
        <div>
          <span style={{ color: "#888" }}>Gives: </span>
          <strong style={{ color: "#e0e0e0" }}>{resSummary(offer.give)}</strong>
        </div>
        <div>
          <span style={{ color: "#888" }}>Wants: </span>
          <strong style={{ color: "#e0e0e0" }}>{resSummary(offer.want)}</strong>
        </div>
      </div>

      {/* Non-offerer: accept / reject */}
      {!isMyOffer && myId in offer.responses && (
        myResponse === null ? (
          <div style={{ display: "flex", gap: 6 }}>
            <button
              disabled={!canAccept}
              onClick={() => sendAction({ type: "respondTrade", offerId: offer.id, response: "accept" })}
              style={{ flex: 1, background: "#27ae60", color: "#fff", padding: "6px 0", fontSize: 13 }}
            >
              ✓ Accept
            </button>
            <button
              onClick={() => sendAction({ type: "respondTrade", offerId: offer.id, response: "reject" })}
              style={{ flex: 1, background: "#e74c3c", color: "#fff", padding: "6px 0", fontSize: 13 }}
            >
              ✕ Reject
            </button>
          </div>
        ) : (
          <div style={{
            textAlign: "center", fontSize: 12, padding: "4px 0",
            color: myResponse === "accept" ? "#27ae60" : "#e74c3c",
          }}>
            {myResponse === "accept" ? "✓ Accepted — waiting for offerer" : "✕ Rejected"}
          </div>
        )
      )}

      {/* Offerer: player responses + confirm buttons */}
      {isMyOffer && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {others.map((p) => {
            const resp = offer.responses[p.id];
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: PLAYER_COLOR[p.color] }}>{p.name}</span>
                {resp === undefined && <span style={{ color: "#555", fontSize: 12 }}>not targeted</span>}
                {resp === null && <span style={{ color: "#666", fontSize: 12 }}>waiting…</span>}
                {resp === "reject" && <span style={{ color: "#e74c3c", fontSize: 12 }}>✕ Rejected</span>}
                {resp === "accept" && (
                  <button
                    onClick={() => sendAction({ type: "acceptTrade", partnerId: p.id })}
                    style={{ background: "#27ae60", color: "#fff", padding: "3px 10px", fontSize: 12 }}
                  >
                    ✓ Trade
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={() => sendAction({ type: "cancelTrade" })}
            style={{ background: "#30363d", color: "#aaa", marginTop: 2 }}
          >
            Cancel Offer
          </button>
        </div>
      )}
    </div>
  );
}
