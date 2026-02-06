// Contract ABI for PokerGame
export const POKER_GAME_ABI = [
  {
    name: 'createGame',
    type: 'function',
    inputs: [{ name: 'cardCommitment', type: 'bytes32' }],
    outputs: [{ name: 'gameId', type: 'bytes32' }],
    stateMutability: 'payable',
  },
  {
    name: 'joinGame',
    type: 'function',
    inputs: [
      { name: 'gameId', type: 'bytes32' },
      { name: 'cardCommitment', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'takeAction',
    type: 'function',
    inputs: [
      { name: 'gameId', type: 'bytes32' },
      { name: 'action', type: 'uint8' },
      { name: 'raiseAmount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'revealCards',
    type: 'function',
    inputs: [
      { name: 'gameId', type: 'bytes32' },
      { name: 'cards', type: 'uint8[2]' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'claimTimeout',
    type: 'function',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getGame',
    type: 'function',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'gameId', type: 'bytes32' },
          {
            name: 'players',
            type: 'tuple[2]',
            components: [
              { name: 'wallet', type: 'address' },
              { name: 'chips', type: 'uint256' },
              { name: 'cardCommitment', type: 'bytes32' },
              { name: 'holeCards', type: 'uint8[2]' },
              { name: 'folded', type: 'bool' },
              { name: 'revealed', type: 'bool' },
              { name: 'currentBet', type: 'uint256' },
            ],
          },
          { name: 'pot', type: 'uint256' },
          { name: 'currentBet', type: 'uint256' },
          { name: 'dealerIndex', type: 'uint8' },
          { name: 'phase', type: 'uint8' },
          { name: 'communityCards', type: 'uint8[5]' },
          { name: 'communityCardCount', type: 'uint8' },
          { name: 'lastActionTime', type: 'uint256' },
          { name: 'timeoutDuration', type: 'uint256' },
          { name: 'activePlayerIndex', type: 'uint8' },
          { name: 'isActive', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getActiveGames',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
  },
  // Events
  {
    name: 'GameCreated',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'player1', type: 'address', indexed: true },
      { name: 'wager', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'PlayerJoined',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'player2', type: 'address', indexed: true },
    ],
  },
  {
    name: 'ActionTaken',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'action', type: 'uint8', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'PhaseChanged',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'newPhase', type: 'uint8', indexed: false },
    ],
  },
  {
    name: 'GameEnded',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'pot', type: 'uint256', indexed: false },
    ],
  },
] as const;

// Contract addresses - Monad Testnet (deployed 2026-02-04)
export const POKER_GAME_ADDRESS = '0x2c19bEBa8A082b85D7c6D1564dD0Ebf9A149f2f0' as `0x${string}`;
export const ESCROW_ADDRESS = '0x1174cFAe0E75F4c0FBd57F65b504c17C24B3fC8F' as `0x${string}`;
export const TOURNAMENT_ADDRESS = '0x5658DC8fE47D27aBA44F9BAEa34D0Ab8b8566aaC' as `0x${string}`;
export const COMMIT_REVEAL_ADDRESS = '0x50b49b4CfaBcb61781f8356de5f4F3f8D90Be11b' as `0x${string}`;
export const SPECTATOR_BETTING_ADDRESS = '0xFf85d9b5e2361bA32866beF85F53065be8d2faba' as `0x${string}`;

// 4-Player Poker Contract addresses - Monad Testnet (deployed 2026-02-05)
export const POKER_GAME_4MAX_ADDRESS = '0x9d4191980352547DcF029Ee1f6C6806E17ae2811' as `0x${string}`;
export const ESCROW_4MAX_ADDRESS = '0x943473B2fF00482536BD6B64A650dF73A7dA3B04' as `0x${string}`;

