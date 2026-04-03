import { io } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@catan/shared";

/** Single shared socket instance. */
export const socket = io({
  autoConnect: false,
});

export type AppSocket = typeof socket;
