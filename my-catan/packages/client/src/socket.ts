import { io } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@hexlands/shared";

// In development, connect to the same origin (Vite proxies to :3001).
// In production, VITE_SERVER_URL is set to the Fly.io server URL.
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "";

/** Single shared socket instance. */
export const socket = io(SERVER_URL, {
  autoConnect: false,
});

export type AppSocket = typeof socket;
