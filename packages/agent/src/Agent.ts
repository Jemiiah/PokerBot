import type { Card, HoleCards } from '@poker/shared';
import { indexToCard } from '@poker/shared';
import { WalletManager, ContractClient } from './blockchain/index.js';
import { StrategyEngine } from './strategy/index.js';
import { OpponentModel } from './opponent/index.js';
import { BankrollManager } from './bankroll/index.js';
import { config, createChildLogger } from './utils/index.js';

const logger = createChildLogger('Agent');

interface ActiveGame {
  gameId: `0x${string}`;
  holeCards: [number, number];
  salt: `0x${string}`;
  opponentAddress: string;
  wagerAmount: bigint;
  isCreator: boolean;
}

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

  private activeGames: Map<string, ActiveGame> = new Map();
  private isRunning: boolean = false;

  constructor() {
    logger.info({ name: config.agentName }, 'Initializing poker agent');

    this.wallet = new WalletManager();
    this.contract = new ContractClient(this.wallet);
    this.strategy = new StrategyEngine();
    this.opponentModel = new OpponentModel();
    this.bankroll = new BankrollManager(0n); // Will be updated on start
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    logger.info('Starting poker agent');

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

    // Start the main loop
    await this.mainLoop();
  }

  /**
   * Stop the agent
   */
  stop(): void {
    logger.info('Stopping poker agent');
    this.isRunning = false;

    // Log summary
    logger.info(this.bankroll.getSummary());
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

        // Small delay between iterations
        await this.sleep(2000);
      } catch (error) {
        logger.error({ error }, 'Error in main loop');
        await this.sleep(5000);
      }
    }
  }

  /**
   * Check active games for required actions
   */
  private async checkActiveGames(): Promise<void> {
    for (const [gameId, activeGame] of this.activeGames) {
      try {
        const gameState = await this.contract.getGame(gameId as `0x${string}`);

        const phase = PHASE_MAP[gameState.phase];

        // Game is complete
        if (phase === 'complete') {
          await this.handleGameComplete(gameId, gameState);
          continue;
        }

        // Check if it's our turn
        const myIndex = this.getMyPlayerIndex(gameState);
        if (myIndex === -1) continue;

        const isMyTurn = gameState.activePlayerIndex === myIndex;

        if (phase === 'showdown') {
          // Reveal cards at showdown
          if (!gameState.players[myIndex].revealed) {
            await this.revealCards(activeGame);
          }
        } else if (isMyTurn && phase !== 'waiting') {
          // Take action
          await this.takeAction(activeGame, gameState);
        }
      } catch (error) {
        logger.error({ gameId, error }, 'Error checking game');
      }
    }
  }

  /**
   * Look for games to join
   */
  private async lookForGames(): Promise<void> {
    // Only look if we don't have too many active games
    if (this.activeGames.size >= 3) return;

    try {
      const activeGames = await this.contract.getActiveGames();

      for (const gameId of activeGames) {
        // Skip if already in this game
        if (this.activeGames.has(gameId)) continue;

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

        // Check if we should join
        const wagerAmount = gameState.players[0].chips;
        const shouldJoin = this.bankroll.shouldPlayMatch(wagerAmount, 0.5, true);

        if (shouldJoin.shouldPlay) {
          await this.joinGame(gameId, wagerAmount);
          break; // Join one game at a time
        } else {
          logger.debug({ gameId, reason: shouldJoin.reason }, 'Skipping game');
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error looking for games');
    }
  }

  /**
   * Create a new game
   */
  async createGame(wagerAmount: bigint): Promise<string | null> {
    const shouldCreate = this.bankroll.shouldPlayMatch(wagerAmount, 0.5, true);
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
    const oppIndex = 1 - myIndex;

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
    const oppPlayer = gameState.players[oppIndex];

    const toCall: bigint = gameState.currentBet > myPlayer.currentBet
      ? BigInt(gameState.currentBet) - BigInt(myPlayer.currentBet)
      : 0n;

    const context = {
      gameId: activeGame.gameId,
      holeCards,
      communityCards,
      phase: PHASE_MAP[gameState.phase],
      position: gameState.dealerIndex === myIndex ? 'button' as const : 'big_blind' as const,
      potSize: gameState.pot,
      currentBet: gameState.currentBet,
      myChips: myPlayer.chips,
      opponentChips: oppPlayer.chips,
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

    // Record opponent's last action for modeling
    // (In a real implementation, we'd track this from events)

    // Execute the action
    await this.contract.takeAction(
      activeGame.gameId,
      decision.action,
      decision.amount || 0n
    );
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
   * Handle game completion
   */
  private async handleGameComplete(gameId: string, gameState: any): Promise<void> {
    const activeGame = this.activeGames.get(gameId);
    if (!activeGame) return;

    const myIndex = this.getMyPlayerIndex(gameState);

    // Determine winner from remaining chips or fold status
    const winner = gameState.players[0].folded
      ? gameState.players[1].wallet
      : gameState.players[1].folded
        ? gameState.players[0].wallet
        : null; // Need showdown result

    const won = winner?.toLowerCase() === this.wallet.address.toLowerCase();

    this.bankroll.recordResult(activeGame.wagerAmount, won, gameState.pot);

    logger.info(
      {
        gameId,
        won,
        pot: gameState.pot.toString(),
      },
      'Game complete'
    );

    // Record opponent showdown data if available
    const oppIndex = 1 - myIndex;
    if (gameState.players[oppIndex].revealed) {
      const communityCardsArray: number[] = Array.from(gameState.communityCards as number[]).slice(0, gameState.communityCardCount);
      this.opponentModel.recordShowdown(
        activeGame.opponentAddress,
        gameState.players[oppIndex].holeCards,
        communityCardsArray,
        won ? 'loss' : 'win',
        []
      );
    }

    this.activeGames.delete(gameId);

    // Update balance
    const newBalance = await this.wallet.getBalance();
    this.bankroll.updateBalance(newBalance);
  }

  /**
   * Get my player index in game
   */
  private getMyPlayerIndex(gameState: any): number {
    if (gameState.players[0].wallet.toLowerCase() === this.wallet.address.toLowerCase()) {
      return 0;
    }
    if (gameState.players[1].wallet.toLowerCase() === this.wallet.address.toLowerCase()) {
      return 1;
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
