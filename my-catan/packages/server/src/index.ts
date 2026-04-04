import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@catan/shared";
import { GameRoom } from "./GameRoom.js";

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: "*" },
  pingInterval: 5000,
  pingTimeout: 3000,
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// ── Room registry ─────────────────────────────────────────────────────────────

const rooms = new Map<string, GameRoom>();

function getOrCreateRoom(roomId: string): GameRoom {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new GameRoom(roomId, io));
  }
  return rooms.get(roomId)!;
}

// ── Socket handlers ───────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[+] ${socket.id} connected`);

  let currentRoomId: string | null = null;

  socket.on("joinRoom", (roomId, playerName, playerId) => {
    if (!roomId || !playerName || !playerId) {
      socket.emit("error", "roomId, playerName and playerId are required");
      return;
    }

    const room = getOrCreateRoom(roomId);
    const result = room.addPlayer(socket, playerName, playerId);

    if (typeof result === "string") {
      socket.emit("error", result);
      return;
    }

    const { player, reconnected } = result;
    currentRoomId = roomId;
    socket.join(roomId);

    if (reconnected) {
      socket.emit("gameStarted");
      console.log(`  ${playerName} reconnected to room ${roomId}`);
    } else {
      // Broadcast the full current player list to everyone in the room
      for (const p of room.getRoomPlayers()) {
        io.to(roomId).emit("playerJoined", p);
      }
      console.log(`  ${playerName} joined room ${roomId}`);
    }
  });

  socket.on("startGame", () => {
    if (!currentRoomId) {
      socket.emit("error", "Not in a room");
      return;
    }
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const err = room.startGame(socket.id);
    if (err) {
      socket.emit("error", err);
      return;
    }

    io.to(currentRoomId).emit("gameStarted");
    console.log(`  Room ${currentRoomId} game started`);
  });

  socket.on("restartGame", () => {
    if (!currentRoomId) { socket.emit("error", "Not in a room"); return; }
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const err = room.restartGame(socket.id);
    if (err) socket.emit("error", err);
    else console.log(`  Room ${currentRoomId} restarted`);
  });

  socket.on("action", (action) => {
    if (!currentRoomId) {
      socket.emit("error", "Not in a room");
      return;
    }
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const err = room.handleAction(socket.id, action);
    if (err) {
      console.error(`[action error] ${socket.id} → ${JSON.stringify(action)} — ${err}`);
      socket.emit("error", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`[-] ${socket.id} disconnected`);
    if (currentRoomId) {
      rooms.get(currentRoomId)?.removePlayer(socket.id);
    }
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`Catan server listening on http://localhost:${PORT}`);
});
