import { useState } from "react";
import { LAYOUTS } from "@catan/shared";
import { useGameStore } from "./store.js";
import { BoardView } from "./components/Board.js";
import { PlayerPanel } from "./components/PlayerPanel.js";
import "./App.css";

function Lobby() {
  const { join, startGame, setLayout, connected, gameStarted, playerName, roomId, selectedLayoutId } = useGameStore();
  const [nameInput, setNameInput] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [joined, setJoined] = useState(false);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!nameInput || !roomInput) return;
    join(roomInput, nameInput);
    setJoined(true);
  }

  if (!joined) {
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

  if (!gameStarted) {
    return (
      <div className="lobby">
        <h1>🏝️ Catan</h1>
        <p>
          Waiting in room <strong>{roomId}</strong> as <strong>{playerName}</strong>…
        </p>
        <p style={{ color: connected ? "#27ae60" : "#e74c3c", fontSize: 13 }}>
          {connected ? "Connected" : "Connecting…"}
        </p>
        <button onClick={startGame} style={{ marginTop: 16 }}>
          Start Game
        </button>
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12, color: "#aaa", marginBottom: 6 }}>Map layout:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.values(LAYOUTS).map((layout) => (
              <label
                key={layout.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: `1px solid ${selectedLayoutId === layout.id ? "#f0c040" : "#30363d"}`,
                  background: selectedLayoutId === layout.id ? "rgba(240,192,64,0.08)" : "transparent",
                }}
              >
                <input
                  type="radio"
                  name="layout"
                  value={layout.id}
                  checked={selectedLayoutId === layout.id}
                  onChange={() => setLayout(layout.id)}
                />
                <span>
                  <strong style={{ color: "#e0e0e0" }}>{layout.label}</strong>
                  <span style={{ color: "#888", fontSize: 11, marginLeft: 8 }}>
                    {layout.players.min}–{layout.players.max} players · {layout.landHexes.length} hexes
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#888", marginTop: 12 }}>
          Share the room ID with friends.
        </p>
      </div>
    );
  }

  return null;
}

export default function App() {
  const { gameState, error, clearError } = useGameStore();

  return (
    <div className="app">
      {error && (
        <div className="error-banner" onClick={clearError}>
          ⚠️ {error} <small>(click to dismiss)</small>
        </div>
      )}

      {!gameState ? (
        <Lobby />
      ) : (
        <div className="game-layout">
          <div className="board-area">
            <BoardView state={gameState} />
          </div>
          <div className="panel-area">
            <PlayerPanel state={gameState} />
          </div>
        </div>
      )}
    </div>
  );
}
