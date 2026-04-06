import { useEffect, useRef, useState } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import type { ClientGameState } from "@hexlands/shared";
import { useGameStore } from "./store.js";
import { BoardView } from "./components/Board.js";
import { PlayerPanel } from "./components/PlayerPanel.js";
import { TipOfTheDay } from "./components/TipOfTheDay.js";
import { FlyingResourcesOverlay } from "./components/FlyingResourcesOverlay.js";
import { TradeOfferOverlay } from "./components/TradeOfferOverlay.js";
import { Tutorial } from "./components/Tutorial.js";
import "./App.css";

const PLAYER_COLOR: Record<string, string> = {
  red: "#e74c3c", blue: "#2980b9", green: "#27ae60", orange: "#e67e22",
};

// ── Join form (shown at / with no saved state) ────────────────────────────────

function JoinForm({ defaultRoom }: { defaultRoom: string }) {
  const { join } = useGameStore();
  const navigate = useNavigate();
  const [nameInput, setNameInput] = useState(() => localStorage.getItem("hexlands_name") ?? "");
  const [roomInput, setRoomInput] = useState(defaultRoom);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!nameInput || !roomInput) return;
    localStorage.setItem("hexlands_name", nameInput);
    localStorage.setItem("hexlands_room", roomInput);
    join(roomInput, nameInput);
    navigate(`/room/${roomInput}`, { replace: true });
  }

  return (
    <div className="lobby">
      <h1>🏝️ Hexlands</h1>
      <form onSubmit={handleJoin} className="lobby-form">
        <input
          placeholder="Your name"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          required
        />
        <input
          placeholder="Room ID"
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
          required
        />
        <button type="submit">Join Room</button>
      </form>
      <button
        type="button"
        onClick={() => navigate("/tutorial")}
        style={{ background: "transparent", color: "#f0c040", border: "1px solid #f0c04055", fontSize: 13, padding: "6px 14px" }}
      >
        📖 How to Play
      </button>
    </div>
  );
}

// ── Waiting room ──────────────────────────────────────────────────────────────

function WaitingRoom() {
  const { roomId, playerName, connected, waitingPlayers, startGame, leave } = useGameStore();
  const navigate = useNavigate();
  const shareUrl = `${window.location.origin}/room/${roomId}`;
  const [copied, setCopied] = useState(false);

  function handleLeave() {
    leave();
    localStorage.removeItem("hexlands_room");
    navigate("/", { replace: true });
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="lobby">
      <h1>🏝️ Hexlands</h1>

      <div className="room-card">
        <div className="room-label">Room</div>
        <div className="room-id">{roomId}</div>
        <div className="room-status" style={{ color: connected ? "#27ae60" : "#e74c3c" }}>
          {connected ? "● Connected" : "○ Connecting…"}
        </div>
      </div>

      <div className="room-card">
        <div className="room-label">Invite link</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
          <code style={{ flex: 1, fontSize: 12, color: "#aaa", wordBreak: "break-all" }}>{shareUrl}</code>
          <button type="button" onClick={handleCopy} style={{ flexShrink: 0, padding: "4px 10px", fontSize: 12 }}>
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="room-card">
        <div className="room-label">Players ({waitingPlayers.length} / 4)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {waitingPlayers.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: PLAYER_COLOR[p.color], display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontWeight: p.name === playerName ? 600 : 400 }}>
                {p.name}{p.name === playerName ? " (you)" : ""}
              </span>
            </div>
          ))}
          {waitingPlayers.length === 0 && (
            <span style={{ color: "#555", fontSize: 13 }}>Waiting for players…</span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
        <button onClick={handleLeave} style={{ background: "#30363d", color: "#ccc" }}>
          ← Exit
        </button>
        <button onClick={startGame} disabled={waitingPlayers.length < 2}>
          Start Game
        </button>
        <button
          type="button"
          onClick={() => navigate("/tutorial")}
          style={{ background: "transparent", color: "#f0c040", border: "1px solid #f0c04055", fontSize: 13 }}
        >
          📖 How to Play
        </button>
      </div>

      <p style={{ fontSize: 12, color: "#555" }}>Need 2–4 players to start.</p>
      <TipOfTheDay />
    </div>
  );
}

