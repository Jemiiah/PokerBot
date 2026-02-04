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

// Contract addresses - Monad Testnet
export const POKER_GAME_ADDRESS = '0xCb1ef57cC989ba3043edb52542E26590708254fe' as `0x${string}`;
export const ESCROW_ADDRESS = '0xb9E66aA8Ed13bA563247F4b2375fD19CF4B2c32C' as `0x${string}`;
export const TOURNAMENT_ADDRESS = '0xFbBC8C646f2c7c145EEA2c30A82B2A17f64F7B92' as `0x${string}`;
export const COMMIT_REVEAL_ADDRESS = '0x3475cf785fDacc1B1d7f28BFc412e21B1cd5179d' as `0x${string}`;

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
