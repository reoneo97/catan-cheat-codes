import { useEffect, useState } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import { useGameStore } from "./store.js";
import { BoardView } from "./components/Board.js";
import { PlayerPanel } from "./components/PlayerPanel.js";
import { TipOfTheDay } from "./components/TipOfTheDay.js";
import "./App.css";

const PLAYER_COLOR: Record<string, string> = {
  red: "#e74c3c", blue: "#2980b9", green: "#27ae60", orange: "#e67e22",
};

// ── Join form (shown at / with no saved state) ────────────────────────────────

function JoinForm({ defaultRoom }: { defaultRoom: string }) {
  const { join } = useGameStore();
  const navigate = useNavigate();
  const [nameInput, setNameInput] = useState(() => localStorage.getItem("catan_name") ?? "");
  const [roomInput, setRoomInput] = useState(defaultRoom);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!nameInput || !roomInput) return;
    localStorage.setItem("catan_name", nameInput);
    localStorage.setItem("catan_room", roomInput);
    join(roomInput, nameInput);
    navigate(`/room/${roomInput}`, { replace: true });
  }

  return (
    <div className="lobby">
      <h1>🏝️ Catan</h1>
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
    localStorage.removeItem("catan_room");
    navigate("/", { replace: true });
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="lobby">
      <h1>🏝️ Catan</h1>

      <div className="room-card">
        <div className="room-label">Room</div>
        <div className="room-id">{roomId}</div>
        <div className="room-status" style={{ color: connected ? "#27ae60" : "#e74c3c" }}>
          {connected ? "● Connected" : "○ Connecting…"}
        </div>
      </div>

      <div className="room-card" style={{ width: "100%" }}>
        <div className="room-label">Invite link</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
          <code style={{ flex: 1, fontSize: 12, color: "#aaa", wordBreak: "break-all" }}>{shareUrl}</code>
          <button type="button" onClick={handleCopy} style={{ flexShrink: 0, padding: "4px 10px", fontSize: 12 }}>
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="room-card" style={{ width: "100%" }}>
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

      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button onClick={handleLeave} style={{ background: "#30363d", color: "#ccc" }}>
          ← Exit
        </button>
        <button onClick={startGame} disabled={waitingPlayers.length < 2}>
          Start Game
        </button>
      </div>

      <p style={{ fontSize: 12, color: "#555" }}>Need 2–4 players to start.</p>
      <TipOfTheDay />
    </div>
  );
}

// ── Room page — handles joining via URL ───────────────────────────────────────

function RoomPage() {
  const { roomId: urlRoomId = "" } = useParams<{ roomId: string }>();
  const { join, leave, gameState, gameStarted, roomId, error, clearError } = useGameStore();
  const navigate = useNavigate();

  const savedName = localStorage.getItem("catan_name");
  const savedRoom = localStorage.getItem("catan_room");
  const isJoined = !!roomId;

  // Auto-join if we have credentials for this room
  useEffect(() => {
    if (!isJoined && savedName && savedRoom === urlRoomId) {
      join(urlRoomId, savedName);
    }
  }, []);

  // If game ends and user restarts, stay on room page
  useEffect(() => {
    if (gameState && !gameStarted) {
      // gameState arrived before gameStarted (reconnect case) — that's fine
    }
  }, [gameState, gameStarted]);

  if (!isJoined) {
    return <JoinForm defaultRoom={urlRoomId} />;
  }

  if (gameState) {
    return (
      <div className="app">
        {error && (
          <div className="error-banner" onClick={clearError}>
            ⚠️ {error} <small>(click to dismiss)</small>
          </div>
        )}
        <div className="game-layout">
          <div className="board-area">
            <BoardView state={gameState} />
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
    const savedName = localStorage.getItem("catan_name");
    const savedRoom = localStorage.getItem("catan_room");
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
    <Routes>
      <Route path="/" element={<RootPage />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
    </Routes>
  );
}
