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

function GameOverScreen({ state }: { state: ClientGameState }) {
  const { restartGame, leave } = useGameStore();
  const navigate = useNavigate();
  const winner = state.players.find((p) => p.id === state.winnerId);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000,
    }}>
      <div style={{
        background: "#161b22", border: "2px solid #f0c040",
        borderRadius: 16, padding: "40px 48px",
        textAlign: "center", minWidth: 340, maxWidth: 420,
      }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>🏆</div>
        <h2 style={{ color: "#f0c040", fontSize: 28, marginBottom: 6 }}>Game Over</h2>
        {winner && (
          <p style={{ color: PLAYER_COLOR[winner.color] ?? "#fff", fontSize: 22, fontWeight: "bold", marginBottom: 24 }}>
            {winner.name} wins!
          </p>
        )}

        {/* Final leaderboard */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
          {[...state.players]
            .sort((a, b) => b.publicVP - a.publicVP)
            .map((p, i) => (
              <div key={p.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 12px", borderRadius: 8,
                background: p.id === state.winnerId ? "rgba(240,192,64,0.12)" : "rgba(255,255,255,0.03)",
                border: p.id === state.winnerId ? "1px solid rgba(240,192,64,0.3)" : "1px solid transparent",
              }}>
                <span style={{ color: "#777", marginRight: 8, fontSize: 13 }}>#{i + 1}</span>
                <span style={{ flex: 1, textAlign: "left", color: PLAYER_COLOR[p.color] ?? "#eee", fontWeight: 600 }}>
                  {p.name}
                </span>
                <span style={{ color: "#f0c040", fontWeight: "bold" }}>{p.publicVP} VP</span>
              </div>
            ))}
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
