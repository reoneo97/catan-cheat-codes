import { create } from "zustand";
import type { Action, ClientGameState, PlayerColor } from "@catan/shared";
import { socket } from "./socket.js";

function getOrCreatePlayerId(): string {
  const existing = localStorage.getItem("catan_player_id");
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem("catan_player_id", id);
  return id;
}

export interface WaitingPlayer {
  id: string;
  name: string;
  color: PlayerColor;
}

interface GameStore {
  // Connection
  roomId: string;
  playerName: string;
  connected: boolean;
  error: string | null;

  // Lobby
  waitingPlayers: WaitingPlayer[];

  // Game
  gameState: ClientGameState | null;
  gameStarted: boolean;

  // UI selection state
  selectedVertexId: string | null;
  selectedEdgeId: string | null;
  hoveredRoadPlayerId: string | null;

  // Actions
  join: (roomId: string, name: string) => void;
  leave: () => void;
  startGame: () => void;
  sendAction: (action: Action) => void;
  restartGame: () => void;
  selectVertex: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setHoveredRoadPlayer: (id: string | null) => void;
  clearError: () => void;
}

export const useGameStore = create<GameStore>((set) => {
  socket.on("connect", () => set({ connected: true }));
  socket.on("disconnect", () => set({ connected: false }));
  socket.on("gameState", (state) => set({ gameState: state }));
  socket.on("gameStarted", () => set({ gameStarted: true }));
  socket.on("error", (msg) => set({ error: msg }));
  socket.on("playerJoined", (player) =>
    set((s) => ({ waitingPlayers: [...s.waitingPlayers.filter((p) => p.id !== player.id), player] }))
  );
  socket.on("playerLeft", (playerId) =>
    set((s) => ({ waitingPlayers: s.waitingPlayers.filter((p) => p.id !== playerId) }))
  );

  return {
    roomId: "",
    playerName: "",
    connected: false,
    error: null,
    waitingPlayers: [],
    gameState: null,
    gameStarted: false,
    selectedVertexId: null,
    selectedEdgeId: null,
    hoveredRoadPlayerId: null,

    join(roomId, playerName) {
      set({ roomId, playerName });
      socket.connect();
      socket.emit("joinRoom", roomId, playerName, getOrCreatePlayerId());
    },

    leave() {
      socket.disconnect();
      localStorage.removeItem("catan_room");
      set({
        roomId: "",
        playerName: "",
        connected: false,
        waitingPlayers: [],
        gameState: null,
        gameStarted: false,
        error: null,
      });
    },

    startGame() {
      socket.emit("startGame");
    },

    restartGame() {
      socket.emit("restartGame");
    },

    sendAction(action) {
      socket.emit("action", action);
      set({ selectedVertexId: null, selectedEdgeId: null });
    },

    selectVertex: (id) => set({ selectedVertexId: id, selectedEdgeId: null }),
    selectEdge: (id) => set({ selectedEdgeId: id, selectedVertexId: null }),
    setHoveredRoadPlayer: (id) => set({ hoveredRoadPlayerId: id }),
    clearError: () => set({ error: null }),
  };
});
