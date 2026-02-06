import { useReadContract, useWriteContract, useWatchContractEvent } from 'wagmi';
import { parseEther, keccak256, encodePacked } from 'viem';
import { POKER_GAME_4MAX_ABI, POKER_GAME_4MAX_ADDRESS, ACTION_TYPES } from '../config/contracts';

// Use 4Max contract for all operations (2-4 players)
const POKER_GAME_ABI = POKER_GAME_4MAX_ABI;
const POKER_GAME_ADDRESS = POKER_GAME_4MAX_ADDRESS;

// Types
export interface Player {
  wallet: `0x${string}`;
  chips: bigint;
  cardCommitment: `0x${string}`;
  holeCards: [number, number];
  folded: boolean;
  revealed: boolean;
  currentBet: bigint;
}

export interface GameState {
  gameId: `0x${string}`;
  players: [Player, Player];
  pot: bigint;
  currentBet: bigint;
  dealerIndex: number;
  phase: number;
  communityCards: [number, number, number, number, number];
  communityCardCount: number;
  lastActionTime: bigint;
  timeoutDuration: bigint;
  activePlayerIndex: number;
  isActive: boolean;
}

// Generate random salt for card commitment
export function generateSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}

// Create card commitment
export function createCommitment(card1: number, card2: number, salt: `0x${string}`): `0x${string}` {
  return keccak256(encodePacked(['uint8', 'uint8', 'bytes32'], [card1, card2, salt]));
}

// Hook to get active games
export function useActiveGames() {
  return useReadContract({
    address: POKER_GAME_ADDRESS,
    abi: POKER_GAME_ABI,
    functionName: 'getActiveGames',
    query: {
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });
}

// Hook to get game state
export function useGameState(gameId: `0x${string}` | undefined) {
  return useReadContract({
    address: POKER_GAME_ADDRESS,
    abi: POKER_GAME_ABI,
    functionName: 'getGame',
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: !!gameId,
      refetchInterval: 2000, // Refetch every 2 seconds
    },
  });
}

// Hook for contract write operations
export function usePokerActions() {
  const { writeContractAsync, isPending, isSuccess, isError, error } = useWriteContract();

  const createGame = async (wagerEth: string, cards: [number, number]) => {
    const salt = generateSalt();
    const commitment = createCommitment(cards[0], cards[1], salt);

    const hash = await writeContractAsync({
      address: POKER_GAME_ADDRESS,
      abi: POKER_GAME_ABI,
      functionName: 'createGame',
      args: [commitment],
      value: parseEther(wagerEth),
    });

    return { hash, salt, commitment };
  };

  const joinGame = async (gameId: `0x${string}`, wagerEth: string, cards: [number, number]) => {
    const salt = generateSalt();
    const commitment = createCommitment(cards[0], cards[1], salt);

    const hash = await writeContractAsync({
      address: POKER_GAME_ADDRESS,
      abi: POKER_GAME_ABI,
      functionName: 'joinGame',
      args: [gameId, commitment],
      value: parseEther(wagerEth),
    });

    return { hash, salt, commitment };
  };

  const takeAction = async (
    gameId: `0x${string}`,
    action: keyof typeof ACTION_TYPES,
    raiseAmount: bigint = 0n
  ) => {
    return writeContractAsync({
      address: POKER_GAME_ADDRESS,
      abi: POKER_GAME_ABI,
      functionName: 'takeAction',
      args: [gameId, ACTION_TYPES[action], raiseAmount],
    });
  };

  const revealCards = async (
    gameId: `0x${string}`,
    cards: [number, number],
    salt: `0x${string}`
  ) => {
    return writeContractAsync({
      address: POKER_GAME_ADDRESS,
      abi: POKER_GAME_ABI,
      functionName: 'revealCards',
      args: [gameId, cards, salt],
    });
  };

  const claimTimeout = async (gameId: `0x${string}`) => {
    return writeContractAsync({
      address: POKER_GAME_ADDRESS,
      abi: POKER_GAME_ABI,
      functionName: 'claimTimeout',
      args: [gameId],
    });
  };

  return {
    createGame,
    joinGame,
    takeAction,
    revealCards,
    claimTimeout,
    isPending,
    isSuccess,
    isError,
    error,
  };
}

// Hook to watch game events
export function useGameEvents(
  gameId: `0x${string}` | undefined,
  callbacks: {
    onAction?: (player: `0x${string}`, action: number, amount: bigint) => void;
    onPhaseChange?: (newPhase: number) => void;
    onGameEnd?: (winner: `0x${string}`, pot: bigint) => void;
  }
) {
  useWatchContractEvent({
    address: POKER_GAME_ADDRESS,
    abi: POKER_GAME_ABI,
    eventName: 'ActionTaken',
    args: gameId ? { gameId } : undefined,
    enabled: !!gameId && !!callbacks.onAction,
    onLogs: (logs) => {
      logs.forEach((log) => {
        const args = log.args as { player: `0x${string}`; action: number; amount: bigint };
        callbacks.onAction?.(args.player, args.action, args.amount);
      });
    },
  });

  useWatchContractEvent({
    address: POKER_GAME_ADDRESS,
    abi: POKER_GAME_ABI,
    eventName: 'PhaseChanged',
    args: gameId ? { gameId } : undefined,
    enabled: !!gameId && !!callbacks.onPhaseChange,
    onLogs: (logs) => {
      logs.forEach((log) => {
        const args = log.args as { newPhase: number };
        callbacks.onPhaseChange?.(args.newPhase);
      });
    },
  });

  useWatchContractEvent({
    address: POKER_GAME_ADDRESS,
    abi: POKER_GAME_ABI,
    eventName: 'GameEnded',
    args: gameId ? { gameId } : undefined,
    enabled: !!gameId && !!callbacks.onGameEnd,
    onLogs: (logs) => {
      logs.forEach((log) => {
        const args = log.args as { winner: `0x${string}`; pot: bigint };
        callbacks.onGameEnd?.(args.winner, args.pot);
      });
    },
  });
}
