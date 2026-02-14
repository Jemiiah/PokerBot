// Monad Network Configuration

export const MONAD_MAINNET = {
  chainId: 143,
  name: 'Monad',
  rpcUrl: 'https://rpc.monad.xyz',
  blockExplorers: {
    socialscan: 'https://monad.socialscan.io',
    monadvision: 'https://monadvision.com',
    monadscan: 'https://monadscan.com',
  },
  blockExplorer: 'https://monad.socialscan.io', // Default
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
} as const;

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

// Helper to get network config by chain ID
export function getNetworkConfig(chainId: number) {
  switch (chainId) {
    case 143:
      return MONAD_MAINNET;
    case 10143:
      return MONAD_TESTNET;
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }
}

// Check if mainnet
export function isMainnet(chainId: number): boolean {
  return chainId === 143;
}

// =============================================================================
// CONTRACT ADDRESSES
// =============================================================================

// Mainnet Contract Addresses (deployed 2026-02-14)
export const MAINNET_CONTRACTS = {
  POKER_GAME: '0xCb1ef57cC989ba3043edb52542E26590708254fe',
  ESCROW: '0xb9E66aA8Ed13bA563247F4b2375fD19CF4B2c32C',
  TOURNAMENT: '0xFbBC8C646f2c7c145EEA2c30A82B2A17f64F7B92',
  COMMIT_REVEAL: '0x3475cf785fDacc1B1d7f28BFc412e21B1cd5179d',
  SPECTATOR_BETTING: '0x30E0A00f4589d786b390a3bdB043C69093292F17',
  POKER_GAME_4MAX: '0xecaaEAA736a96B58d51793D288acE31499F7Fed2',
  ESCROW_4MAX: '0x0725199719bc9b20A82D2E9C1B17F008EBc70144',
} as const;

// Testnet Contract Addresses (deployed 2026-02-04)
export const TESTNET_CONTRACTS = {
  POKER_GAME: '0x2c19bEBa8A082b85D7c6D1564dD0Ebf9A149f2f0',
  ESCROW: '0x1174cFAe0E75F4c0FBd57F65b504c17C24B3fC8F',
  TOURNAMENT: '0x5658DC8fE47D27aBA44F9BAEa34D0Ab8b8566aaC',
  COMMIT_REVEAL: '0x50b49b4CfaBcb61781f8356de5f4F3f8D90Be11b',
  SPECTATOR_BETTING: '0xFf85d9b5e2361bA32866beF85F53065be8d2faba',
  POKER_GAME_4MAX: '0x9d4191980352547DcF029Ee1f6C6806E17ae2811',
  ESCROW_4MAX: '0x943473B2fF00482536BD6B64A650dF73A7dA3B04',
} as const;

// Get contracts for chain
export function getContractsForChain(chainId: number) {
  return chainId === 143 ? MAINNET_CONTRACTS : TESTNET_CONTRACTS;
}

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
