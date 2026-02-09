import type { Card, HoleCards } from '@poker/shared';
import { indexToCard, cardToString } from '@poker/shared';
import WebSocket from 'ws';
import { WalletManager, ContractClient } from './blockchain/index.js';
import { StrategyEngine } from './strategy/index.js';
import { OpponentModel } from './opponent/index.js';
import { BankrollManager } from './bankroll/index.js';
import { PersonalityService } from './personality/index.js';
import { config, createChildLogger } from './utils/index.js';

const logger = createChildLogger('Agent');

// Coordinator WebSocket URL
const COORDINATOR_WS_URL = process.env.COORDINATOR_WS_URL || 'ws://localhost:8080/ws';

// Rate limiting configuration
const BASE_POLL_INTERVAL = 8000; // 8 seconds base polling interval
const MAX_POLL_INTERVAL = 30000; // Max 30 seconds on backoff
const STAGGER_DELAY_PER_AGENT = 1000; // 1 second stagger per agent
const READY_SIGNAL_INTERVAL = 10000; // Signal ready every 10 seconds if not in game

// Agent name to stagger index mapping for deterministic staggering
const AGENT_STAGGER_INDEX: Record<string, number> = {
  'Blaze': 0,
  'Frost': 1,
  'Shadow': 2,
  'Storm': 3,
  'Sage': 4,
  'Ember': 5,
  'Viper': 6,
  'Titan': 7,
};

interface ActiveGame {
  gameId: `0x${string}`;
  holeCards: [number, number];
  salt: `0x${string}`;
  opponentAddress: string;
  wagerAmount: bigint;
  isCreator: boolean;
  lastKnownPhase?: string; // Track phase for spectator pause notifications
}

// Lock to prevent concurrent game creation/joining
let gameOperationLock = false;

const PHASE_MAP: Record<number, string> = {
  0: 'waiting',
  1: 'preflop',
  2: 'flop',
  3: 'turn',
  4: 'river',
  5: 'showdown',
  6: 'complete',
};

/**
 * Main Poker Agent class
 */
export class PokerAgent {
  private wallet: WalletManager;
  private contract: ContractClient;
  private strategy: StrategyEngine;
  private opponentModel: OpponentModel;
  private bankroll: BankrollManager;
  private personality: PersonalityService;

  private activeGames: Map<string, ActiveGame> = new Map();
  private isRunning: boolean = false;
  private coordinatorWs: WebSocket | null = null;
  private coordinatorReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentPollInterval: number = BASE_POLL_INTERVAL;
  private consecutiveErrors: number = 0;

  // Coordinator-based matchmaking
  private isQueuedForMatch: boolean = false;
  private readySignalTimer: ReturnType<typeof setInterval> | null = null;
  private pendingJoiners: Array<{ address: string; name: string }> = [];

  constructor() {
    logger.info({ name: config.agentName, personality: config.personalityName, mode: config.agentMode }, 'Initializing poker agent');

    this.wallet = new WalletManager();
    this.contract = new ContractClient(this.wallet);
    this.strategy = new StrategyEngine();
    this.opponentModel = new OpponentModel();
    this.bankroll = new BankrollManager(0n); // Will be updated on start
    this.personality = new PersonalityService(config.personalityName, config.agentMode);
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    logger.info('Starting poker agent');

    // Connect to coordinator for thought relay and matchmaking
    this.connectToCoordinator();

    // Get initial balance
    const balance = await this.wallet.getBalance();
    this.bankroll.updateBalance(balance);

    logger.info(
      {
        address: this.wallet.address,
        balance: await this.wallet.getFormattedBalance(),
      },
      'Agent wallet ready'
    );

    this.isRunning = true;

    // Stagger startup based on agent name to avoid all agents polling at once
    const staggerIndex = AGENT_STAGGER_INDEX[config.personalityName] || Math.floor(Math.random() * 8);
    const staggerDelay = staggerIndex * STAGGER_DELAY_PER_AGENT;

    if (staggerDelay > 0) {
      logger.info({ staggerDelay, staggerIndex }, 'Applying startup stagger to avoid rate limiting');
      await this.sleep(staggerDelay);
    }

    // Start ready signaling for coordinator-based matchmaking
    this.startReadySignaling();

    // Start the main loop
    await this.mainLoop();
  }

  /**
   * Stop the agent
   */
  stop(): void {
    logger.info('Stopping poker agent');
    this.isRunning = false;

    // Stop ready signaling
    this.stopReadySignaling();

    // Close coordinator connection
    if (this.coordinatorReconnectTimer) {
      clearTimeout(this.coordinatorReconnectTimer);
      this.coordinatorReconnectTimer = null;
    }
    if (this.coordinatorWs) {
      this.coordinatorWs.close();
      this.coordinatorWs = null;
    }

    // Log summary
    logger.info(this.bankroll.getSummary());
  }

