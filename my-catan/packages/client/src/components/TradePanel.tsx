import React, { useState } from "react";
import type { ClientGameState, ResourceType } from "@hexlands/shared";
import { RESOURCE_TYPES } from "@hexlands/shared";
import { useGameStore } from "../store.js";

type PartialRes = Partial<Record<ResourceType, number>>;

const EMOJI: Record<ResourceType, string> = {
  wood: "🌲", brick: "🧱", wheat: "🌾", ore: "⛰️", sheep: "🐑",
};

function portRatio(state: ClientGameState, playerId: string, resource: ResourceType): number {
  let ratio = 4;
  for (const [vid, building] of Object.entries(state.board.buildings)) {
    if (building.playerId !== playerId) continue;
    const port = state.board.ports.find((p) => p.vertices.includes(vid as any));
    if (!port) continue;
    if (port.resource === resource) ratio = Math.min(ratio, port.ratio);
    if (port.resource === "generic") ratio = Math.min(ratio, port.ratio);
  }
  return ratio;
}

// ── Resource counter row ──────────────────────────────────────────────────────

function ResPicker({
  label,
  values,
  onChange,
  maxes,
  accent,
}: {
  label: string;
  values: PartialRes;
  onChange: (r: ResourceType, delta: number) => void;
  maxes: PartialRes;
  accent: string;
}) {
  const btnStyle = (enabled: boolean): React.CSSProperties => ({
    background: "none",
    border: "none",
    color: enabled ? "#ccc" : "#444",
    fontSize: 16,
    lineHeight: 1,
    padding: "0 3px",
    cursor: enabled ? "pointer" : "default",
    minWidth: "unset",
  });

  return (
    <div>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {RESOURCE_TYPES.map((r) => {
          const val = values[r] ?? 0;
          const max = maxes[r] ?? 0;
          return (
            <div
              key={r}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                background: "#0d1117",
                border: `1px solid ${val > 0 ? accent : "#30363d"}`,
                borderRadius: 6,
                padding: "3px 5px",
              }}
            >
              <span style={{ fontSize: 16 }}>{EMOJI[r]}</span>
              <button style={btnStyle(val > 0)} onClick={() => onChange(r, -1)} disabled={val <= 0}>−</button>
              <span style={{ fontSize: 12, fontWeight: "bold", minWidth: 14, textAlign: "center", color: val > 0 ? accent : "#444" }}>
                {val}
              </span>
              <button style={btnStyle(val < max)} onClick={() => onChange(r, 1)} disabled={val >= max}>+</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Bank trade ────────────────────────────────────────────────────────────────

function BankTrade({ state }: { state: ClientGameState }) {
  const { sendAction } = useGameStore();
  const [give, setGive] = useState<ResourceType | null>(null);
  const [want, setWant] = useState<ResourceType | null>(null);

  const me = state.players.find((p) => p.id === state.myPlayerId)!;
  const ratio = give ? portRatio(state, state.myPlayerId, give) : 4;
  const canTrade =
    give && want && give !== want &&
    (me.resources[give] ?? 0) >= ratio &&
    (state.bank[want] ?? 0) > 0;

  const chipStyle = (selected: boolean, enabled: boolean): React.CSSProperties => ({
    background: selected ? "#f0c040" : "#0d1117",
    color: selected ? "#1a1a1a" : enabled ? "#eee" : "#444",
    border: `1px solid ${selected ? "#f0c040" : enabled ? "#555" : "#2a2a2a"}`,
    borderRadius: 6,
    padding: "4px 9px",
    fontSize: 13,
    cursor: enabled ? "pointer" : "not-allowed",
    minWidth: "unset",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontSize: 11, color: "#666", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Give</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {RESOURCE_TYPES.map((r) => {
            const r2 = portRatio(state, state.myPlayerId, r);
            const has = (me.resources[r] ?? 0) >= r2;
            return (
              <button key={r} style={chipStyle(give === r, has)} disabled={!has}
                onClick={() => setGive(give === r ? null : r)}>
                {EMOJI[r]} {r2}:1
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, color: "#666", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Receive</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {RESOURCE_TYPES.map((r) => {
            const ok = r !== give && (state.bank[r] ?? 0) > 0;
            return (
              <button key={r} style={chipStyle(want === r, ok)} disabled={!ok}
                onClick={() => setWant(want === r ? null : r)}>
                {EMOJI[r]}
              </button>
            );
          })}
        </div>
      </div>

      <button
        disabled={!canTrade}
        onClick={() => {
          if (!give || !want) return;
          sendAction({ type: "bankTrade", give, want, amount: ratio });
          setGive(null);
          setWant(null);
        }}
      >
        Trade {give ? `${ratio}×${EMOJI[give]}` : "?"} → {want ? EMOJI[want] : "?"}
      </button>
    </div>
  );
}

// ── Player trade offer creation ───────────────────────────────────────────────

function PlayerTradeForm({ state }: { state: ClientGameState }) {
  const { sendAction } = useGameStore();
  const [give, setGive] = useState<PartialRes>({});
  const [want, setWant] = useState<PartialRes>({});

  const me = state.players.find((p) => p.id === state.myPlayerId)!;

  function changeGive(r: ResourceType, delta: number) {
    setGive((g) => ({ ...g, [r]: Math.max(0, Math.min(me.resources[r] ?? 0, (g[r] ?? 0) + delta)) }));
  }
  function changeWant(r: ResourceType, delta: number) {
    setWant((w) => ({ ...w, [r]: Math.max(0, Math.min(9, (w[r] ?? 0) + delta)) }));
  }

  const totalGive = RESOURCE_TYPES.reduce((s, r) => s + (give[r] ?? 0), 0);
  const totalWant = RESOURCE_TYPES.reduce((s, r) => s + (want[r] ?? 0), 0);

  // Disable creation while an offer is already active
  if (state.tradeOffer) {
    return <div style={{ fontSize: 12, color: "#666", textAlign: "center" }}>Offer in progress — see board overlay</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ResPicker label="You give" values={give} onChange={changeGive}
        maxes={me.resources} accent="#e74c3c" />
      <ResPicker label="You want" values={want} onChange={changeWant}
        maxes={Object.fromEntries(RESOURCE_TYPES.map((r) => [r, 9])) as PartialRes} accent="#27ae60" />
      <button
        disabled={totalGive === 0 || totalWant === 0}
        onClick={() => { sendAction({ type: "offerTrade", give, want }); setGive({}); setWant({}); }}
      >
        Offer Trade
      </button>
    </div>
  );
}

// ── Exported panel ────────────────────────────────────────────────────────────

export function TradePanel({ state }: { state: ClientGameState }) {
  const [tab, setTab] = useState<"bank" | "player">("bank");

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "5px 0",
    fontSize: 12,
    fontWeight: active ? 700 : 400,
    background: active ? "#f0c040" : "#0d1117",
    color: active ? "#1a1a1a" : "#888",
    border: `1px solid ${active ? "#f0c040" : "#30363d"}`,
    borderRadius: 5,
    cursor: "pointer",
    minWidth: "unset",
  });

  return (
    <div style={{ border: "1px solid #30363d", borderRadius: 8, padding: 10 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        <button style={tabStyle(tab === "bank")} onClick={() => setTab("bank")}>🏦 Bank</button>
        <button style={tabStyle(tab === "player")} onClick={() => setTab("player")}>🤝 Offer</button>
      </div>
      {tab === "bank" ? <BankTrade state={state} /> : <PlayerTradeForm state={state} />}
    </div>
  );
}
