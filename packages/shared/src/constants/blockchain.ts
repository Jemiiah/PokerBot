// Monad Network Configuration
export const MONAD_TESTNET = {
  chainId: 10143,
  name: 'Monad Testnet',
  rpcUrl: 'https://testnet-rpc.monad.xyz',
  blockExplorer: 'https://testnet.monadexplorer.com',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
} as const;

// Block timing
export const BLOCK_TIME_MS = 400; // Monad's 400ms block time
export const FINALITY_MS = 800; // 800ms finality

// Gas settings
export const DEFAULT_GAS_LIMIT = 500_000n;
export const MAX_GAS_PRICE = 100_000_000_000n; // 100 gwei

// Contract function selectors
export const FUNCTION_SELECTORS = {
  createGame: '0x',
  joinGame: '0x',
  takeAction: '0x',
  revealCards: '0x',
  claimTimeout: '0x',
} as const;

// Event signatures
export const EVENT_SIGNATURES = {
  GameCreated: 'GameCreated(bytes32,address,uint256)',
  PlayerJoined: 'PlayerJoined(bytes32,address)',
  ActionTaken: 'ActionTaken(bytes32,address,uint8,uint256)',
  PhaseChanged: 'PhaseChanged(bytes32,uint8)',
  GameEnded: 'GameEnded(bytes32,address,uint256)',
  CardsRevealed: 'CardsRevealed(bytes32,address,uint8[2])',
} as const;
