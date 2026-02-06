import {
  formatEther,
  keccak256,
  encodePacked,
} from 'viem';
import { WalletManager } from './WalletManager.js';
import { config } from '../utils/config.js';
import { createChildLogger } from '../utils/logger.js';
import type { ActionType } from '@poker/shared';

const logger = createChildLogger('ContractClient');

// ABI for PokerGame4Max contract (2-4 players)
const POKER_GAME_ABI = [
  {
    name: 'createGame',
    type: 'function',
    inputs: [
      { name: 'cardCommitment', type: 'bytes32' },
      { name: 'minPlayers', type: 'uint8' },
      { name: 'maxPlayers', type: 'uint8' },
    ],
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
    name: 'startGame',
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
              { name: 'isAllIn', type: 'bool' },
            ],
          },
          { name: 'playerCount', type: 'uint8' },
          { name: 'minPlayers', type: 'uint8' },
          { name: 'maxPlayers', type: 'uint8' },
          { name: 'mainPot', type: 'uint256' },
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
          { name: 'isActive', type: 'bool' },
          { name: 'actionsThisRound', type: 'uint8' },
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
      { name: 'minPlayers', type: 'uint8', indexed: false },
      { name: 'maxPlayers', type: 'uint8', indexed: false },
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

// Action type to contract enum mapping
const ACTION_TO_ENUM: Record<ActionType, number> = {
  fold: 0,
  check: 1,
  call: 2,
  raise: 3,
  all_in: 4,
};

export class ContractClient {
  private wallet: WalletManager;
  private contractAddress: `0x${string}`;
  private abi: typeof POKER_GAME_ABI;

  constructor(wallet: WalletManager) {
    this.wallet = wallet;
    this.contractAddress = config.pokerGameAddress;
    this.abi = POKER_GAME_ABI;

    logger.info({ address: config.pokerGameAddress }, 'Contract client initialized');
  }

  /**
   * Create a card commitment hash
   */
  createCommitment(card1: number, card2: number, salt: `0x${string}`): `0x${string}` {
    return keccak256(encodePacked(['uint8', 'uint8', 'bytes32'], [card1, card2, salt]));
  }

  /**
   * Generate a random salt for commitment
   */
  generateSalt(): `0x${string}` {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
  }

  /**
   * Create a new poker game
   */
  async createGame(wagerAmount: bigint, cards: [number, number]): Promise<{
    gameId: `0x${string}`;
    salt: `0x${string}`;
    txHash: `0x${string}`;
  }> {
    const salt = this.generateSalt();
    const commitment = this.createCommitment(cards[0], cards[1], salt);

    logger.info(
      { wager: formatEther(wagerAmount), commitment },
      'Creating game'
    );

    // Create game with 2-4 players (default: min 2, max 4)
    const minPlayers = 2;
    const maxPlayers = 4;

    const hash = await this.wallet.wallet.writeContract({
      address: this.contractAddress,
      abi: this.abi,
      functionName: 'createGame',
      args: [commitment, minPlayers, maxPlayers],
      value: wagerAmount,
      chain: this.wallet.chain,
      account: this.wallet.walletAccount,
      gas: 500000n, // Gas limit for Monad testnet - increased for createGame complexity
    });

    const receipt = await this.wallet.waitForTransaction(hash);

    // Parse GameCreated event to get gameId
    // Event signature: GameCreated(bytes32 indexed gameId, address indexed creator, uint256 wager, uint8 minPlayers, uint8 maxPlayers)
    const gameCreatedLog = receipt.logs.find(log => {
      // Check if this is the GameCreated event
      return log.topics[0] === keccak256(
        encodePacked(['string'], ['GameCreated(bytes32,address,uint256,uint8,uint8)'])
      );
    });

    const gameId = gameCreatedLog?.topics[1] as `0x${string}`;

    if (!gameId) {
      logger.warn({ receipt }, 'GameCreated event not found, using first topic from first log');
      // Fallback: use the first indexed topic from any log
      const fallbackGameId = receipt.logs[0]?.topics[1] as `0x${string}`;
      if (fallbackGameId) {
        return { gameId: fallbackGameId, salt, txHash: hash };
      }
      throw new Error('Failed to get gameId from transaction receipt');
    }

    logger.info({ gameId, txHash: hash }, 'Game created');

    return { gameId, salt, txHash: hash };
  }

  /**
   * Join an existing game
   */
  async joinGame(
    gameId: `0x${string}`,
    wagerAmount: bigint,
    cards: [number, number]
  ): Promise<{ salt: `0x${string}`; txHash: `0x${string}` }> {
    const salt = this.generateSalt();
    const commitment = this.createCommitment(cards[0], cards[1], salt);

    logger.info({ gameId, wager: formatEther(wagerAmount) }, 'Joining game');

    const hash = await this.wallet.wallet.writeContract({
      address: this.contractAddress,
      abi: this.abi,
      functionName: 'joinGame',
      args: [gameId, commitment],
      value: wagerAmount,
      chain: this.wallet.chain,
      account: this.wallet.walletAccount,
      gas: 500000n, // Gas limit for Monad testnet - increased for joinGame complexity
    });

    await this.wallet.waitForTransaction(hash);

    logger.info({ gameId, txHash: hash }, 'Joined game');

    return { salt, txHash: hash };
  }

