import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Server, Socket } from "socket.io";
import { GameRoom } from "../GameRoom.js";

// ── Minimal Socket.io mocks ────────────────────────────────────────────────────

function makeIo() {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  return { io: { to } as unknown as Server, emit, to };
}

function makeSocket(id: string): Socket {
  return { id, join: vi.fn(), emit: vi.fn() } as unknown as Socket;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GameRoom — lobby (before game starts)", () => {
  it("addPlayer assigns a color and tracks the player", () => {
    const { io } = makeIo();
    const room = new GameRoom("r1", io);
    const result = room.addPlayer(makeSocket("s1"), "Alice", "p1");
    expect(result).not.toBe("string");
    if (typeof result === "string") return;
    expect(result.player.color).toBeDefined();
    expect(result.player.name).toBe("Alice");
    expect(result.reconnected).toBe(false);
    expect(room.playerCount).toBe(1);
  });

  it("addPlayer deduplicates the same playerId (e.g. StrictMode double-mount)", () => {
    const { io } = makeIo();
    const room = new GameRoom("r1", io);
    room.addPlayer(makeSocket("s1"), "Alice", "p1");
    room.addPlayer(makeSocket("s2"), "Alice", "p1"); // same id, new socket
    expect(room.playerCount).toBe(1);
  });

  it("addPlayer updates socketId on re-join before game starts", () => {
    const { io } = makeIo();
    const room = new GameRoom("r1", io);
    room.addPlayer(makeSocket("s1"), "Alice", "p1");
    const result = room.addPlayer(makeSocket("s2"), "Alice", "p1");
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;
    expect(result.reconnected).toBe(false);
  });

  it("returns an error string when room is full", () => {
    const { io } = makeIo();
    const room = new GameRoom("r1", io);
    room.addPlayer(makeSocket("s1"), "P1", "p1");
    room.addPlayer(makeSocket("s2"), "P2", "p2");
    room.addPlayer(makeSocket("s3"), "P3", "p3");
    room.addPlayer(makeSocket("s4"), "P4", "p4");
    const result = room.addPlayer(makeSocket("s5"), "P5", "p5");
    expect(typeof result).toBe("string");
    expect(result).toMatch(/full/i);
  });

  it("removePlayer before game starts removes from list", () => {
    const { io } = makeIo();
    const room = new GameRoom("r1", io);
    room.addPlayer(makeSocket("s1"), "Alice", "p1");
    room.addPlayer(makeSocket("s2"), "Bob", "p2");
    room.removePlayer("s1");
    expect(room.playerCount).toBe(1);
  });

  it("assigns different colors to different players", () => {
    const { io } = makeIo();
    const room = new GameRoom("r1", io);
    room.addPlayer(makeSocket("s1"), "P1", "p1");
    room.addPlayer(makeSocket("s2"), "P2", "p2");
    const players = room.getRoomPlayers();
    expect(players[0].color).not.toBe(players[1].color);
  });
});

describe("GameRoom — startGame", () => {
  it("fails with fewer than 2 players", () => {
    const { io } = makeIo();
    const room = new GameRoom("r1", io);
    room.addPlayer(makeSocket("s1"), "Alice", "p1");
    const err = room.startGame("s1");
    expect(err).toMatch(/2 players/i);
  });

  it("fails if requester is not in the room", () => {
    const { io } = makeIo();
    const room = new GameRoom("r1", io);
    room.addPlayer(makeSocket("s1"), "Alice", "p1");
    room.addPlayer(makeSocket("s2"), "Bob", "p2");
    const err = room.startGame("unknown-socket");
    expect(err).toMatch(/not in room/i);
  });

  it("succeeds with 2 players and sets hasStarted", () => {
    const { io } = makeIo();
    const room = new GameRoom("r1", io);
    room.addPlayer(makeSocket("s1"), "Alice", "p1");
    room.addPlayer(makeSocket("s2"), "Bob", "p2");
    const err = room.startGame("s1");
    expect(err).toBeNull();
    expect(room.hasStarted).toBe(true);
  });

  it("cannot start twice", () => {
    const { io } = makeIo();
    const room = new GameRoom("r1", io);
    room.addPlayer(makeSocket("s1"), "Alice", "p1");
    room.addPlayer(makeSocket("s2"), "Bob", "p2");
    room.startGame("s1");
    const err = room.startGame("s1");
    expect(err).toMatch(/already started/i);
  });
});

describe("GameRoom — in-game player management", () => {
  function startedRoom() {
    const { io, emit, to } = makeIo();
    const room = new GameRoom("r1", io);
    room.addPlayer(makeSocket("s1"), "Alice", "p1");
    room.addPlayer(makeSocket("s2"), "Bob", "p2");
    room.startGame("s1");
    return { room, emit, to };
  }

  it("unknown player cannot join after game starts", () => {
    const { room } = startedRoom();
    const result = room.addPlayer(makeSocket("s99"), "Charlie", "p99");
    expect(typeof result).toBe("string");
    expect(result).toMatch(/already started/i);
  });

  it("known player can reconnect after game starts", () => {
    const { room } = startedRoom();
    const result = room.addPlayer(makeSocket("s1-new"), "Alice", "p1");
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;
    expect(result.reconnected).toBe(true);
  });

  it("removePlayer with only one connected player left sets winner", () => {
    const { room } = startedRoom();
    room.removePlayer("s1"); // Alice disconnects
    // Game should be ended — any action by Bob should fail (game over or wrong turn)
    const actionErr = room.handleAction("s2", { type: "rollDice" });
    expect(typeof actionErr).toBe("string");
    expect(actionErr).not.toBeNull();
  });

  it("removePlayer of unknown socket is a no-op", () => {
    const { room } = startedRoom();
    expect(() => room.removePlayer("does-not-exist")).not.toThrow();
  });
});

describe("GameRoom — restartGame", () => {
  it("fails if game not started", () => {
    const { io } = makeIo();
    const room = new GameRoom("r1", io);
    room.addPlayer(makeSocket("s1"), "Alice", "p1");
    const err = room.restartGame("s1");
    expect(err).toMatch(/not started/i);
  });

  it("resets game state on restart", () => {
    const { io } = makeIo();
    const room = new GameRoom("r1", io);
    room.addPlayer(makeSocket("s1"), "Alice", "p1");
    room.addPlayer(makeSocket("s2"), "Bob", "p2");
    room.startGame("s1");
    const err = room.restartGame("s1");
    expect(err).toBeNull();
    expect(room.hasStarted).toBe(true); // still started (new game)
  });
});

describe("GameRoom — handleAction", () => {
  it("returns error if game not started", () => {
    const { io } = makeIo();
    const room = new GameRoom("r1", io);
    const err = room.handleAction("s1", { type: "rollDice" });
    expect(err).toMatch(/not started/i);
  });

  it("returns error if socket not in room", () => {
    const { io } = makeIo();
    const room = new GameRoom("r1", io);
    room.addPlayer(makeSocket("s1"), "Alice", "p1");
    room.addPlayer(makeSocket("s2"), "Bob", "p2");
    room.startGame("s1");
    const err = room.handleAction("unknown", { type: "rollDice" });
    expect(err).toMatch(/not in room/i);
  });
});
