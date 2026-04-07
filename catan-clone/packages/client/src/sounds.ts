/**
 * Sound system.
 *
 * Audio files live in public/audio/. If a file is missing the play call
 * is silently skipped — no errors thrown, no console noise.
 *
 * Usage:
 *   import { sounds } from "./sounds";
 *   sounds.play("diceRoll");
 *   sounds.muted = true;
 */

export type SoundKey =
  | "diceRoll"
  | "placeSettlement"
  | "placeCity"
  | "placeRoad"
  | "buyDevCard"
  | "playKnight"
  | "robber"
  | "trade"
  | "yourTurn"
  | "win"
  | "lose";

const SOUND_FILES: Record<SoundKey, string> = {
  diceRoll:       "/audio/dice-roll.mp3",
  placeSettlement:"/audio/place-settlement.mp3",
  placeCity:      "/audio/place-city.mp3",
  placeRoad:      "/audio/place-road.mp3",
  buyDevCard:     "/audio/buy-dev-card.mp3",
  playKnight:     "/audio/play-knight.mp3",
  robber:         "/audio/robber.mp3",
  trade:          "/audio/trade.mp3",
  yourTurn:       "/audio/your-turn.mp3",
  win:            "/audio/win.mp3",
  lose:           "/audio/lose.mp3",
};

class SoundManager {
  private pool: Partial<Record<SoundKey, HTMLAudioElement>> = {};
  muted = false;

  constructor() {
    // Preload all sounds at startup so first play has no latency.
    // Uses a detached Audio element — no DOM attachment needed.
    for (const [key, path] of Object.entries(SOUND_FILES) as [SoundKey, string][]) {
      const audio = new Audio(path);
      audio.preload = "auto";
      // Mark as failed silently if file is missing so play() no-ops.
      audio.addEventListener("error", () => {
        delete this.pool[key];
      });
      this.pool[key] = audio;
    }
  }

  play(key: SoundKey, volume = 1): void {
    if (this.muted) return;
    const audio = this.pool[key];
    if (!audio) return;

    // Clone the element so rapid identical sounds can overlap.
    const instance = audio.cloneNode() as HTMLAudioElement;
    instance.volume = Math.max(0, Math.min(1, volume));
    instance.play().catch(() => {
      // Browsers block autoplay until the user has interacted with the page.
      // Silently ignore — the sound just won't play.
    });
  }
}

export const sounds = new SoundManager();