// ── Game over overlay ─────────────────────────────────────────────────────────

type GameOverTab = "results" | "resources" | "devcards";

const RESOURCE_EMOJI: Record<string, string> = {
  wood: "🌲", brick: "🧱", wheat: "🌾", ore: "⛰️", sheep: "🐑",
};
const RESOURCE_TYPES_LIST = ["wood", "brick", "wheat", "ore", "sheep"] as const;
const DEV_CARD_EMOJI: Record<string, string> = {
  knight: "⚔️", roadBuilding: "🛤️", yearOfPlenty: "+2", monopoly: "↺", victoryPoint: "★",
};

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, fontSize: 12, padding: "6px 4px",
        background: active ? "#f0c040" : "#1e2530",
        color: active ? "#1a1a1a" : "#888",
        border: "1px solid #30363d",
        borderRadius: 6, fontWeight: active ? 700 : 400,
      }}
    >
      {label}
    </button>
  );
}

function ResultsTab({ state }: { state: ClientGameState }) {
  const winner = state.players.find((p) => p.id === state.winnerId);
  return (
    <>
      {winner && (
        <p style={{ color: PLAYER_COLOR[winner.color] ?? "#fff", fontSize: 20, fontWeight: "bold", marginBottom: 16, textAlign: "center" }}>
          {winner.name} wins!
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[...state.players]
          .sort((a, b) => b.publicVP - a.publicVP)
          .map((p, i) => (
            <div key={p.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 12px", borderRadius: 8,
              background: p.id === state.winnerId ? "rgba(240,192,64,0.12)" : "rgba(255,255,255,0.03)",
              border: p.id === state.winnerId ? "1px solid rgba(240,192,64,0.3)" : "1px solid transparent",
            }}>
              <span style={{ color: "#555", marginRight: 8, fontSize: 12 }}>#{i + 1}</span>
              <span style={{ flex: 1, textAlign: "left", color: PLAYER_COLOR[p.color] ?? "#eee", fontWeight: 600 }}>
                {p.name}
              </span>
              <span style={{ color: "#888", fontSize: 11, marginRight: 10 }}>
                {p.remainingSettlements < 5 ? `${5 - p.remainingSettlements}🏠` : ""}
                {p.remainingCities < 4 ? ` ${4 - p.remainingCities}🏙️` : ""}
              </span>
              <span style={{ color: "#f0c040", fontWeight: "bold" }}>{p.publicVP} VP</span>
            </div>
          ))}
      </div>
    </>
  );
}

const PLAYER_COLORS_CHART: Record<string, string> = {
  red: "#e74c3c", blue: "#2980b9", green: "#27ae60", orange: "#e67e22",
};

