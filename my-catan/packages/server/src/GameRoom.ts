import type { Action, ClientGameState, GameState, PlayerColor } from "@catan/shared";
import { applyAction, createGame, PLAYER_COLORS } from "@catan/shared";
import type { Server, Socket } from "socket.io";

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

  constructor(id: string, io: Server) {
    this.id = id;
    this.io = io;
  }

  get playerCount(): number {
    return this.players.length;
  }

  getRoomPlayers(): Array<{ id: string; name: string; color: PlayerColor }> {
    return this.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
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
      this.broadcast();
    } else {
      this.players = this.players.filter((p) => p.socketId !== socketId);
      this.io.to(this.id).emit("playerLeft", player.id);
    }
  }

  restartGame(socketId: string): string | null {
    if (!this.hasStarted) return "Game not started";
    if (!this.players.find((p) => p.socketId === socketId)) return "Not in room";

    this.state = createGame(
      this.id,
      this.players.map((p) => ({ id: p.id, name: p.name, color: p.color }))
    );
    this.broadcast();
    return null;
  }

  startGame(socketId: string): string | null {
    if (this.hasStarted) return "Already started";
    if (this.players.length < 2) return "Need at least 2 players";
    const requester = this.players.find((p) => p.socketId === socketId);
    if (!requester) return "Not in room";

    this.state = createGame(
      this.id,
      this.players.map((p) => ({ id: p.id, name: p.name, color: p.color }))
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
  }

  /** Strip hidden information for the receiving player. */
  private toClientState(state: GameState, forPlayerId: string): ClientGameState {
    return {
      ...state,
      devCardDeckSize: state.devCardDeck.length,
      myPlayerId: forPlayerId,
      players: state.players.map((p) => {
        if (p.id === forPlayerId) return p;
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
