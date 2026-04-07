/**
 * useSoundEffects
 *
 * Watches the game state for meaningful changes and plays the appropriate
 * sound. The server never instructs the client to play a sound — instead
 * this hook diffs the previous and next state on every update.
 *
 * Adding a new sound trigger: add a check in the effect below, call
 * sounds.play("<key>"), done.
 */

import { useEffect, useRef } from "react";
import type { ClientGameState } from "@catan/shared";
import { sounds } from "../sounds.js";

export function useSoundEffects(state: ClientGameState | null): void {
  const prevRef = useRef<ClientGameState | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = state;

    if (!state) return;

    // ── First state received (game just started) ───────────────────────────
    if (!prev) return;

    const myId = state.myPlayerId;
    const isMyTurn = state.players[state.currentPlayerIndex]?.id === myId;
    const wasMyTurn = prev.players[prev.currentPlayerIndex]?.id === myId;

    // ── It became your turn ────────────────────────────────────────────────
    if (isMyTurn && !wasMyTurn) {
      sounds.play("yourTurn");
      return; // yourTurn covers the turn transition; skip other checks
    }

    // ── Dice rolled ────────────────────────────────────────────────────────
    if (state.dice && !prev.dice) {
      sounds.play("diceRoll");
    }

    // ── Robber moved ───────────────────────────────────────────────────────
    const prevRobber = prev.board.tiles.find((t) => t.hasRobber)?.coord;
    const nextRobber = state.board.tiles.find((t) => t.hasRobber)?.coord;
    if (
      prevRobber &&
      nextRobber &&
      (prevRobber.q !== nextRobber.q || prevRobber.r !== nextRobber.r)
    ) {
      sounds.play("robber");
    }

    // ── Buildings placed ───────────────────────────────────────────────────
    const prevBuildingCount = Object.keys(prev.board.buildings).length;
    const nextBuildingCount = Object.keys(state.board.buildings).length;

    if (nextBuildingCount > prevBuildingCount) {
      // Find the newly added building
      const newVertexId = Object.keys(state.board.buildings).find(
        (v) => !prev.board.buildings[v]
      );
      if (newVertexId) {
        const building = state.board.buildings[newVertexId];
        sounds.play(building.type === "city" ? "placeCity" : "placeSettlement");
      }
    } else {
      // Check for settlement → city upgrades (count stays same, type changes)
      for (const [vid, building] of Object.entries(state.board.buildings)) {
        if (
          building.type === "city" &&
          prev.board.buildings[vid]?.type === "settlement"
        ) {
          sounds.play("placeCity");
          break;
        }
      }
    }

    // ── Road placed ────────────────────────────────────────────────────────
    if (
      Object.keys(state.board.roads).length >
      Object.keys(prev.board.roads).length
    ) {
      sounds.play("placeRoad");
    }

    // ── Dev card bought ────────────────────────────────────────────────────
    const myState = state.players.find((p) => p.id === myId);
    const myPrev  = prev.players.find((p) => p.id === myId);
    if (
      myState &&
      myPrev &&
      myState.devCards.length + myState.devCardsBoughtThisTurn.length >
      myPrev.devCards.length  + myPrev.devCardsBoughtThisTurn.length
    ) {
      sounds.play("buyDevCard");
    }

    // ── Knight played ──────────────────────────────────────────────────────
    const totalKnightsPrev = prev.players.reduce((s, p) => s + p.knightsPlayed, 0);
    const totalKnightsNext = state.players.reduce((s, p) => s + p.knightsPlayed, 0);
    if (totalKnightsNext > totalKnightsPrev) {
      sounds.play("playKnight");
    }

    // ── Trade completed ────────────────────────────────────────────────────
    // Detect a completed player trade: tradeOffer was present, now null,
    // and someone's resources changed.
    if (prev.tradeOffer && !state.tradeOffer) {
      const resourcesChanged = state.players.some((p, i) => {
        const pp = prev.players[i];
        return pp && JSON.stringify(p.resources) !== JSON.stringify(pp.resources);
      });
      if (resourcesChanged) {
        sounds.play("trade");
      }
    }

    // ── Game over ──────────────────────────────────────────────────────────
    if (state.winnerId && !prev.winnerId) {
      sounds.play(state.winnerId === myId ? "win" : "lose");
    }
  }, [state]);
}