  /**
   * Take an action in the game
   */
  async takeAction(
    gameId: `0x${string}`,
    action: ActionType,
    raiseAmount: bigint = 0n
  ): Promise<`0x${string}`> {
    const actionEnum = ACTION_TO_ENUM[action];

    logger.info({ gameId, action, raiseAmount: formatEther(raiseAmount) }, 'Taking action');

    const hash = await this.wallet.wallet.writeContract({
      address: this.contractAddress,
      abi: this.abi,
      functionName: 'takeAction',
      args: [gameId, actionEnum, raiseAmount],
      chain: this.wallet.chain,
      account: this.wallet.walletAccount,
      gas: 500000n, // Required gas limit for Monad testnet
    });

    await this.wallet.waitForTransaction(hash);

    logger.info({ gameId, action, txHash: hash }, 'Action taken');

    return hash;
  }

  /**
   * Reveal hole cards at showdown
   */
  async revealCards(
    gameId: `0x${string}`,
    cards: [number, number],
    salt: `0x${string}`
  ): Promise<`0x${string}`> {
    logger.info({ gameId, cards }, 'Revealing cards');

    const hash = await this.wallet.wallet.writeContract({
      address: this.contractAddress,
      abi: this.abi,
      functionName: 'revealCards',
      args: [gameId, cards, salt],
      chain: this.wallet.chain,
      account: this.wallet.walletAccount,
    });

    await this.wallet.waitForTransaction(hash);

    logger.info({ gameId, txHash: hash }, 'Cards revealed');

    return hash;
  }

  /**
   * Claim win due to opponent timeout
   */
  async claimTimeout(gameId: `0x${string}`): Promise<`0x${string}`> {
    logger.info({ gameId }, 'Claiming timeout');

    const hash = await this.wallet.wallet.writeContract({
      address: this.contractAddress,
      abi: this.abi,
      functionName: 'claimTimeout',
      args: [gameId],
      chain: this.wallet.chain,
      account: this.wallet.walletAccount,
    });

    await this.wallet.waitForTransaction(hash);

    logger.info({ gameId, txHash: hash }, 'Timeout claimed');

    return hash;
  }

  /**
   * Start a game (when minPlayers reached but maxPlayers not reached)
   * Only the game creator can call this
   */
  async startGame(gameId: `0x${string}`): Promise<`0x${string}`> {
    logger.info({ gameId }, 'Starting game');

    const hash = await this.wallet.wallet.writeContract({
      address: this.contractAddress,
      abi: this.abi,
      functionName: 'startGame',
      args: [gameId],
      chain: this.wallet.chain,
      account: this.wallet.walletAccount,
      gas: 500000n, // Required gas limit for Monad testnet
    });

    await this.wallet.waitForTransaction(hash);

    logger.info({ gameId, txHash: hash }, 'Game started');

    return hash;
  }

  /**
   * Get game state
   */
  async getGame(gameId: `0x${string}`): Promise<any> {
    return this.wallet.client.readContract({
      address: this.contractAddress,
      abi: this.abi,
      functionName: 'getGame',
      args: [gameId],
    });
  }

  /**
   * Get all active games
   */
  async getActiveGames(): Promise<readonly `0x${string}`[]> {
    return this.wallet.client.readContract({
      address: this.contractAddress,
      abi: this.abi,
      functionName: 'getActiveGames',
    }) as Promise<readonly `0x${string}`[]>;
  }

  /**
   * Watch for game events
   */
  watchGameEvents(
    gameId: `0x${string}`,
    callbacks: {
      onAction?: (player: string, action: number, amount: bigint) => void;
      onPhaseChange?: (newPhase: number) => void;
      onGameEnd?: (winner: string, pot: bigint) => void;
    }
  ) {
    // Watch ActionTaken events
    if (callbacks.onAction) {
      this.wallet.client.watchContractEvent({
        address: config.pokerGameAddress,
        abi: POKER_GAME_ABI,
        eventName: 'ActionTaken',
        args: { gameId },
        onLogs: logs => {
          for (const log of logs) {
            callbacks.onAction?.(
              (log as any).args.player,
              (log as any).args.action,
              (log as any).args.amount
            );
          }
        },
      });
    }

    // Watch PhaseChanged events
    if (callbacks.onPhaseChange) {
      this.wallet.client.watchContractEvent({
        address: config.pokerGameAddress,
        abi: POKER_GAME_ABI,
        eventName: 'PhaseChanged',
        args: { gameId },
        onLogs: logs => {
          for (const log of logs) {
            callbacks.onPhaseChange?.((log as any).args.newPhase);
          }
        },
      });
    }

    // Watch GameEnded events
    if (callbacks.onGameEnd) {
      this.wallet.client.watchContractEvent({
        address: config.pokerGameAddress,
        abi: POKER_GAME_ABI,
        eventName: 'GameEnded',
        args: { gameId },
        onLogs: logs => {
          for (const log of logs) {
            callbacks.onGameEnd?.(
              (log as any).args.winner,
              (log as any).args.pot
            );
          }
        },
      });
    }
  }
}
