// ── Coordinates ───────────────────────────────────────────────────────────────

/** Cube coordinates. Invariant: q + r + s === 0 */
export interface CubeCoord {
  q: number;
  r: number;
  s: number;
}

/** Vertex: the point where up to 3 hexes meet. ID is derived from cube coords. */
export type VertexId = string;

/** Edge: the border between 2 hexes where roads are placed. */
export type EdgeId = string;

// ── Resources & Terrain ───────────────────────────────────────────────────────

export type ResourceType = "wood" | "brick" | "wheat" | "ore" | "sheep";
export type TerrainType = ResourceType | "desert" | "sea";
export type Resources = Record<ResourceType, number>;

export const RESOURCE_TYPES: ResourceType[] = [
  "wood",
  "brick",
  "wheat",
  "ore",
  "sheep",
];

export const TERRAIN_RESOURCE: Partial<Record<TerrainType, ResourceType>> = {
  wood: "wood",
  brick: "brick",
  wheat: "wheat",
  ore: "ore",
  sheep: "sheep",
};

// ── Board ─────────────────────────────────────────────────────────────────────

export interface Tile {
  coord: CubeCoord;
  terrain: TerrainType;
  /** Number token (2–12). Undefined for desert/sea. */
  number?: number;
  hasRobber: boolean;
}

export type PortResource = ResourceType | "generic";

export interface Port {
  /** The two vertex IDs at the mouth of the port (on land side). */
  vertices: [VertexId, VertexId];
  resource: PortResource;
  /** 2:1 for specific resource ports, 3:1 for generic. */
  ratio: 2 | 3;
}

export type BuildingType = "settlement" | "city";

export interface Building {
  playerId: string;
  type: BuildingType;
}

export interface Road {
  playerId: string;
}

export interface Board {
  tiles: Tile[];
  buildings: Record<VertexId, Building>;
  roads: Record<EdgeId, Road>;
  ports: Port[];
  /** The land hex coords for this board — drives all adjacency queries. */
  landHexes: CubeCoord[];
}

// ── Board Layouts ─────────────────────────────────────────────────────────────

/**
 * A port definition in human-editable form.
 * Reference a coastal hex by coord, then specify which two vertex indices
 * (0–5, clockwise from top) face the sea.
 */
export interface PortDef {
  hex: CubeCoord;
  vertexIndices: [number, number];
  resource: PortResource;
}

/**
 * A board layout is pure declarative data — no logic, no code.
 * Add a new layout by creating a new object conforming to this interface.
 */
export interface BoardLayout {
  /** Unique identifier used to select the layout. */
  id: string;
  /** Human-readable display name shown in the lobby. */
  label: string;
  /** Recommended player count range. */
  players: { min: number; max: number };
  /**
   * Cube coordinates of every land hex, laid out in rows for readability.
   * Order matters: terrainDistribution[i] is assigned to landHexes[i].
   */
  landHexes: CubeCoord[];
  /**
   * Terrain types to shuffle and assign to landHexes.
   * Must have the same length as landHexes.
   */
  terrainDistribution: TerrainType[];
  /**
   * Number tokens to shuffle and assign to non-desert tiles.
   * Must have length === (number of non-desert tiles).
   */
  numberDistribution: number[];
  /** Port locations. */
  ports: PortDef[];
}

// ── Development Cards ─────────────────────────────────────────────────────────

export type DevCardType =
  | "knight"
  | "roadBuilding"
  | "yearOfPlenty"
  | "monopoly"
  | "victoryPoint";

export const DEV_CARD_COUNTS: Record<DevCardType, number> = {
  knight: 14,
  roadBuilding: 2,
  yearOfPlenty: 2,
  monopoly: 2,
  victoryPoint: 5,
};

// ── Players ───────────────────────────────────────────────────────────────────

export type PlayerColor = "red" | "blue" | "green" | "orange";
export const PLAYER_COLORS: PlayerColor[] = ["red", "blue", "green", "orange"];

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  resources: Resources;
  /** Cards in hand (hidden from others). */
  devCards: DevCardType[];
  /** Cards played this turn or previous turns (public). */
  devCardsPlayed: DevCardType[];
  /** Dev cards bought this turn — cannot be played until next turn. */
  devCardsBoughtThisTurn: DevCardType[];
  remainingSettlements: number;
  remainingCities: number;
  remainingRoads: number;
  knightsPlayed: number;
  hasLargestArmy: boolean;
  hasLongestRoad: boolean;
  /** VP from settlements, cities, longest road, largest army. Does NOT include hidden VP cards. */
  publicVP: number;
  connected: boolean;
}

