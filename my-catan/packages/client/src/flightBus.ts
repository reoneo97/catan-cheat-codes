/**
 * Lightweight event bus for cross-component resource flight animations.
 * Board.tsx fires triggerFlight(); FlyingResourcesOverlay.tsx subscribes.
 */

export type ResourceFlight = {
  id: string;
  emoji: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

type Listener = (flight: ResourceFlight) => void;
const listeners: Listener[] = [];

export function triggerFlight(flight: ResourceFlight): void {
  listeners.forEach((fn) => fn(flight));
}

export function subscribeFlight(fn: Listener): () => void {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}