function ResourceLineChart({ state }: { state: ClientGameState }) {
  const { history, players } = state;
  if (!history || history.snapshots.length < 2) {
    return (
      <div style={{ color: "#444", fontSize: 11, textAlign: "center", padding: "12px 0" }}>
        Chart available after turns are played
      </div>
    );
  }

  const W = 500, H = 200;
  const ML = 38, MR = 14, MT = 12, MB = 48;
  const PW = W - ML - MR;
  const PH = H - MT - MB;

  const { snapshots, buildEvents } = history;
  const maxTurn = snapshots[snapshots.length - 1].turn;
  const allGained = snapshots.flatMap((s) => Object.values(s.gained as Record<string, number>));
  const rawMax = Math.max(1, ...allGained);
  const yMax = Math.ceil(rawMax / 5) * 5;

  const xScale = (turn: number) =>
    ML + (maxTurn > 0 ? (turn / maxTurn) * PW : 0);
  const yScale = (val: number) => MT + PH - (val / yMax) * PH;

  // Y axis ticks: 0, mid, max
  const yMid = Math.round(yMax / 2 / 5) * 5;
  const yTicks = [0, yMid, yMax];

  // X axis ticks: up to 7, evenly spaced
  const tickCount = Math.min(maxTurn + 1, 7);
  const xTicks: number[] = Array.from({ length: tickCount }, (_, i) =>
    Math.round((i / Math.max(tickCount - 1, 1)) * maxTurn)
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      {/* Grid lines */}
      {yTicks.map((v) => (
        <line key={v} x1={ML} y1={yScale(v)} x2={W - MR} y2={yScale(v)}
          stroke="#1e2530" strokeWidth={1} />
      ))}

      {/* Y axis labels */}
      {yTicks.map((v) => (
        <text key={v} x={ML - 5} y={yScale(v) + 4} textAnchor="end" fontSize={9} fill="#555">
          {v}
        </text>
      ))}

      {/* X axis labels */}
      {xTicks.map((t) => (
        <text key={t} x={xScale(t)} y={MT + PH + 13} textAnchor="middle" fontSize={9} fill="#555">
          {t}
        </text>
      ))}

      {/* Axis lines */}
      <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#333" strokeWidth={1} />
      <line x1={ML} y1={MT + PH} x2={W - MR} y2={MT + PH} stroke="#333" strokeWidth={1} />

      {/* Axis title */}
      <text x={ML + PW / 2} y={MT + PH + 25} textAnchor="middle" fontSize={9} fill="#444">
        Turn
      </text>
      <text
        x={10} y={MT + PH / 2} textAnchor="middle" fontSize={9} fill="#444"
        transform={`rotate(-90, 10, ${MT + PH / 2})`}
      >
        Resources
      </text>

      {/* Player lines */}
      {players.map((p) => {
        const color = PLAYER_COLORS_CHART[p.color] ?? "#aaa";
        const points = snapshots
          .map((s) => `${xScale(s.turn)},${yScale((s.gained as Record<string, number>)[p.id] ?? 0)}`)
          .join(" ");
        return (
          <polyline key={p.id} points={points} fill="none"
            stroke={color} strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round" />
        );
      })}

      {/* Build event badges */}
      {buildEvents.map((ev, i) => {
        const p = players.find((pl) => pl.id === ev.playerId);
        if (!p) return null;
        const color = PLAYER_COLORS_CHART[p.color] ?? "#aaa";
        // Find closest preceding or equal snapshot
        const snap = [...snapshots].reverse().find((s) => s.turn <= ev.turn) ?? snapshots[0];
        const gained = (snap.gained as Record<string, number>)[ev.playerId] ?? 0;
        const r = ev.building === "city" ? 6 : 4;
        const emoji = ev.building === "city" ? "🏙" : "🏠";
        return (
          <g key={i}>
            <circle cx={xScale(ev.turn)} cy={yScale(gained)} r={r + 1.5}
              fill="#161b22" stroke={color} strokeWidth={1.5} />
            <text x={xScale(ev.turn)} y={yScale(gained) + 4} textAnchor="middle"
              fontSize={r * 1.8} style={{ userSelect: "none" }}>
              {emoji}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {players.map((p, i) => {
        const color = PLAYER_COLORS_CHART[p.color] ?? "#aaa";
        const cols = 2;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const lx = ML + col * (PW / cols);
        const ly = MT + PH + 33 + row * 13;
        return (
          <g key={p.id}>
            <line x1={lx} y1={ly} x2={lx + 14} y2={ly}
              stroke={color} strokeWidth={2} strokeLinecap="round" />
            <text x={lx + 18} y={ly + 4} fontSize={9} fill={color} fontWeight="bold">
              {p.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ResourcesTab({ state }: { state: ClientGameState }) {
  return (
    <div>
      <ResourceLineChart state={state} />
      <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #30363d" }}>
            <th style={{ textAlign: "left", padding: "4px 6px", color: "#555", fontWeight: 600 }}>Player</th>
            {RESOURCE_TYPES_LIST.map((r) => (
              <th key={r} style={{ padding: "4px 4px", color: "#888" }} title={r}>{RESOURCE_EMOJI[r]}</th>
            ))}
            <th style={{ padding: "4px 6px", color: "#555" }}>Stolen↓</th>
            <th style={{ padding: "4px 6px", color: "#555" }}>Stolen↑</th>
          </tr>
        </thead>
        <tbody>
          {state.players.map((p) => {
            const gained = p.stats?.resourcesGained;
            const spent = p.stats?.resourcesSpent;
            return (
              <tr key={p.id} style={{ borderBottom: "1px solid #1e2530" }}>
                <td style={{ padding: "5px 6px", color: PLAYER_COLOR[p.color], fontWeight: 600, whiteSpace: "nowrap" }}>
                  {p.name}
                </td>
                {RESOURCE_TYPES_LIST.map((r) => (
                  <td key={r} style={{ padding: "5px 4px", textAlign: "center" }}>
                    <div style={{ color: "#4ade80", fontSize: 10 }}>+{gained?.[r] ?? 0}</div>
                    <div style={{ color: "#f87171", fontSize: 10 }}>−{spent?.[r] ?? 0}</div>
                  </td>
                ))}
                <td style={{ padding: "5px 6px", textAlign: "center", color: "#f87171" }}>
                  {p.stats?.stolenFromMe ?? 0}
                </td>
                <td style={{ padding: "5px 6px", textAlign: "center", color: "#4ade80" }}>
                  {p.stats?.stolenByMe ?? 0}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 10, color: "#444", marginTop: 8 }}>
        Green = gained · Red = spent · Stolen↓ = taken from you · Stolen↑ = taken by you
      </div>
      </div>
    </div>
  );
}

function DevCardsTab({ state }: { state: ClientGameState }) {
  const devCardTypes = ["knight", "roadBuilding", "yearOfPlenty", "monopoly", "victoryPoint"] as const;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #30363d" }}>
            <th style={{ textAlign: "left", padding: "4px 6px", color: "#555" }}>Player</th>
            <th style={{ padding: "4px 4px", color: "#888" }} title="Drawn">📥</th>
            {devCardTypes.map((t) => (
              <th key={t} style={{ padding: "4px 4px", color: "#888" }} title={t}>{DEV_CARD_EMOJI[t]}</th>
            ))}
            <th style={{ padding: "4px 6px", color: "#888" }} title="VP cards in hand">🃏VP</th>
          </tr>
        </thead>
        <tbody>
          {state.players.map((p) => {
            const played = p.devCardsPlayed;
            const inHand = p.devCards as string[];
            const vpInHand = inHand.filter((c) => c === "victoryPoint").length;
            return (
              <tr key={p.id} style={{ borderBottom: "1px solid #1e2530" }}>
                <td style={{ padding: "5px 6px", color: PLAYER_COLOR[p.color], fontWeight: 600, whiteSpace: "nowrap" }}>
                  {p.name}
                </td>
                <td style={{ padding: "5px 4px", textAlign: "center", color: "#aaa" }}>
                  {p.stats?.devCardsDrawn ?? 0}
                </td>
                {devCardTypes.map((t) => (
                  <td key={t} style={{ padding: "5px 4px", textAlign: "center", color: played.filter((c) => c === t).length > 0 ? "#f0c040" : "#444" }}>
                    {played.filter((c) => c === t).length || "—"}
                  </td>
                ))}
                <td style={{ padding: "5px 6px", textAlign: "center", color: vpInHand > 0 ? "#c084fc" : "#444" }}>
                  {vpInHand || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 10, color: "#444", marginTop: 8 }}>
        All cards revealed at game end · ⚔️ Knight · 🛤️ Road · +2 Plenty · ↺ Monopoly · ★ VP
      </div>
    </div>
  );
}

function GameOverScreen({ state }: { state: ClientGameState }) {
  const { restartGame, leave } = useGameStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<GameOverTab>("results");

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#161b22", border: "2px solid #f0c040",
        borderRadius: 16, padding: "28px 32px",
        width: "100%", maxWidth: 480,
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 42, marginBottom: 4 }}>🏆</div>
          <h2 style={{ color: "#f0c040", fontSize: 24, marginBottom: 0 }}>Game Over</h2>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <TabButton label="Results" active={tab === "results"} onClick={() => setTab("results")} />
          <TabButton label="Resources" active={tab === "resources"} onClick={() => setTab("resources")} />
          <TabButton label="Dev Cards" active={tab === "devcards"} onClick={() => setTab("devcards")} />
        </div>

        {/* Tab content */}
        <div style={{ marginBottom: 20 }}>
          {tab === "results" && <ResultsTab state={state} />}
          {tab === "resources" && <ResourcesTab state={state} />}
          {tab === "devcards" && <DevCardsTab state={state} />}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={restartGame} style={{ flex: 1 }}>🔄 Play Again</button>
          <button
            onClick={() => { leave(); navigate("/", { replace: true }); }}
            style={{ flex: 1, background: "#30363d", color: "#ccc" }}
          >
            🚪 Leave
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Room page — handles joining via URL ───────────────────────────────────────

function RoomPage() {
  const { roomId: urlRoomId = "" } = useParams<{ roomId: string }>();
  const { join, leave, gameState, roomId, connected, error, clearError } = useGameStore();
  const navigate = useNavigate();

  const savedName = localStorage.getItem("hexlands_name");
  const savedRoom = localStorage.getItem("hexlands_room");
  const isJoined = !!roomId;

  // Auto-join if we have credentials for this room
  useEffect(() => {
    if (!isJoined && savedName && savedRoom === urlRoomId) {
      join(urlRoomId, savedName);
    }
  }, []);

  // Disconnect guard: if connection drops after being established, redirect home
  const wasConnected = useRef(false);
  const [disconnecting, setDisconnecting] = useState(false);
  useEffect(() => {
    if (connected) {
      wasConnected.current = true;
      setDisconnecting(false);
      return;
    }
    if (!wasConnected.current) return; // haven't connected yet on this page
    setDisconnecting(true);
    const t = setTimeout(() => {
      leave();
      navigate("/", { replace: true });
    }, 3000);
    return () => clearTimeout(t);
  }, [connected]);

  if (!isJoined) {
    return <JoinForm defaultRoom={urlRoomId} />;
  }

  const disconnectBanner = disconnecting && (
    <div className="error-banner">
      ⚡ Connection lost — returning to lobby…
    </div>
  );

  if (gameState) {
    return (
      <div className="app">
        {disconnectBanner}
        {error && (
          <div className="error-banner" onClick={clearError}>
            ⚠️ {error} <small>(click to dismiss)</small>
          </div>
        )}
        {gameState.phase === "ended" && <GameOverScreen state={gameState} />}
        <div className="game-layout">
          <div className="board-area">
            <BoardView state={gameState} />
            {gameState.tradeOffer && <TradeOfferOverlay state={gameState} />}
            <div style={{
              position: "absolute",
              top: 14,
              left: "50%",
              transform: "translateX(-50%)",
              pointerEvents: "none",
              zIndex: 10,
            }}>
              <TipOfTheDay />
            </div>
          </div>
          <div className="panel-area">
            <PlayerPanel state={gameState} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {disconnectBanner}
      {error && (
        <div className="error-banner" onClick={clearError}>
          ⚠️ {error} <small>(click to dismiss)</small>
        </div>
      )}
      <WaitingRoom />
    </div>
  );
}

// ── Root page ─────────────────────────────────────────────────────────────────

function RootPage() {
  const { roomId, gameState } = useGameStore();
  const navigate = useNavigate();

  // Restore session if we have saved credentials
  useEffect(() => {
    const savedName = localStorage.getItem("hexlands_name");
    const savedRoom = localStorage.getItem("hexlands_room");
    if (savedName && savedRoom) {
      navigate(`/room/${savedRoom}`, { replace: true });
    }
  }, []);

  if (roomId || gameState) {
    navigate(`/room/${roomId}`, { replace: true });
    return null;
  }

  return <JoinForm defaultRoom="" />;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <>
      <FlyingResourcesOverlay />
      <Routes>
        <Route path="/" element={<RootPage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        <Route path="/tutorial" element={<Tutorial />} />
      </Routes>
    </>
  );
}
