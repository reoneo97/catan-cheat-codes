/**
 * Game engine — applies actions to produce the next game state.
 * Pure function: applyAction(state, playerId, action) → GameState
 *
 * Throws a string error message if the action is illegal.
 */

import type {
  Action,
  CubeCoord,
  DevCardType,
  GameState,
  Player,
  ResourceType,
  Resources,
  VertexId,
} from "./types.js";
import {
  BANK_INITIAL,
  BUILDING_COSTS,
  DEV_CARD_COUNTS,
  LARGEST_ARMY_MIN,
  LONGEST_ROAD_MIN,
  MAX_HAND_SIZE_BEFORE_DISCARD,
  RESOURCE_TYPES,
  VP_TO_WIN,
} from "./types.js";
import { generateBoard } from "./board.js";
import { cubeKey, hexVertexIds } from "./hex.js";
import {
  boardAdjacentEdges,
  LAND_COORDS,
  portAtVertex,
  tilesForVertex,
} from "./board.js";
import {
  calculateVP,
  canPlaceCity,
  canPlaceRoad,
  canPlaceSettlement,
  hasResources,
  longestRoad,
  totalResources,
  tradeRatioForResource,
  validInitialRoadEdges,
  validInitialSettlementVertices,
} from "./rules.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

function getPlayer(state: GameState, id: string): Player {
  const p = state.players.find((p) => p.id === id);
  if (!p) throw `Player ${id} not found`;
  return p;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw message;
}

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function shuffleDeck(types: DevCardType[]): DevCardType[] {
  const deck = [...types];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function buildDevDeck(): DevCardType[] {
  const cards: DevCardType[] = [];
  for (const [type, count] of Object.entries(DEV_CARD_COUNTS) as [DevCardType, number][]) {
    for (let i = 0; i < count; i++) cards.push(type);
  }
  return shuffleDeck(cards);
}

function addResources(resources: Resources, add: Partial<Resources>): void {
  for (const r of RESOURCE_TYPES) {
    resources[r] = (resources[r] ?? 0) + (add[r] ?? 0);
  }
}

function subtractResources(resources: Resources, sub: Partial<Resources>): void {
  for (const r of RESOURCE_TYPES) {
    resources[r] = (resources[r] ?? 0) - (sub[r] ?? 0);
  }
}

function log(state: GameState, message: string): void {
  state.log.push(message);
  if (state.log.length > 200) state.log.shift();
}

// ── Update longest road / largest army ───────────────────────────────────────

function updateLongestRoad(state: GameState): void {
  for (const player of state.players) {
    const road = longestRoad(state, player.id);
    const currentHolder = state.longestRoadPlayerId;

    if (road >= LONGEST_ROAD_MIN) {
      if (!currentHolder) {
        if (road >= LONGEST_ROAD_MIN) {
          state.longestRoadPlayerId = player.id;
          player.hasLongestRoad = true;
          log(state, `${player.name} takes Longest Road!`);
        }
      } else if (currentHolder !== player.id) {
        const holderRoad = longestRoad(state, currentHolder);
        if (road > holderRoad) {
          const prev = state.players.find((p) => p.id === currentHolder)!;
          prev.hasLongestRoad = false;
          player.hasLongestRoad = true;
          state.longestRoadPlayerId = player.id;
          log(state, `${player.name} takes Longest Road from ${prev.name}!`);
        }
      }
    }
  }
}

function updateLargestArmy(state: GameState, player: Player): void {
  if (player.knightsPlayed < LARGEST_ARMY_MIN) return;

  const currentHolder = state.largestArmyPlayerId;
  if (!currentHolder) {
    state.largestArmyPlayerId = player.id;
    player.hasLargestArmy = true;
    log(state, `${player.name} takes Largest Army!`);
    return;
  }
  if (currentHolder === player.id) return;

  const holder = state.players.find((p) => p.id === currentHolder)!;
  if (player.knightsPlayed > holder.knightsPlayed) {
    holder.hasLargestArmy = false;
    player.hasLargestArmy = true;
    state.largestArmyPlayerId = player.id;
    log(state, `${player.name} takes Largest Army from ${holder.name}!`);
  }
}

function checkWinner(state: GameState): void {
  for (const player of state.players) {
    if (calculateVP(state, player) >= VP_TO_WIN) {
      state.winnerId = player.id;
      state.phase = "ended";
      log(state, `🏆 ${player.name} wins!`);
    }
  }
}

// ── Resource distribution ─────────────────────────────────────────────────────

function distributeResources(state: GameState, roll: number): void {
  const { board } = state;

  const activeTiles = board.tiles.filter(
    (t) => t.number === roll && !t.hasRobber
  );

  for (const tile of activeTiles) {
    const resource = tile.terrain as ResourceType;
    if (!RESOURCE_TYPES.includes(resource)) continue;

    const vertices = hexVertexIds(tile.coord);
    for (const v of vertices) {
      const building = board.buildings[v];
      if (!building) continue;

      const amount = building.type === "settlement" ? 1 : 2;
      const player = state.players.find((p) => p.id === building.playerId)!;

      // Bank may not have enough
      const available = Math.min(amount, state.bank[resource]);
      if (available > 0) {
        player.resources[resource] += available;
        state.bank[resource] -= available;
        log(state, `${player.name} receives ${available}x ${resource}`);
      }
    }
  }
}

// ── Setup phase helpers ───────────────────────────────────────────────────────

function advanceSetup(state: GameState): void {
  const { setupOrder, setupIndex, setupRound } = state;

  if (setupRound === 1) {
    if (setupIndex < setupOrder.length - 1) {
      state.setupIndex++;
    } else {
      // Start second round (reverse order)
      state.setupRound = 2;
      // setupIndex stays at last player
    }
  } else {
    // Round 2: going backwards
    if (setupIndex > 0) {
      state.setupIndex--;
    } else {
      // Setup complete — transition to main game
      state.phase = "main";
      state.turnPhase = "preRoll";
      state.currentPlayerIndex = state.players.findIndex(
        (p) => p.id === setupOrder[0]
      );
      log(state, "Setup complete! Game begins.");
      return;
    }
  }

  state.currentPlayerIndex = state.players.findIndex(
    (p) => p.id === setupOrder[state.setupIndex]
  );
  state.lastSetupSettlementVertex = null;
}

// ── Action handlers ───────────────────────────────────────────────────────────

export function applyAction(
  state: GameState,
  playerId: string,
  action: Action
): GameState {
  const next = cloneState(state);
  applyActionMut(next, playerId, action);
  syncPublicVP(next);
  return next;
}

/**
 * Recomputes publicVP for every player.
 * publicVP = buildings + special cards + revealed VP dev cards.
 * Hidden VP cards in hand are intentionally excluded.
 */
function syncPublicVP(state: GameState): void {
  for (const player of state.players) {
    let vp = 0;
    for (const building of Object.values(state.board.buildings)) {
      if (building.playerId !== player.id) continue;
      vp += building.type === "settlement" ? 1 : 2;
    }
    if (player.hasLargestArmy) vp += 2;
    if (player.hasLongestRoad) vp += 2;
    vp += player.devCardsPlayed.filter((c) => c === "victoryPoint").length;
    player.publicVP = vp;
  }
}

function applyActionMut(state: GameState, playerId: string, action: Action): void {
  const cp = currentPlayer(state);

  // ── Dev-only cheat actions (bypass all phase guards) ──────────────────────
  if (action.type === "devGrant") {
    const granter = state.players.find((p) => p.id === playerId);
    if (granter) granter.resources[action.resource] = (granter.resources[action.resource] ?? 0) + 1;
    return;
  }

  // ── Setup phase ────────────────────────────────────────────────────────────
  if (state.phase === "setup") {
    if (action.type === "placeInitialSettlement") {
      assert(cp.id === playerId, "Not your turn");
      assert(state.lastSetupSettlementVertex === null, "Already placed settlement this turn");

      const valid = validInitialSettlementVertices(state);
      assert(valid.includes(action.vertexId), "Invalid settlement location");
      assert(cp.remainingSettlements > 0, "No settlements left");

      state.board.buildings[action.vertexId] = { playerId, type: "settlement" };
      cp.remainingSettlements--;
      state.lastSetupSettlementVertex = action.vertexId;
      log(state, `${cp.name} places a settlement`);

      // Round 2: collect resources from adjacent tiles
      if (state.setupRound === 2) {
        const adjacentTiles = tilesForVertex(action.vertexId, state.board.tiles);
        for (const tile of adjacentTiles) {
          const resource = tile.terrain as ResourceType;
          if (RESOURCE_TYPES.includes(resource) && state.bank[resource] > 0) {
            cp.resources[resource]++;
            state.bank[resource]--;
            log(state, `${cp.name} receives 1x ${resource} (setup)`);
          }
        }
      }
      return;
    }

    if (action.type === "placeInitialRoad") {
      assert(cp.id === playerId, "Not your turn");
      assert(state.lastSetupSettlementVertex !== null, "Place settlement first");

      const validEdges = validInitialRoadEdges(state, playerId, state.lastSetupSettlementVertex!);
      assert(validEdges.includes(action.edgeId), "Invalid road location");
      assert(cp.remainingRoads > 0, "No roads left");

      state.board.roads[action.edgeId] = { playerId };
      cp.remainingRoads--;
      log(state, `${cp.name} places a road`);

      advanceSetup(state);
      return;
    }

    throw "Invalid action during setup";
  }

  // ── Main phase ─────────────────────────────────────────────────────────────

  // Discard action (any player with >7 cards after a 7)
  if (action.type === "discard") {
    assert(state.turnPhase === "discarding", "Not a discarding phase");
    const player = getPlayer(state, playerId);
    const required = state.pendingDiscards[playerId];
    assert(required !== undefined, "You don't need to discard");

    const discardCount = RESOURCE_TYPES.reduce((s, r) => s + (action.resources[r] ?? 0), 0);
    assert(discardCount === required, `Must discard exactly ${required} cards`);
    assert(
      RESOURCE_TYPES.every((r) => (action.resources[r] ?? 0) <= player.resources[r]),
      "Not enough resources to discard"
    );

    subtractResources(player.resources, action.resources);
    addResources(state.bank, action.resources);
    delete state.pendingDiscards[playerId];
    log(state, `${player.name} discards ${discardCount} card(s)`);

    if (Object.keys(state.pendingDiscards).length === 0) {
      state.turnPhase = "movingRobber";
    }
    return;
  }

  // Respond to a trade offer (any non-current player can accept/reject)
  if (action.type === "respondTrade") {
    assert(state.tradeOffer !== null, "No active trade offer");
    assert(state.tradeOffer!.id === action.offerId, "Trade offer ID mismatch");
    assert(playerId in state.tradeOffer!.responses, "Not a trade target");
    state.tradeOffer!.responses[playerId] = action.response;
    return;
  }

  // All remaining actions require it to be your turn
  assert(cp.id === playerId, "Not your turn");

  switch (action.type) {
    case "rollDice": {
      assert(state.turnPhase === "preRoll", "Already rolled");
      const d1 = rollDie();
      const d2 = rollDie();
      state.dice = [d1, d2];
      const roll = d1 + d2;
      log(state, `${cp.name} rolls ${d1} + ${d2} = ${roll}`);

      if (roll === 7) {
        // Discard phase
        const pending: Record<string, number> = {};
        for (const p of state.players) {
          const total = totalResources(p.resources);
          if (total > MAX_HAND_SIZE_BEFORE_DISCARD) {
            pending[p.id] = Math.floor(total / 2);
          }
        }

        if (Object.keys(pending).length > 0) {
          state.pendingDiscards = pending;
          state.turnPhase = "discarding";
        } else {
          state.turnPhase = "movingRobber";
        }
      } else {
        distributeResources(state, roll);
        state.turnPhase = "postRoll";
      }
      break;
    }

    case "moveRobber": {
      assert(
        state.turnPhase === "movingRobber",
        "Cannot move robber now"
      );
      const newKey = cubeKey(action.coord);
      const isLand = LAND_COORDS.some((c) => cubeKey(c) === newKey);
      assert(isLand, "Robber must be placed on a land tile");

      // Remove from current location
      const current = state.board.tiles.find((t) => t.hasRobber);
      if (current) current.hasRobber = false;

      // Place on new location
      const target = state.board.tiles.find(
        (t) => cubeKey(t.coord) === newKey
      );
      assert(target !== undefined, "Tile not found");
      target!.hasRobber = true;

      // Find players with buildings adjacent to new robber location
      const adjacentVertices = hexVertexIds(action.coord);
      const victims = new Set<string>();
      for (const v of adjacentVertices) {
        const building = state.board.buildings[v];
        if (building && building.playerId !== playerId) {
          victims.add(building.playerId);
        }
      }

      log(state, `${cp.name} moves the robber`);

      if (victims.size === 0) {
        state.turnPhase = "postRoll";
      } else if (victims.size === 1) {
        // Auto-steal from only possible victim
        const victimId = Array.from(victims)[0];
        stealFrom(state, cp, getPlayer(state, victimId));
        state.turnPhase = "postRoll";
      } else {
        state.turnPhase = "stealing";
      }
      break;
    }

    case "steal": {
      assert(state.turnPhase === "stealing", "Cannot steal now");
      const victim = getPlayer(state, action.victimId);
      stealFrom(state, cp, victim);
      state.turnPhase = "postRoll";
      break;
    }

    case "buildSettlement": {
      assert(state.turnPhase === "postRoll", "Roll first");
      assert(canPlaceSettlement(state, playerId, action.vertexId), "Invalid location");
      assert(hasResources(cp, BUILDING_COSTS.settlement), "Not enough resources");
      assert(cp.remainingSettlements > 0, "No settlements left");

      subtractResources(cp.resources, BUILDING_COSTS.settlement);
      addResources(state.bank, BUILDING_COSTS.settlement);
      state.board.buildings[action.vertexId] = { playerId, type: "settlement" };
      cp.remainingSettlements--;
      log(state, `${cp.name} builds a settlement`);
      updateLongestRoad(state);
      checkWinner(state);
      break;
    }

    case "buildCity": {
      assert(state.turnPhase === "postRoll", "Roll first");
      assert(canPlaceCity(state, playerId, action.vertexId), "Invalid location");
      assert(hasResources(cp, BUILDING_COSTS.city), "Not enough resources");
      assert(cp.remainingCities > 0, "No cities left");

      subtractResources(cp.resources, BUILDING_COSTS.city);
      addResources(state.bank, BUILDING_COSTS.city);
      state.board.buildings[action.vertexId] = { playerId, type: "city" };
      cp.remainingCities--;
      cp.remainingSettlements++;
      log(state, `${cp.name} builds a city`);
      checkWinner(state);
      break;
    }

    case "buildRoad": {
      const isRoadBuilding = state.turnPhase === "roadBuilding";
      assert(
        state.turnPhase === "postRoll" || isRoadBuilding,
        "Roll first"
      );
      assert(canPlaceRoad(state, playerId, action.edgeId), "Invalid road location");
      assert(cp.remainingRoads > 0, "No roads left");

      if (!isRoadBuilding) {
        assert(hasResources(cp, BUILDING_COSTS.road), "Not enough resources");
        subtractResources(cp.resources, BUILDING_COSTS.road);
        addResources(state.bank, BUILDING_COSTS.road);
      }

      state.board.roads[action.edgeId] = { playerId };
      cp.remainingRoads--;
      log(state, `${cp.name} builds a road`);
      updateLongestRoad(state);

      if (isRoadBuilding) {
        state.roadBuildingRoadsLeft--;
        if (state.roadBuildingRoadsLeft === 0) {
          state.turnPhase = "postRoll";
        }
      }
      checkWinner(state);
      break;
    }

    case "buyDevCard": {
      assert(state.turnPhase === "postRoll", "Roll first");
      assert(hasResources(cp, BUILDING_COSTS.devCard), "Not enough resources");
      assert(state.devCardDeck.length > 0, "Dev card deck is empty");

      subtractResources(cp.resources, BUILDING_COSTS.devCard);
      addResources(state.bank, BUILDING_COSTS.devCard);
      const card = state.devCardDeck.pop()!;
      cp.devCardsBoughtThisTurn.push(card);
      log(state, `${cp.name} buys a development card`);
      break;
    }

    case "playKnight": {
      assert(state.turnPhase === "preRoll" || state.turnPhase === "postRoll", "Cannot play knight now");
      assert(cp.devCards.includes("knight"), "No knight card");
      // Cannot play a card bought this turn
      const idx = cp.devCards.indexOf("knight");
      cp.devCards.splice(idx, 1);
      cp.devCardsPlayed.push("knight");
      cp.knightsPlayed++;
      updateLargestArmy(state, cp);
      state.turnPhase = "movingRobber";
      log(state, `${cp.name} plays a Knight`);
      checkWinner(state);
      break;
    }

    case "playRoadBuilding": {
      assert(state.turnPhase === "postRoll", "Roll first");
      assert(cp.devCards.includes("roadBuilding"), "No road building card");
      const idx = cp.devCards.indexOf("roadBuilding");
      cp.devCards.splice(idx, 1);
      cp.devCardsPlayed.push("roadBuilding");
      state.roadBuildingRoadsLeft = Math.min(2, cp.remainingRoads);
      state.turnPhase = "roadBuilding";
      log(state, `${cp.name} plays Road Building`);
      break;
    }

    case "playYearOfPlenty": {
      assert(state.turnPhase === "postRoll", "Roll first");
      assert(cp.devCards.includes("yearOfPlenty"), "No year of plenty card");
      assert(state.bank[action.resource1] > 0, `Bank has no ${action.resource1}`);
      assert(state.bank[action.resource2] > 0, `Bank has no ${action.resource2}`);
      const idx = cp.devCards.indexOf("yearOfPlenty");
      cp.devCards.splice(idx, 1);
      cp.devCardsPlayed.push("yearOfPlenty");
      cp.resources[action.resource1]++;
      state.bank[action.resource1]--;
      cp.resources[action.resource2]++;
      state.bank[action.resource2]--;
      log(state, `${cp.name} plays Year of Plenty (${action.resource1}, ${action.resource2})`);
      break;
    }

    case "playMonopoly": {
      assert(state.turnPhase === "postRoll", "Roll first");
      assert(cp.devCards.includes("monopoly"), "No monopoly card");
      const idx = cp.devCards.indexOf("monopoly");
      cp.devCards.splice(idx, 1);
      cp.devCardsPlayed.push("monopoly");
      let total = 0;
      for (const p of state.players) {
        if (p.id === playerId) continue;
        const amount = p.resources[action.resource];
        total += amount;
        p.resources[action.resource] = 0;
      }
      cp.resources[action.resource] += total;
      log(state, `${cp.name} plays Monopoly on ${action.resource} (+${total})`);
      break;
    }

    case "bankTrade": {
      assert(state.turnPhase === "postRoll", "Roll first");
      const ratio = tradeRatioForResource(state, playerId, action.give);
      assert(action.amount === ratio, `Trade ratio for ${action.give} is ${ratio}:1`);
      assert(cp.resources[action.give] >= ratio, "Not enough resources");
      assert(state.bank[action.want] > 0, `Bank has no ${action.want}`);
      cp.resources[action.give] -= ratio;
      state.bank[action.give] += ratio;
      cp.resources[action.want]++;
      state.bank[action.want]--;
      log(state, `${cp.name} trades ${ratio}x ${action.give} → 1x ${action.want}`);
      break;
    }

    case "offerTrade": {
      assert(state.turnPhase === "postRoll", "Roll first");
      assert(hasResources(cp, action.give), "Not enough resources to offer");
      const responses: Record<string, "accept" | "reject" | null> = {};
      for (const p of state.players) {
        if (p.id !== playerId) responses[p.id] = null;
      }
      state.tradeOffer = {
        id: `trade-${Date.now()}`,
        fromPlayerId: playerId,
        give: action.give,
        want: action.want,
        responses,
      };
      log(state, `${cp.name} offers a trade`);
      break;
    }

    case "acceptTrade": {
      assert(cp.id === playerId, "Only current player accepts trades");
      assert(state.tradeOffer !== null, "No active trade");
      const offer = state.tradeOffer!;
      const partner = getPlayer(state, action.partnerId);
      assert(offer.responses[action.partnerId] === "accept", "Partner did not accept");
      assert(hasResources(cp, offer.give), "Not enough resources");
      assert(hasResources(partner, offer.want), "Partner doesn't have resources");

      subtractResources(cp.resources, offer.give);
      addResources(cp.resources, offer.want);
      subtractResources(partner.resources, offer.want);
      addResources(partner.resources, offer.give);
      state.tradeOffer = null;
      log(state, `${cp.name} trades with ${partner.name}`);
      break;
    }

    case "cancelTrade": {
      state.tradeOffer = null;
      break;
    }

    case "endTurn": {
      assert(state.turnPhase === "postRoll", "Roll first");
      state.tradeOffer = null;

      // Move newly bought dev cards to hand
      cp.devCards.push(...cp.devCardsBoughtThisTurn);
      cp.devCardsBoughtThisTurn = [];

      state.dice = null;
      state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
      state.turnPhase = "preRoll";
      const next = currentPlayer(state);
      log(state, `${next.name}'s turn`);
      break;
    }

    default:
      throw `Unknown action type`;
  }
}

// ── Steal helper ──────────────────────────────────────────────────────────────

function stealFrom(state: GameState, thief: Player, victim: Player): void {
  const available = RESOURCE_TYPES.filter((r) => victim.resources[r] > 0);
  if (available.length === 0) {
    log(state, `${victim.name} has no resources to steal`);
    return;
  }
  const resource = available[Math.floor(Math.random() * available.length)];
  victim.resources[resource]--;
  thief.resources[resource]++;
  log(state, `${thief.name} steals 1 resource from ${victim.name}`);
}

// ── Initial game state ────────────────────────────────────────────────────────

export function createGame(
  gameId: string,
  players: Array<{ id: string; name: string; color: import("./types.js").PlayerColor }>
): GameState {
  const emptyResources = (): Resources =>
    ({ wood: 0, brick: 0, wheat: 0, ore: 0, sheep: 0 });

  const gamePlayers: Player[] = players.map((p) => ({
    ...p,
    resources: emptyResources(),
    devCards: [],
    devCardsPlayed: [],
    devCardsBoughtThisTurn: [],
    remainingSettlements: 5,
    remainingCities: 4,
    remainingRoads: 15,
    knightsPlayed: 0,
    hasLargestArmy: false,
    hasLongestRoad: false,
    publicVP: 0,
    connected: true,
  }));

  const setupOrder = gamePlayers.map((p) => p.id);

  return {
    id: gameId,
    phase: "setup",
    turnPhase: "preRoll",
    players: gamePlayers,
    currentPlayerIndex: 0,
    board: generateBoard(),
    dice: null,
    bank: { ...BANK_INITIAL },
    devCardDeck: buildDevDeck(),
    largestArmyPlayerId: null,
    longestRoadPlayerId: null,
    tradeOffer: null,
    pendingDiscards: {},
    roadBuildingRoadsLeft: 0,
    winnerId: null,
    log: ["Game started!"],
    setupOrder,
    setupIndex: 0,
    setupRound: 1,
    lastSetupSettlementVertex: null,
  };
}
