/**
 * Phase 6: Public Agent API Types
 * TypeScript interfaces for external agent API
 */

/**
 * External agent registered via API
 */
export interface ExternalAgent {
  apiKey: string;
  walletAddress: string;
  agentName: string;
  webhookUrl?: string;
  createdAt: number;
  lastSeen: number;
  gamesPlayed: number;
  gamesWon: number;
}

/**
 * API error response
 */
export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

/**
 * Registration request body
 */
export interface RegisterAgentRequest {
  walletAddress: string;
  agentName: string;
  webhookUrl?: string;
}

/**
 * Registration response
 */
export interface RegisterAgentResponse {
  apiKey: string;
  agentName: string;
  walletAddress: string;
}

/**
 * Agent info response (GET /api/agents/me)
 */
export interface AgentInfoResponse {
  walletAddress: string;
  agentName: string;
  webhookUrl?: string;
  createdAt: number;
  lastSeen: number;
  gamesPlayed: number;
  gamesWon: number;
}

/**
 * Queue join request
 */
export interface QueueJoinRequest {
  maxWager: string; // Wei amount as string
}

/**
 * Queue join response
 */
export interface QueueJoinResponse {
  position: number;
  queueSize: number;
  estimatedWait: string;
}

/**
 * Queue leave response
 */
export interface QueueLeaveResponse {
  success: boolean;
  message: string;
}

/**
 * Active games response
 */
export interface ActiveGamesResponse {
  games: GameInfo[];
}

/**
 * Game info in list
 */
export interface GameInfo {
  gameId: string;
  players: string[];
  playerNames: string[];
  wagerAmount: string;
  status: 'pending' | 'active' | 'complete';
  createdAt: number;
  startedAt?: number;
}

/**
 * Game state response
 */
export interface GameStateResponse {
  gameId: string;
  players: string[];
  playerNames: string[];
  wagerAmount: string;
  status: 'pending' | 'active' | 'complete';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  currentTurn?: string;
  pot?: string;
  phase?: string;
}

/**
 * Action notification request (after on-chain tx)
 */
export interface ActionRequest {
  action: 'fold' | 'check' | 'call' | 'raise' | 'all_in';
  amount?: string; // Wei amount for raise
  txHash: string;
}

/**
 * Action response
 */
export interface ActionResponse {
  success: boolean;
  verified: boolean;
  gameState?: GameStateResponse;
  error?: string;
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  agentName: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  totalWinnings: string;
}

/**
 * Leaderboard response
 */
export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  lastUpdated: number;
}

/**
 * WebSocket message types for external agents
 */
export type ApiWebSocketMessage =
  | ApiAuthMessage
  | ApiAuthenticatedMessage
  | GameStateMessage
  | YourTurnMessage
  | GameResultMessage
  | QueueUpdateMessage
  | ErrorMessage;

/**
 * API authentication message (client -> server)
 */
export interface ApiAuthMessage {
  type: 'api_auth';
  apiKey: string;
}

/**
 * Authentication success response (server -> client)
 */
export interface ApiAuthenticatedMessage {
  type: 'api_authenticated';
  agentName: string;
  walletAddress: string;
}

/**
 * Game state update (server -> client)
 */
export interface GameStateMessage {
  type: 'game_state';
  gameId: string;
  players: Array<{
    address: string;
    name: string;
    stack: string;
    bet: string;
    folded: boolean;
    isAllIn: boolean;
  }>;
  pot: string;
  phase: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  communityCards: string[];
  currentTurn: string;
  minBet: string;
  timestamp: number;
}

/**
 * Your turn notification (server -> client)
 */
export interface YourTurnMessage {
  type: 'your_turn';
  gameId: string;
  gameState: GameStateMessage['players'];
  pot: string;
  phase: string;
  communityCards: string[];
  holeCards: string[];
  validActions: Array<{
    action: string;
    minAmount?: string;
    maxAmount?: string;
  }>;
  timeoutMs: number;
  timestamp: number;
}

/**
 * Game result notification (server -> client)
 */
export interface GameResultMessage {
  type: 'game_result';
  gameId: string;
  winner: string;
  winnerName: string;
  pot: string;
  yourResult: 'won' | 'lost';
  amountWon?: string;
  amountLost?: string;
  timestamp: number;
}

/**
 * Queue update notification (server -> client)
 */
export interface QueueUpdateMessage {
  type: 'queue_update';
  position: number;
  queueSize: number;
  estimatedWait: string;
  timestamp: number;
}

/**
 * Error message (server -> client)
 */
export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Rate limit info stored per API key
 */
export interface RateLimitInfo {
  requests: number;
  windowStart: number;
}

/**
 * Connected external agent via WebSocket
 */
export interface ConnectedExternalAgent {
  apiKey: string;
  walletAddress: string;
  agentName: string;
  socket: unknown;
  connectedAt: number;
  lastActivity: number;
  inQueue: boolean;
  inGame: boolean;
  currentGameId: string | null;
}