// SpectatorBetting ABI
export const SPECTATOR_BETTING_ABI = [
  {
    name: 'placeBet',
    type: 'function',
    inputs: [
      { name: 'gameId', type: 'bytes32' },
      { name: 'predictedWinner', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'settleBets',
    type: 'function',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'claimWinnings',
    type: 'function',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getPool',
    type: 'function',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [
      { name: 'totalPool0', type: 'uint256' },
      { name: 'totalPool1', type: 'uint256' },
      { name: 'totalBets', type: 'uint256' },
      { name: 'settled', type: 'bool' },
      { name: 'winner', type: 'address' },
      { name: 'winnerIndex', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getOdds',
    type: 'function',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [
      { name: 'odds0', type: 'uint256' },
      { name: 'odds1', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getUserBets',
    type: 'function',
    inputs: [
      { name: 'gameId', type: 'bytes32' },
      { name: 'bettor', type: 'address' },
    ],
    outputs: [
      { name: 'totalOnPlayer0', type: 'uint256' },
      { name: 'totalOnPlayer1', type: 'uint256' },
      { name: 'betCount', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getPlayers',
    type: 'function',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [
      { name: 'player0', type: 'address' },
      { name: 'player1', type: 'address' },
    ],
    stateMutability: 'view',
  },
  // Events
  {
    name: 'BetPlaced',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'bettor', type: 'address', indexed: true },
      { name: 'predictedWinner', type: 'uint8', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'BettingPoolSettled',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'winner', type: 'address', indexed: false },
      { name: 'winnerIndex', type: 'uint8', indexed: false },
    ],
  },
  {
    name: 'WinningsClaimed',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'bettor', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// Action type mapping
export const ACTION_TYPES = {
  fold: 0,
  check: 1,
  call: 2,
  raise: 3,
  all_in: 4,
} as const;

// Phase mapping
export const PHASE_NAMES = {
  0: 'waiting',
  1: 'preflop',
  2: 'flop',
  3: 'turn',
  4: 'river',
  5: 'showdown',
  6: 'complete',
} as const;

// PokerGame4Max ABI - 2-4 player support
export const POKER_GAME_4MAX_ABI = [
  {
    name: 'createGame',
    type: 'function',
    inputs: [{ name: 'cardCommitment', type: 'bytes32' }],
    outputs: [{ name: 'gameId', type: 'bytes32' }],
    stateMutability: 'payable',
  },
  {
    name: 'joinGame',
    type: 'function',
    inputs: [
      { name: 'gameId', type: 'bytes32' },
      { name: 'cardCommitment', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'startGame',
    type: 'function',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'takeAction',
    type: 'function',
    inputs: [
      { name: 'gameId', type: 'bytes32' },
      { name: 'action', type: 'uint8' },
      { name: 'raiseAmount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'revealCards',
    type: 'function',
    inputs: [
      { name: 'gameId', type: 'bytes32' },
      { name: 'cards', type: 'uint8[2]' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'claimTimeout',
    type: 'function',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getGame',
    type: 'function',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'gameId', type: 'bytes32' },
          {
            name: 'players',
            type: 'tuple[4]',
            components: [
              { name: 'wallet', type: 'address' },
              { name: 'chips', type: 'uint256' },
              { name: 'cardCommitment', type: 'bytes32' },
              { name: 'holeCards', type: 'uint8[2]' },
              { name: 'folded', type: 'bool' },
              { name: 'revealed', type: 'bool' },
              { name: 'currentBet', type: 'uint256' },
            ],
          },
          { name: 'playerCount', type: 'uint8' },
          { name: 'minPlayers', type: 'uint8' },
          { name: 'maxPlayers', type: 'uint8' },
          { name: 'pot', type: 'uint256' },
          { name: 'currentBet', type: 'uint256' },
          { name: 'dealerIndex', type: 'uint8' },
          { name: 'smallBlindIndex', type: 'uint8' },
          { name: 'bigBlindIndex', type: 'uint8' },
          { name: 'phase', type: 'uint8' },
          { name: 'communityCards', type: 'uint8[5]' },
          { name: 'communityCardCount', type: 'uint8' },
          { name: 'lastActionTime', type: 'uint256' },
          { name: 'timeoutDuration', type: 'uint256' },
          { name: 'activePlayerIndex', type: 'uint8' },
          { name: 'lastRaiserIndex', type: 'uint8' },
          { name: 'actionsThisRound', type: 'uint8' },
          { name: 'isActive', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getActiveGames',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
  },
  // Events
  {
    name: 'GameCreated',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'wager', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'PlayerJoined',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'playerIndex', type: 'uint8', indexed: false },
    ],
  },
  {
    name: 'GameStarted',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'playerCount', type: 'uint8', indexed: false },
    ],
  },
  {
    name: 'ActionTaken',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'action', type: 'uint8', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'PhaseChanged',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'newPhase', type: 'uint8', indexed: false },
    ],
  },
  {
    name: 'GameEnded',
    type: 'event',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'pot', type: 'uint256', indexed: false },
    ],
  },
] as const;