// ── Trading ───────────────────────────────────────────────────────────────────

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  give: Partial<Resources>;
  want: Partial<Resources>;
  /** null = no response yet */
  responses: Record<string, "accept" | "reject" | null>;
}

// ── Game Phase & Actions ──────────────────────────────────────────────────────

export type GamePhase = "lobby" | "setup" | "main" | "ended";

export type TurnPhase =
  | "preRoll"
  | "postRoll"
  | "discarding" // after 7: players with >7 cards must discard
  | "movingRobber" // current player moves robber
  | "stealing" // current player picks who to steal from
  | "roadBuilding"; // playing road-building card (up to 2 free roads)

// All possible player actions
export type Action =
  | { type: "rollDice" }
  | { type: "placeInitialSettlement"; vertexId: VertexId }
  | { type: "placeInitialRoad"; edgeId: EdgeId }
  | { type: "buildSettlement"; vertexId: VertexId }
  | { type: "buildCity"; vertexId: VertexId }
  | { type: "buildRoad"; edgeId: EdgeId }
  | { type: "buyDevCard" }
  | { type: "playKnight" }
  | { type: "playRoadBuilding" }
  | { type: "playYearOfPlenty"; resource1: ResourceType; resource2: ResourceType }
  | { type: "playMonopoly"; resource: ResourceType }
  | { type: "moveRobber"; coord: CubeCoord }
  | { type: "steal"; victimId: string }
  | { type: "discard"; resources: Partial<Resources> }
  | { type: "offerTrade"; give: Partial<Resources>; want: Partial<Resources> }
  | { type: "respondTrade"; offerId: string; response: "accept" | "reject" }
  | { type: "acceptTrade"; partnerId: string }
  | { type: "cancelTrade" }
  | { type: "bankTrade"; give: ResourceType; want: ResourceType; amount: number }
  | { type: "endTurn" };

// ── Game State ────────────────────────────────────────────────────────────────

export interface GameState {
  id: string;
  layoutId: string;
  phase: GamePhase;
  turnPhase: TurnPhase;
  players: Player[];
  currentPlayerIndex: number;
  board: Board;
  dice: [number, number] | null;
  bank: Resources;
  /** Shuffled dev card deck (server only — clients see count only). */
  devCardDeck: DevCardType[];
  largestArmyPlayerId: string | null;
  longestRoadPlayerId: string | null;
  tradeOffer: TradeOffer | null;
  /** Player IDs still needing to discard after a 7 roll. */
  pendingDiscards: Record<string, number>; // playerId -> cards to discard
  /** Remaining free roads when road-building card is active. */
  roadBuildingRoadsLeft: number;
  winnerId: string | null;
  log: string[];
  /** Setup phase tracking: goes 1st→last→last→1st (snake draft). */
  setupOrder: string[];
  setupIndex: number;
  setupRound: 1 | 2;
  /** Vertex of last-placed settlement in round 2 (for free resource). */
  lastSetupSettlementVertex: VertexId | null;
}

// ── Socket Events ─────────────────────────────────────────────────────────────

export interface ServerToClientEvents {
  gameState: (state: ClientGameState) => void;
  error: (message: string) => void;
  playerJoined: (player: { id: string; name: string; color: PlayerColor }) => void;
  playerLeft: (playerId: string) => void;
  layoutChanged: (layoutId: string) => void;
  gameStarted: () => void;
}

export interface ClientToServerEvents {
  joinRoom: (roomId: string, playerName: string) => void;
  setLayout: (layoutId: string) => void;
  startGame: () => void;
  action: (action: Action) => void;
}

/**
 * Game state sent to clients — dev card deck is hidden (only count exposed),
 * other players' hand sizes are shown but not contents.
 */
export interface ClientGameState extends Omit<GameState, "devCardDeck"> {
  devCardDeckSize: number;
  /** Current client's player ID. */
  myPlayerId: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const BANK_INITIAL: Resources = {
  wood: 19,
  brick: 19,
  wheat: 19,
  ore: 19,
  sheep: 19,
};

export const BUILDING_COSTS: Record<
  "settlement" | "city" | "road" | "devCard",
  Partial<Resources>
> = {
  settlement: { wood: 1, brick: 1, wheat: 1, sheep: 1 },
  city: { ore: 3, wheat: 2 },
  road: { wood: 1, brick: 1 },
  devCard: { ore: 1, wheat: 1, sheep: 1 },
};

export const VP_TO_WIN = 10;
export const LARGEST_ARMY_MIN = 3;
export const LONGEST_ROAD_MIN = 5;
export const MAX_HAND_SIZE_BEFORE_DISCARD = 7;
