import { create } from "zustand";
import type { Action, ClientGameState } from "@catan/shared";
import { socket } from "./socket.js";

interface GameStore {
  // Connection
  roomId: string;
  playerName: string;
  connected: boolean;
  error: string | null;

  // Game
  gameState: ClientGameState | null;
  gameStarted: boolean;

  // UI selection state
  selectedVertexId: string | null;
  selectedEdgeId: string | null;

  // Actions
  join: (roomId: string, name: string) => void;
  startGame: () => void;
  sendAction: (action: Action) => void;
  selectVertex: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  clearError: () => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  // Wire up socket listeners once
  socket.on("connect", () => set({ connected: true }));
  socket.on("disconnect", () => set({ connected: false }));
  socket.on("gameState", (state) => set({ gameState: state }));
  socket.on("gameStarted", () => set({ gameStarted: true }));
  socket.on("error", (msg) => set({ error: msg }));

  return {
    roomId: "",
    playerName: "",
    connected: false,
    error: null,
    gameState: null,
    gameStarted: false,
    selectedVertexId: null,
    selectedEdgeId: null,

    join(roomId, playerName) {
      set({ roomId, playerName });
      socket.connect();
      socket.emit("joinRoom", roomId, playerName);
    },

    startGame() {
      socket.emit("startGame");
    },

    sendAction(action) {
      socket.emit("action", action);
      set({ selectedVertexId: null, selectedEdgeId: null });
    },

    selectVertex: (id) => set({ selectedVertexId: id, selectedEdgeId: null }),
    selectEdge: (id) => set({ selectedEdgeId: id, selectedVertexId: null }),
    clearError: () => set({ error: null }),
  };
});
