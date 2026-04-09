import { create } from "zustand";
import type { Action, ChatMessage, ClientGameState, PlayerColor } from "@hexlands/shared";
import { socket } from "./socket.js";
import * as sounds from "./sounds.js";

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

  // Chat
  chatMessages: ChatMessage[];

  // UI selection state
  selectedVertexId: string | null;
  selectedEdgeId: string | null;
  hoveredRoadPlayerId: string | null;

  // Actions
  join: (roomId: string, name: string) => void;
  leave: () => void;
  startGame: () => void;
  sendAction: (action: Action) => void;
  sendChat: (message: string) => void;
  restartGame: () => void;
  selectVertex: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setHoveredRoadPlayer: (id: string | null) => void;
  clearError: () => void;
}

// Track previous game state for sound diffing
let prevState: ClientGameState | null = null;

function detectAndPlaySounds(next: ClientGameState): void {
  const prev = prevState;
  if (!prev) return;

  // Dice rolled
  if (next.dice && !prev.dice) sounds.playDiceRoll();

  // New building placed
  const prevBuildingCount = Object.keys(prev.board.buildings).length;
  const nextBuildingCount = Object.keys(next.board.buildings).length;
  if (nextBuildingCount > prevBuildingCount) {
    const newEntry = Object.entries(next.board.buildings).find(([k]) => !prev.board.buildings[k]);
    if (newEntry?.[1].type === "city") sounds.playCity();
    else sounds.playSettle();
  }

  // New road placed
  if (Object.keys(next.board.roads).length > Object.keys(prev.board.roads).length) {
    sounds.playRoad();
  }

  // Robber moved
  const prevRobberKey = JSON.stringify(prev.board.tiles.find((t) => t.hasRobber)?.coord);
  const nextRobberKey = JSON.stringify(next.board.tiles.find((t) => t.hasRobber)?.coord);
  if (prevRobberKey !== nextRobberKey) sounds.playRobber();

  // Dev card played (current player's devCardsPlayed grew)
  const myId = next.myPlayerId;
  const prevMe = prev.players.find((p) => p.id === myId);
  const nextMe = next.players.find((p) => p.id === myId);
  if (prevMe && nextMe && nextMe.devCardsPlayed.length > prevMe.devCardsPlayed.length) {
    sounds.playDevCard();
  }

  // Game ended
  if (next.phase === "ended" && prev.phase !== "ended") sounds.playWin();
}

export const useGameStore = create<GameStore>((set, get) => {
  socket.on("connect", () => set({ connected: true }));
  socket.on("disconnect", () => set({ connected: false }));
  socket.on("gameState", (state) => {
    detectAndPlaySounds(state);
    prevState = state;
    set({ gameState: state });
  });
  socket.on("gameStarted", () => set({ gameStarted: true }));
  socket.on("error", (msg) => set({ error: msg }));
  socket.on("playerJoined", (player) =>
    set((s) => ({ waitingPlayers: [...s.waitingPlayers.filter((p) => p.id !== player.id), player] }))
  );
  socket.on("playerLeft", (playerId) =>
    set((s) => ({ waitingPlayers: s.waitingPlayers.filter((p) => p.id !== playerId) }))
  );
  socket.on("chatMessage", (msg) => {
    // Only play sound if it's not from us
    const myId = get().gameState?.myPlayerId;
    if (msg.playerId !== myId) sounds.playChatReceived();
    set((s) => ({ chatMessages: [...s.chatMessages, msg] }));
  });

  return {
    roomId: "",
    playerName: "",
    connected: false,
    error: null,
    waitingPlayers: [],
    gameState: null,
    gameStarted: false,
    chatMessages: [],
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
      prevState = null;
      localStorage.removeItem("catan_room");
      set({
        roomId: "",
        playerName: "",
        connected: false,
        waitingPlayers: [],
        gameState: null,
        gameStarted: false,
        chatMessages: [],
        error: null,
      });
    },

    startGame() {
      socket.emit("startGame");
    },

    restartGame() {
      prevState = null;
      socket.emit("restartGame");
    },

    sendAction(action) {
      socket.emit("action", action);
      set({ selectedVertexId: null, selectedEdgeId: null });
    },

    sendChat(message) {
      socket.emit("sendChat", message);
    },

    selectVertex: (id) => set({ selectedVertexId: id, selectedEdgeId: null }),
    selectEdge: (id) => set({ selectedEdgeId: id, selectedVertexId: null }),
    setHoveredRoadPlayer: (id) => set({ hoveredRoadPlayerId: id }),
    clearError: () => set({ error: null }),
  };
});
