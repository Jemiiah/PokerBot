// Contract event types
export interface GameCreatedEvent {
  gameId: string;
  player1: string;
  wager: bigint;
  timestamp: number;
}

export interface PlayerJoinedEvent {
  gameId: string;
  player2: string;
  timestamp: number;
}

export interface ActionTakenEvent {
  gameId: string;
  player: string;
  action: number; // ActionType enum value
  amount: bigint;
  timestamp: number;
}

export interface PhaseChangedEvent {
  gameId: string;
  newPhase: number; // GamePhase enum value
  timestamp: number;
}

export interface GameEndedEvent {
  gameId: string;
  winner: string;
  pot: bigint;
  timestamp: number;
}

export interface CardsRevealedEvent {
  gameId: string;
  player: string;
  cards: [number, number];
  timestamp: number;
}

// Contract addresses config
export interface ContractAddresses {
  pokerGame: `0x${string}`;
  escrow: `0x${string}`;
  tournament: `0x${string}`;
}

// Transaction types
export interface TransactionConfig {
  maxGasPrice?: bigint;
  maxPriorityFee?: bigint;
  gasLimit?: bigint;
  nonce?: number;
}

export interface TransactionResult {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: bigint;
  blockNumber?: number;
}
