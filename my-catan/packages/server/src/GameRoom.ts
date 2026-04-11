import type { Action, ClientGameState, GameState, PlayerColor } from "@hexlands/shared";
import { applyAction, createGame, DEFAULT_LAYOUT_ID, LAYOUTS, PLAYER_COLORS } from "@hexlands/shared";
import type { Server, Socket } from "socket.io";
import { loadRoom, saveRoom } from "./redis.js";

interface RoomPlayer {
  id: string;
  name: string;
  color: PlayerColor;
  socketId: string;
}

export class GameRoom {
  readonly id: string;
  private players: RoomPlayer[] = [];
  private state: GameState | null = null;
  private io: Server;
  private layoutId: string;

  constructor(id: string, io: Server, layoutId = DEFAULT_LAYOUT_ID) {
    this.id = id;
    this.io = io;
    this.layoutId = LAYOUTS[layoutId] ? layoutId : DEFAULT_LAYOUT_ID;
  }

  setLayout(layoutId: string): string | null {
    if (this.hasStarted) return "Cannot change layout after game has started";
    if (!LAYOUTS[layoutId]) return `Unknown layout: ${layoutId}`;
    this.layoutId = layoutId;
    return null;
  }

  get playerCount(): number {
    return this.players.length;
  }

  getRoomPlayers(): Array<{ id: string; name: string; color: PlayerColor }> {
    return this.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
  }

  getPlayerBySocket(socketId: string): { id: string; name: string; color: PlayerColor } | undefined {
    const p = this.players.find((p) => p.socketId === socketId);
    return p ? { id: p.id, name: p.name, color: p.color } : undefined;
  }

  get hasStarted(): boolean {
    return this.state !== null;
  }

  addPlayer(socket: Socket, name: string, playerId: string): { player: RoomPlayer; reconnected: boolean } | string {
    if (this.hasStarted) {
      const existing = this.players.find((p) => p.id === playerId);
      if (!existing) return "Game already started";

      // Reconnect: swap in the new socket
      existing.socketId = socket.id;
      if (this.state) {
        const p = this.state.players.find((p) => p.id === playerId);
        if (p) p.connected = true;
        this.io.to(socket.id).emit("gameState", this.toClientState(this.state, playerId));
        this.broadcast();
      }
      return { player: existing, reconnected: true };
    }

    // Deduplicate: same player rejoining before game starts (e.g. page refresh or React StrictMode)
    const existing = this.players.find((p) => p.id === playerId);
    if (existing) {
      existing.socketId = socket.id;
      return { player: existing, reconnected: false };
    }

    if (this.players.length >= 4) return "Room is full";

    const usedColors = new Set(this.players.map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !usedColors.has(c))!;
    const player: RoomPlayer = { id: playerId, name, color, socketId: socket.id };
    this.players.push(player);
    return { player, reconnected: false };
  }

  removePlayer(socketId: string): void {
    const player = this.players.find((p) => p.socketId === socketId);
    if (!player) return;

    if (this.state) {
      const p = this.state.players.find((p) => p.id === player.id);
      if (p) p.connected = false;

      // If the game is still active and only one player remains connected, they win
      if (this.state.phase !== "ended") {
        const connected = this.state.players.filter((p) => p.connected);
        if (connected.length === 1) {
          this.state.winnerId = connected[0].id;
          this.state.phase = "ended";
          this.state.log.push(`${connected[0].name} wins — all other players disconnected!`);
        }
      }

      this.broadcast();
    } else {
      this.players = this.players.filter((p) => p.socketId !== socketId);
      this.io.to(this.id).emit("playerLeft", player.id);
    }
  }

  restartGame(socketId: string): string | null {
    if (!this.hasStarted) return "Game not started";
    if (!this.players.find((p) => p.socketId === socketId)) return "Not in room";

    const layout = LAYOUTS[this.layoutId];
    this.state = createGame(
      this.id,
      this.players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
      layout
    );
    this.broadcast();
    return null;
  }

  startGame(socketId: string): string | null {
    if (this.hasStarted) return "Already started";
    if (this.players.length < 2) return "Need at least 2 players";
    if (!this.players.find((p) => p.socketId === socketId)) return "Not in room";

    const layout = LAYOUTS[this.layoutId];
    this.state = createGame(
      this.id,
      this.players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
      layout
    );
    this.broadcast();
    return null;
  }

  handleAction(socketId: string, action: Action): string | null {
    if (!this.state) return "Game not started";
    const player = this.players.find((p) => p.socketId === socketId);
    if (!player) return "Not in room";

    try {
      this.state = applyAction(this.state, player.id, action);
      this.broadcast();
      return null;
    } catch (err) {
      return typeof err === "string" ? err : "Invalid action";
    }
  }

  /** Broadcast game state to all sockets in the room, personalised per player. */
  private broadcast(): void {
    if (!this.state) return;

    for (const roomPlayer of this.players) {
      const clientState = this.toClientState(this.state, roomPlayer.id);
      this.io.to(roomPlayer.socketId).emit("gameState", clientState);
    }

    // Fire-and-forget persistence — errors are logged inside saveRoom
    saveRoom(this.id, {
      state: this.state,
      players: this.players.map(({ id, name, color }) => ({ id, name, color })),
    }).catch(() => undefined);
  }

  /** Restore a room from Redis. Returns null if nothing stored. */
  static async load(roomId: string, io: Server): Promise<GameRoom | null> {
    const data = await loadRoom(roomId) as { state: GameState; players: Array<{ id: string; name: string; color: PlayerColor }> } | null;
    if (!data?.state || !data?.players) return null;

    const room = new GameRoom(roomId, io);
    room.state = data.state;
    // socketIds are session-specific — they'll be filled in as players reconnect
    room.players = data.players.map((p) => ({ ...p, socketId: "" }));
    console.log(`  [redis] restored room ${roomId} (${room.players.length} players, phase=${data.state.phase})`);
    return room;
  }

  /** Strip hidden information for the receiving player. */
  private toClientState(state: GameState, forPlayerId: string): ClientGameState {
    const gameEnded = state.phase === "ended";
    return {
      ...state,
      devCardDeckSize: state.devCardDeck.length,
      myPlayerId: forPlayerId,
      players: state.players.map((p) => {
        if (p.id === forPlayerId || gameEnded) return p;
        // Hide dev card contents from other players (keep count only)
        return {
          ...p,
          devCards: Array(p.devCards.length).fill("unknown") as never,
          devCardsBoughtThisTurn: Array(p.devCardsBoughtThisTurn.length).fill("unknown") as never,
        };
      }),
    };
  }
}
