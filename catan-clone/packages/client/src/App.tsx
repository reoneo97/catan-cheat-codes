import { useState } from "react";
import { useGameStore } from "./store.js";
import { BoardView } from "./components/Board.js";
import { PlayerPanel } from "./components/PlayerPanel.js";
import "./App.css";

function Lobby() {
  const { join, startGame, connected, gameStarted, playerName, roomId } = useGameStore();
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
        <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
          Share the room ID with friends. Need 2–4 players.
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