  /**
   * Connect to coordinator WebSocket for thought relay and matchmaking
   */
  private connectToCoordinator(): void {
    try {
      this.coordinatorWs = new WebSocket(COORDINATOR_WS_URL);

      this.coordinatorWs.on('open', async () => {
        logger.info({ url: COORDINATOR_WS_URL }, 'Connected to coordinator');

        // Get current balance for registration
        const balance = await this.wallet.getBalance();

        // Register with coordinator - include personality name and balance
        this.coordinatorWs?.send(
          JSON.stringify({
            type: 'register',
            address: this.wallet.address,
            name: config.personalityName,
            personality: config.personalityName,
            balance: balance.toString(),
          })
        );
      });

      this.coordinatorWs.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleCoordinatorMessage(message);
        } catch (error) {
          logger.error({ error }, 'Failed to parse coordinator message');
        }
      });

      this.coordinatorWs.on('close', () => {
        logger.warn('Disconnected from coordinator');
        this.coordinatorWs = null;
        this.isQueuedForMatch = false;
        // Reconnect after delay if still running
        if (this.isRunning) {
          this.coordinatorReconnectTimer = setTimeout(() => {
            logger.info('Reconnecting to coordinator...');
            this.connectToCoordinator();
          }, 5000);
        }
      });

      this.coordinatorWs.on('error', (error) => {
        logger.error({ error }, 'Coordinator WebSocket error');
      });
    } catch (error) {
      logger.error({ error }, 'Failed to connect to coordinator');
      // Retry after delay
      if (this.isRunning) {
        this.coordinatorReconnectTimer = setTimeout(() => {
          this.connectToCoordinator();
        }, 5000);
      }
    }
  }

  /**
   * Handle messages from coordinator
   */
  private async handleCoordinatorMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'pong':
        // Heartbeat response
        break;

      case 'registered':
        logger.info('Registered with coordinator');
        // Signal ready to play after registration
        this.signalReadyToPlay();
        break;

      case 'queued':
        this.isQueuedForMatch = true;
        logger.info({ queueSize: message.queueSize }, 'Added to matchmaking queue');
        break;

      case 'dequeued':
        this.isQueuedForMatch = false;
        logger.info('Removed from matchmaking queue');
        break;

      case 'create_game_command':
        // Coordinator tells us to create a game
        // Check if we're already in a game or processing another command
        if (this.activeGames.size > 0 || gameOperationLock) {
          logger.warn({ activeGames: this.activeGames.size, locked: gameOperationLock }, 'Ignoring create_game_command - already in game or locked');
          return;
        }

        logger.info({
          wager: message.wagerAmount,
          expectedPlayers: message.expectedPlayers?.length,
        }, 'Received create_game_command from coordinator');

        gameOperationLock = true;
        this.pendingJoiners = message.expectedPlayers || [];

        await this.createGameByCommand(
          BigInt(message.wagerAmount),
          message.minPlayers || 2,
          message.maxPlayers || 4
        );
        break;

      case 'join_game_command':
        // Coordinator tells us to join a specific game
        // Check if we're already in a game or processing another command
        if (this.activeGames.size > 0 || gameOperationLock) {
          logger.warn({ activeGames: this.activeGames.size, locked: gameOperationLock }, 'Ignoring join_game_command - already in game or locked');
          return;
        }

        logger.info({
          gameId: message.gameId,
          wager: message.wagerAmount,
          creator: message.creatorName,
        }, 'Received join_game_command from coordinator');

        gameOperationLock = true;

        await this.joinGameByCommand(
          message.gameId as `0x${string}`,
          BigInt(message.wagerAmount)
        );
        break;

      default:
        logger.debug({ type: message.type }, 'Unknown coordinator message');
    }
  }

  /**
   * Signal to coordinator that we're ready to play
   */
  private async signalReadyToPlay(): Promise<void> {
    if (!this.coordinatorWs || this.coordinatorWs.readyState !== WebSocket.OPEN) {
      return;
    }

    // Don't signal if we're already in a game
    if (this.activeGames.size > 0) {
      logger.debug({ activeGames: this.activeGames.size }, 'In active game, not signaling ready');
      return;
    }

    // Don't signal if already queued or processing a game operation
    if (this.isQueuedForMatch || gameOperationLock) {
      logger.debug({ queued: this.isQueuedForMatch, locked: gameOperationLock }, 'Already queued or locked, not signaling ready');
      return;
    }

    // Get current balance
    const balance = await this.wallet.getBalance();
    this.bankroll.updateBalance(balance);

    // Fixed entry fee: 0.01 MON (must have enough for entry + gas)
    const FIXED_ENTRY_FEE = 10000000000000000n; // 0.01 MON
    const GAS_BUFFER = 4000000000000000n; // 0.004 MON for gas
    const minRequired = FIXED_ENTRY_FEE + GAS_BUFFER;

    // Only signal ready if we have enough balance for entry + gas
    if (balance < minRequired) {
      logger.warn({
        balance: balance.toString(),
        required: minRequired.toString(),
      }, 'Balance too low for fixed entry fee + gas');
      return;
    }

    this.coordinatorWs.send(
      JSON.stringify({
        type: 'ready_to_play',
        address: this.wallet.address,
        balance: balance.toString(),
        maxWager: FIXED_ENTRY_FEE.toString(), // Always use fixed entry fee
      })
    );

    logger.info({
      balance: await this.wallet.getFormattedBalance(),
      entryFee: '0.01 MON',
    }, 'Signaled ready to play');
  }

  /**
   * Create a game as commanded by coordinator
   */
  private async createGameByCommand(
    wagerAmount: bigint,
    minPlayers: number,
    maxPlayers: number
  ): Promise<void> {
    try {
      // Generate random hole cards
      const holeCards = this.generateRandomHoleCards();

      logger.info({
        wager: wagerAmount.toString(),
        minPlayers,
        maxPlayers,
        pendingJoiners: this.pendingJoiners.map(j => j.name),
      }, 'Creating game by coordinator command');

      this.bankroll.reserveForMatch(wagerAmount);

      // Pass minPlayers and maxPlayers to contract
      const result = await this.contract.createGame(wagerAmount, holeCards, minPlayers, maxPlayers);

      this.activeGames.set(result.gameId, {
        gameId: result.gameId,
        holeCards,
        salt: result.salt,
        opponentAddress: '',
        wagerAmount,
        isCreator: true,
      });

      // Mark as no longer queued AFTER game is successfully created
      this.isQueuedForMatch = false;

      logger.info({ gameId: result.gameId }, 'Game created by command');

      // Notify coordinator that game was created
      if (this.coordinatorWs && this.coordinatorWs.readyState === WebSocket.OPEN) {
        this.coordinatorWs.send(
          JSON.stringify({
            type: 'game_created_by_command',
            gameId: result.gameId,
            creator: this.wallet.address,
            wagerAmount: wagerAmount.toString(),
            pendingJoiners: this.pendingJoiners,
          })
        );
      }

      // Send hole cards for spectator display
      this.sendHoleCardsToCoordinator(result.gameId, holeCards);

      // Clear pending joiners
      this.pendingJoiners = [];
    } catch (error) {
      logger.error({ error }, 'Failed to create game by command');
      this.isQueuedForMatch = false;
      // Re-signal ready to play after delay
      setTimeout(() => this.signalReadyToPlay(), 5000);
    } finally {
      // Always release the lock
      gameOperationLock = false;
    }
  }

  /**
   * Join a game as commanded by coordinator
   */
  private async joinGameByCommand(gameId: `0x${string}`, wagerAmount: bigint): Promise<void> {
    try {
      // Generate random hole cards
      const holeCards = this.generateRandomHoleCards();

      logger.info({ gameId, wager: wagerAmount.toString() }, 'Joining game by coordinator command');

      this.bankroll.reserveForMatch(wagerAmount);

      const result = await this.contract.joinGame(gameId, wagerAmount, holeCards);

      // Get opponent address (game creator)
      const gameState = await this.contract.getGame(gameId);

      this.activeGames.set(gameId, {
        gameId,
        holeCards,
        salt: result.salt,
        opponentAddress: gameState.players[0].wallet,
        wagerAmount,
        isCreator: false,
      });

      // Mark as no longer queued AFTER successfully joining
      this.isQueuedForMatch = false;

      logger.info({ gameId }, 'Joined game by command');

      // Notify coordinator
      if (this.coordinatorWs && this.coordinatorWs.readyState === WebSocket.OPEN) {
        this.coordinatorWs.send(
          JSON.stringify({
            type: 'match_joined',
            gameId,
            player: this.wallet.address,
          })
        );
      }

      // Send hole cards for spectator display
      this.sendHoleCardsToCoordinator(gameId, holeCards);
    } catch (error) {
      logger.error({ error, gameId }, 'Failed to join game by command');
      this.isQueuedForMatch = false;
      // Re-signal ready to play after delay
      setTimeout(() => this.signalReadyToPlay(), 5000);
    } finally {
      // Always release the lock
      gameOperationLock = false;
    }
  }

  /**
   * Start periodic ready signal
   */
  private startReadySignaling(): void {
    // Signal ready immediately
    this.signalReadyToPlay();

    // Then periodically re-signal if not in a game
    // Increased interval to reduce race conditions
    this.readySignalTimer = setInterval(() => {
      // Only signal if: not in game, not queued, not processing a command
      if (this.activeGames.size === 0 && !this.isQueuedForMatch && !gameOperationLock) {
        this.signalReadyToPlay();
      }
    }, READY_SIGNAL_INTERVAL);
  }

  /**
   * Stop ready signaling
   */
  private stopReadySignaling(): void {
    if (this.readySignalTimer) {
      clearInterval(this.readySignalTimer);
      this.readySignalTimer = null;
    }
  }

  /**
   * Send thought/reasoning to coordinator for frontend display
   */
  private async sendThoughtToCoordinator(
    gameId: string,
    decision: {
      action: string;
      amount?: bigint;
      reasoning: string;
      confidence?: number;
    },
    extra?: {
      equity?: number;
      potOdds?: number;
      holeCards?: string;
      communityCards?: string;
      phase?: string;
    }
  ): Promise<void> {
    if (!this.coordinatorWs || this.coordinatorWs.readyState !== WebSocket.OPEN) {
      logger.warn({
        hasWs: !!this.coordinatorWs,
        readyState: this.coordinatorWs?.readyState
      }, 'Cannot send thought - coordinator WebSocket not connected');
      return;
    }

    logger.debug({ gameId, action: decision.action }, 'Sending thought to coordinator');

    try {
      // Generate personality-flavored thought
      const personalityThought = await this.personality.generateThought({
        action: decision.action,
        amount: decision.amount,
        reasoning: decision.reasoning,
        equity: extra?.equity,
        potOdds: extra?.potOdds,
        phase: extra?.phase || 'unknown',
        holeCards: extra?.holeCards,
        communityCards: extra?.communityCards,
      });

      this.coordinatorWs.send(
        JSON.stringify({
          type: 'agent_thought',
          gameId,
          agentAddress: this.wallet.address,
          agentName: this.personality.getPersonality().name,
          action: decision.action,
          amount: decision.amount?.toString(),
          reasoning: personalityThought, // Use personality-flavored thought
          rawReasoning: decision.reasoning, // Keep original for debugging
          confidence: decision.confidence,
          equity: extra?.equity,
          potOdds: extra?.potOdds,
          holeCards: extra?.holeCards, // Send hole cards for spectator display
        })
      );
      logger.info({ gameId, action: decision.action, thought: personalityThought.slice(0, 50) }, 'Thought sent to coordinator');
    } catch (error) {
      logger.error({ error }, 'Failed to send thought to coordinator');
    }
  }

  /**
   * Notify coordinator that this agent's turn has started
   * Used for frontend turn timer display
   */
  private sendTurnStartToCoordinator(gameId: string, turnDurationMs: number): void {
    if (!this.coordinatorWs || this.coordinatorWs.readyState !== WebSocket.OPEN) {
      return;
    }

    this.coordinatorWs.send(
      JSON.stringify({
        type: 'turn_started',
        gameId,
        agentAddress: this.wallet.address,
        agentName: this.personality.getPersonality().name,
        turnDurationMs,
        timestamp: Date.now(),
      })
    );
    logger.debug({ gameId, turnDurationMs }, 'Turn start notification sent');
  }

  /**
   * Send hole cards to coordinator for spectator display
   * Called immediately when joining/creating a game so spectators can see cards
   */
  private sendHoleCardsToCoordinator(gameId: string, holeCards: [number, number]): void {
    if (!this.coordinatorWs || this.coordinatorWs.readyState !== WebSocket.OPEN) {
      return;
    }

    // Convert card indices to string format (e.g., "Ah Kd")
    const card1 = indexToCard(holeCards[0]);
    const card2 = indexToCard(holeCards[1]);
    const holeCardsStr = `${cardToString(card1)} ${cardToString(card2)}`;

    this.coordinatorWs.send(
      JSON.stringify({
        type: 'agent_cards',
        gameId,
        agentAddress: this.wallet.address,
        agentName: this.personality.getPersonality().name,
        holeCards: holeCardsStr,
        timestamp: Date.now(),
      })
    );
    logger.info({ gameId, cards: holeCardsStr }, 'Hole cards sent to coordinator for spectators');
  }

  /**
   * Main agent loop
   */
  private async mainLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check for active games that need action
        await this.checkActiveGames();

        // Look for new games to join
        await this.lookForGames();

        // Reset error count on success
        this.consecutiveErrors = 0;
        this.currentPollInterval = BASE_POLL_INTERVAL;

        // Use dynamic polling interval
        logger.debug({ pollInterval: this.currentPollInterval }, 'Sleeping before next poll');
        await this.sleep(this.currentPollInterval);
      } catch (error: any) {
        this.consecutiveErrors++;

        // Check for rate limiting (429 errors)
        const isRateLimited = error?.message?.includes('429') ||
          error?.message?.includes('rate') ||
          error?.message?.includes('limited');

        if (isRateLimited) {
          // Exponential backoff for rate limiting
          this.currentPollInterval = Math.min(
            this.currentPollInterval * 2,
            MAX_POLL_INTERVAL
          );
          logger.warn(
            { pollInterval: this.currentPollInterval, consecutiveErrors: this.consecutiveErrors },
            'Rate limited - applying exponential backoff'
          );
        } else {
          logger.error({ error, consecutiveErrors: this.consecutiveErrors }, 'Error in main loop');
        }

        // Wait with backoff
        const errorDelay = Math.min(5000 * this.consecutiveErrors, MAX_POLL_INTERVAL);
        await this.sleep(errorDelay);
      }
    }
  }

  /**
   * Check active games for required actions
   */
  private async checkActiveGames(): Promise<void> {
    for (const [gameId, activeGame] of this.activeGames) {
      try {
        // Small delay between game checks to avoid rate limiting
        await this.sleep(500);

        const gameState = await this.contract.getGame(gameId as `0x${string}`);

        const phase = PHASE_MAP[gameState.phase];

        // Detect phase transitions and notify coordinator for spectator pauses
        if (activeGame.lastKnownPhase && activeGame.lastKnownPhase !== phase) {
          await this.handlePhaseChange(gameId, activeGame.lastKnownPhase, phase);
        }
        activeGame.lastKnownPhase = phase;

        // Game is complete
        if (phase === 'complete') {
          await this.handleGameComplete(gameId, gameState);
          continue;
        }

        // If we're the creator and game is waiting with enough players, start it
        if (phase === 'waiting' && activeGame.isCreator) {
          if (gameState.playerCount >= gameState.minPlayers) {
            logger.info({ gameId, playerCount: gameState.playerCount }, 'Starting game as creator');
            try {
              await this.contract.startGame(gameId as `0x${string}`);
            } catch (startError: any) {
              // Game might already be started by another player joining
              if (!startError?.message?.includes('GameAlreadyStarted')) {
                logger.error({ gameId, error: startError }, 'Failed to start game');
              }
            }
          }
          continue; // Wait for next poll to see the started game
        }

        // Check if it's our turn
        const myIndex = this.getMyPlayerIndex(gameState);
        if (myIndex === -1) continue;

        const isMyTurn = gameState.activePlayerIndex === myIndex;

        logger.debug({
          gameId,
          phase,
          myIndex,
          isMyTurn,
          activePlayerIndex: gameState.activePlayerIndex,
        }, 'Checking game state');

        if (phase === 'showdown') {
          // Reveal cards at showdown
          if (!gameState.players[myIndex].revealed) {
            await this.revealCards(activeGame);
          }
        } else if (isMyTurn && phase !== 'waiting') {
          // Take action
          logger.info({ gameId, phase, myIndex }, 'Taking turn');
          await this.takeAction(activeGame, gameState);
        }
      } catch (error: any) {
        // Check for rate limiting
        if (error?.message?.includes('429') || error?.message?.includes('rate')) {
          throw error; // Propagate rate limit errors for backoff
        }
        // Better error logging
        const errorInfo = {
          message: error?.message || 'Unknown error',
          name: error?.name,
          cause: error?.cause?.message || error?.cause?.shortMessage,
        };
        logger.error({ gameId, error: errorInfo }, 'Error checking game');
      }
    }
  }

  /**
   * Look for games to join or create (fallback when coordinator matchmaking unavailable)
   */
  private async lookForGames(): Promise<void> {
    // Only look if we're not already in a game (strict single-game rule)
    if (this.activeGames.size >= 1) return;

    // Don't look if locked (processing another game operation)
    if (gameOperationLock) return;

    // If queued for coordinator matchmaking, don't do manual search
    if (this.isQueuedForMatch) {
      logger.debug('Queued for coordinator matchmaking, skipping manual game search');
      return;
    }

    // If coordinator is connected, rely on it for matchmaking
    if (this.coordinatorWs && this.coordinatorWs.readyState === WebSocket.OPEN) {
      logger.debug('Coordinator connected, using coordinator-based matchmaking');
      return;
    }

    logger.debug('Coordinator not available, using fallback game search');

    try {
      const activeGames = await this.contract.getActiveGames();

      let foundGameToJoin = false;

      for (const gameId of activeGames) {
        // Skip if already in this game
        if (this.activeGames.has(gameId)) continue;

        // Small delay between game checks to avoid rate limiting
        await this.sleep(300);

        const gameState = await this.contract.getGame(gameId);

        // Skip if game is not waiting for players
        if (gameState.phase !== 0) continue;

        // Skip if we're already player 1
        if (gameState.players[0].wallet.toLowerCase() === this.wallet.address.toLowerCase()) {
          continue;
        }

        // Skip if player 2 slot is taken
        if (gameState.players[1].wallet !== '0x0000000000000000000000000000000000000000') {
          continue;
        }

        // Check if we should join (pass isJoining=true for more lenient checks)
        const wagerAmount = gameState.players[0].chips;
        const shouldJoin = this.bankroll.shouldPlayMatch(wagerAmount, 0.5, true, true);

        if (shouldJoin.shouldPlay) {
          await this.joinGame(gameId, wagerAmount);
          foundGameToJoin = true;
          break; // Join one game at a time
        } else {
          logger.debug({ gameId, reason: shouldJoin.reason }, 'Skipping game');
        }
      }

      // If no games to join and we have no active games, create one
      if (!foundGameToJoin && this.activeGames.size === 0) {
        await this.maybeCreateGame();
      }
    } catch (error: any) {
      // Check for rate limiting
      if (error?.message?.includes('429') || error?.message?.includes('rate')) {
        throw error; // Propagate rate limit errors for backoff
      }
      logger.error({ error }, 'Error looking for games');
    }
  }

  /**
   * Maybe create a new game if conditions are right (fallback when coordinator unavailable)
   */
  private async maybeCreateGame(): Promise<void> {
    // If coordinator is connected, don't create games manually
    if (this.coordinatorWs && this.coordinatorWs.readyState === WebSocket.OPEN) {
      logger.debug('Coordinator connected, not creating game manually');
      return;
    }

    // Get current balance
    const balance = await this.wallet.getBalance();
    this.bankroll.updateBalance(balance);

    // Fixed entry fee: 0.01 MON
    const FIXED_ENTRY_FEE = 10000000000000000n; // 0.01 MON
    const GAS_BUFFER = 4000000000000000n; // 0.004 MON for gas
    const minRequired = FIXED_ENTRY_FEE + GAS_BUFFER;

    // Need enough for entry fee + gas
    if (balance < minRequired) {
      logger.debug({ balance: balance.toString(), required: minRequired.toString() }, 'Balance too low for fixed entry fee');
      return;
    }

    logger.info({ wager: FIXED_ENTRY_FEE.toString(), balance: balance.toString() }, 'Attempting to create game (fallback mode)');

    try {
      await this.createGame(FIXED_ENTRY_FEE);
    } catch (error) {
      logger.error({ error }, 'Failed to create game');
    }
  }

  /**
   * Create a new game
   */
  async createGame(wagerAmount: bigint): Promise<string | null> {
    const shouldCreate = this.bankroll.shouldPlayMatch(wagerAmount, 0.5, true, false);
    if (!shouldCreate.shouldPlay) {
      logger.warn({ reason: shouldCreate.reason }, 'Cannot create game');
      return null;
    }

    // Generate random hole cards for commitment
    const holeCards = this.generateRandomHoleCards();

    logger.info({ wager: wagerAmount.toString() }, 'Creating new game');

    this.bankroll.reserveForMatch(wagerAmount);

    const result = await this.contract.createGame(wagerAmount, holeCards);

    this.activeGames.set(result.gameId, {
      gameId: result.gameId,
      holeCards,
      salt: result.salt,
      opponentAddress: '',
      wagerAmount,
      isCreator: true,
    });

    logger.info({ gameId: result.gameId }, 'Game created');
    return result.gameId;
  }

  /**
   * Join an existing game
   */
  private async joinGame(gameId: `0x${string}`, wagerAmount: bigint): Promise<void> {
    // Generate random hole cards
    const holeCards = this.generateRandomHoleCards();

    logger.info({ gameId, wager: wagerAmount.toString() }, 'Joining game');

    this.bankroll.reserveForMatch(wagerAmount);

    const result = await this.contract.joinGame(gameId, wagerAmount, holeCards);

    // Get opponent address
    const gameState = await this.contract.getGame(gameId);

    this.activeGames.set(gameId, {
      gameId,
      holeCards,
      salt: result.salt,
      opponentAddress: gameState.players[0].wallet,
      wagerAmount,
      isCreator: false,
    });

    logger.info({ gameId }, 'Joined game');
  }

  /**
   * Take an action in the game
   */
  private async takeAction(activeGame: ActiveGame, gameState: any): Promise<void> {
    const myIndex = this.getMyPlayerIndex(gameState);

    // Build strategy context
    const holeCards: HoleCards = [
      indexToCard(activeGame.holeCards[0]),
      indexToCard(activeGame.holeCards[1]),
    ];

    const communityCards: Card[] = [];
    for (let i = 0; i < gameState.communityCardCount; i++) {
      communityCards.push(indexToCard(gameState.communityCards[i]));
    }

    const myPlayer = gameState.players[myIndex];

    // Calculate total opponent chips (sum of all other active players)
    let totalOpponentChips = 0n;
    for (let i = 0; i < gameState.playerCount; i++) {
      if (i !== myIndex && !gameState.players[i].folded) {
        totalOpponentChips += BigInt(gameState.players[i].chips);
      }
    }

    const toCall: bigint = gameState.currentBet > myPlayer.currentBet
      ? BigInt(gameState.currentBet) - BigInt(myPlayer.currentBet)
      : 0n;

    // Determine position for strategy
    // In multi-player: button is best, big blind is worst, others are middle
    let position: 'button' | 'big_blind';
    if (gameState.dealerIndex === myIndex) {
      position = 'button';
    } else {
      position = 'big_blind'; // Simplify to worst position for conservative play
    }

    const context = {
      gameId: activeGame.gameId,
      holeCards,
      communityCards,
      phase: PHASE_MAP[gameState.phase],
      position,
      potSize: gameState.mainPot, // Contract uses mainPot, not pot
      currentBet: gameState.currentBet,
      myChips: myPlayer.chips,
      opponentChips: totalOpponentChips, // Total chips of all opponents
      toCall,
    };

    // Get decision from strategy engine
    const decision = await this.strategy.decide(context);

    logger.info(
      {
        gameId: activeGame.gameId,
        action: decision.action,
        amount: decision.amount?.toString(),
        reasoning: decision.reasoning,
      },
      'Taking action'
    );

    // Send thought to coordinator for frontend display
    const potOdds = toCall > 0n ? Number(toCall) / (Number(gameState.mainPot) + Number(toCall)) : 0;

    // Calculate equity for display (postflop only)
    let equity: number | undefined;
    if (communityCards.length > 0) {
      equity = this.strategy.getEquityCalculator().calculateEquity(
        holeCards,
        communityCards,
        200 // Quick simulation for display
      );
    }

    // Format cards for personality thought
    const holeCardsStr = holeCards.map(c => cardToString(c)).join(' ');
    const communityCardsStr = communityCards.length > 0
      ? communityCards.map(c => cardToString(c)).join(' ')
      : undefined;

    // Calculate thinking delay first so we can notify frontend of turn duration
    const thinkingDelay = this.calculateThinkingDelay(decision);

    // Notify coordinator that our turn has started (for frontend timer display)
    this.sendTurnStartToCoordinator(activeGame.gameId, thinkingDelay);

    // Send thought BEFORE action for spectator experience
    // This gives viewers time to see the thought before the action happens
    await this.sendThoughtToCoordinator(
      activeGame.gameId,
      {
        action: decision.action,
        amount: decision.amount,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
      },
      {
        equity,
        potOdds,
        holeCards: holeCardsStr,
        communityCards: communityCardsStr,
        phase: context.phase,
      }
    );

    // Spectator delay - give viewers time to read the thought
    logger.debug({ thinkingDelay, action: decision.action }, 'Applying spectator delay');
    await this.sleep(thinkingDelay);

    // Execute the action
    await this.contract.takeAction(
      activeGame.gameId,
      decision.action,
      decision.amount || 0n
    );

    // Small delay after action for spectators to see the result
    await this.sleep(1000);
  }

  /**
   * Calculate thinking delay based on decision complexity
   * More complex decisions = longer thinking time (for spectator experience)
   */
  private calculateThinkingDelay(decision: { action: string; amount?: bigint; confidence?: number }): number {
    const baseDelay = 5000; // 5 seconds minimum for spectator experience

    // Lower confidence = more "thinking"
    const confidenceModifier = decision.confidence
      ? Math.max(0, (1 - decision.confidence) * 3000) // Up to 3 extra seconds for low confidence
      : 1000;

    // All-in and raise decisions take longer
    let actionModifier = 0;
    if (decision.action === 'all-in') {
      actionModifier = 2000; // Big decision
    } else if (decision.action === 'raise') {
      actionModifier = 1500;
    } else if (decision.action === 'call') {
      actionModifier = 1000;
    }

    // Add some randomness (500-1500ms) to feel more natural
    const randomModifier = 500 + Math.random() * 1000;

    const totalDelay = baseDelay + confidenceModifier + actionModifier + randomModifier;

    // Cap at 8 seconds for spectator-friendly pace
    return Math.min(totalDelay, 8000);
  }

  /**
   * Reveal cards at showdown
   */
  private async revealCards(activeGame: ActiveGame): Promise<void> {
    logger.info({ gameId: activeGame.gameId }, 'Revealing cards');

    await this.contract.revealCards(
      activeGame.gameId,
      activeGame.holeCards,
      activeGame.salt
    );
  }

  /**
   * Handle phase transitions for spectator experience
   * Notifies coordinator and adds pauses between phases
   */
  private async handlePhaseChange(gameId: string, oldPhase: string, newPhase: string): Promise<void> {
    logger.info({ gameId, oldPhase, newPhase }, 'Phase changed');

    // Determine pause duration based on phase
    let pauseDurationMs = 0;
    if (newPhase === 'flop' || newPhase === 'turn' || newPhase === 'river') {
      pauseDurationMs = 3000; // 3 seconds to see community cards
    } else if (newPhase === 'showdown') {
      pauseDurationMs = 5000; // 5 seconds to see final hands
    }

    // Notify coordinator of phase change
    if (this.coordinatorWs && this.coordinatorWs.readyState === WebSocket.OPEN) {
      this.coordinatorWs.send(
        JSON.stringify({
          type: 'phase_changed',
          gameId,
          phase: newPhase,
          previousPhase: oldPhase,
          pauseDurationMs,
          timestamp: Date.now(),
        })
      );
    }

    // Apply spectator pause
    if (pauseDurationMs > 0) {
      logger.debug({ gameId, phase: newPhase, pauseDurationMs }, 'Applying phase pause for spectators');
      await this.sleep(pauseDurationMs);
    }
  }

  /**
   * Handle game completion
   */
  private async handleGameComplete(gameId: string, gameState: any): Promise<void> {
    const activeGame = this.activeGames.get(gameId);
    if (!activeGame) return;

    const myIndex = this.getMyPlayerIndex(gameState);

    // Determine winner - find the non-folded player with chips, or use revealed cards
    let winner: string | null = null;
    let nonFoldedCount = 0;
    let lastNonFolded: string | null = null;

    for (let i = 0; i < gameState.playerCount; i++) {
      const player = gameState.players[i];
      if (!player.folded) {
        nonFoldedCount++;
        lastNonFolded = player.wallet;
      }
    }

    // If only one player didn't fold, they win
    if (nonFoldedCount === 1) {
      winner = lastNonFolded;
    }
    // Otherwise need showdown result (check who has chips left)

    const won = winner?.toLowerCase() === this.wallet.address.toLowerCase();

    this.bankroll.recordResult(activeGame.wagerAmount, won, gameState.mainPot);

    logger.info(
      {
        gameId,
        won,
        pot: gameState.mainPot.toString(),
      },
      'Game complete'
    );

    // Send win/loss reaction with personality
    try {
      const reaction = won
        ? await this.personality.generateWinReaction()
        : await this.personality.generateLossReaction();

      if (this.coordinatorWs && this.coordinatorWs.readyState === WebSocket.OPEN) {
        this.coordinatorWs.send(
          JSON.stringify({
            type: 'agent_thought',
            gameId,
            agentAddress: this.wallet.address,
            agentName: this.personality.getPersonality().name,
            action: won ? 'win' : 'loss',
            reasoning: reaction,
            confidence: 1.0,
          })
        );
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to send game result reaction');
    }

    // Record opponent showdown data if available (for all opponents who revealed)
    for (let i = 0; i < gameState.playerCount; i++) {
      if (i !== myIndex && gameState.players[i]?.revealed) {
        const communityCardsArray: number[] = Array.from(gameState.communityCards as number[]).slice(0, gameState.communityCardCount);
        this.opponentModel.recordShowdown(
          gameState.players[i].wallet,
          gameState.players[i].holeCards,
          communityCardsArray,
          won ? 'loss' : 'win',
          []
        );
      }
    }

    // Send winner celebration for spectator experience
    if (winner && this.coordinatorWs && this.coordinatorWs.readyState === WebSocket.OPEN) {
      const winnerName = winner.toLowerCase() === this.wallet.address.toLowerCase()
        ? this.personality.getPersonality().name
        : 'Opponent';

      this.coordinatorWs.send(
        JSON.stringify({
          type: 'winner_celebration',
          gameId,
          winnerAddress: winner,
          winnerName,
          pot: gameState.mainPot.toString(),
          celebrationDurationMs: 5000,
          timestamp: Date.now(),
        })
      );

      // Wait for celebration to display
      logger.debug({ gameId, winner: winnerName }, 'Winner celebration pause for spectators');
      await this.sleep(5000);
    }

    this.activeGames.delete(gameId);

    // Update balance
    const newBalance = await this.wallet.getBalance();
    this.bankroll.updateBalance(newBalance);

    // Fixed entry fee for requeue
    const FIXED_ENTRY_FEE = 10000000000000000n; // 0.01 MON

    // Notify coordinator that game is finished and requeue
    if (this.coordinatorWs && this.coordinatorWs.readyState === WebSocket.OPEN) {
      this.coordinatorWs.send(
        JSON.stringify({
          type: 'game_finished',
          gameId,
          address: this.wallet.address,
          won,
          balance: newBalance.toString(),
          maxWager: FIXED_ENTRY_FEE.toString(), // Always use fixed entry fee
          autoRequeue: this.activeGames.size === 0, // Only requeue if no other active games
        })
      );

      logger.info({ won, newBalance: newBalance.toString(), remainingGames: this.activeGames.size }, 'Notified coordinator of game completion');
    }

    // Only signal ready for next game if we have no other active games
    if (this.activeGames.size === 0) {
      this.isQueuedForMatch = false;
      gameOperationLock = false; // Ensure lock is released
      setTimeout(() => this.signalReadyToPlay(), 15000); // 15 second delay between games to conserve tokens
    }
  }

  /**
   * Get my player index in game (supports up to 4 players)
   */
  private getMyPlayerIndex(gameState: any): number {
    const myAddress = this.wallet.address.toLowerCase();
    for (let i = 0; i < gameState.players.length; i++) {
      if (gameState.players[i].wallet.toLowerCase() === myAddress) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Generate random hole cards
   */
  private generateRandomHoleCards(): [number, number] {
    const card1 = Math.floor(Math.random() * 52);
    let card2 = Math.floor(Math.random() * 52);
    while (card2 === card1) {
      card2 = Math.floor(Math.random() * 52);
    }
    return [card1, card2];
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get agent stats
   */
  getStats() {
    return {
      address: this.wallet.address,
      bankroll: this.bankroll.getState(),
      session: this.bankroll.getSessionStats(),
      activeGames: this.activeGames.size,
      trackedOpponents: this.opponentModel.getTrackedOpponents().length,
    };
  }
}
