import { useEffect, useState, useCallback, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useGameState, useGameEvents } from './usePokerContract';
import { realGameService } from '../services/realGameService';
import type { AgentId } from '../lib/constants';

// Type for the contract state returned by wagmi (readonly)
type ContractStateData = ReturnType<typeof useGameState>['data'];

export interface UseRealGameResult {
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  contractState: ContractStateData;
}

/**
 * Hook to connect frontend to real blockchain game with agent thoughts
 *
 * @param gameId - The game ID to watch, or null to disconnect
 */
export function useRealGame(gameId: string | null): UseRealGameResult {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track players in this game
  const playersRef = useRef<Map<string, AgentId>>(new Map());

  // Get game state from contract
  const {
    data: contractState,
    isLoading: isContractLoading,
    error: contractError,
  } = useGameState(gameId as `0x${string}` | undefined);

  // Store actions
  const store = useGameStore();

  // Connect to coordinator WebSocket on mount
  useEffect(() => {
    let mounted = true;

    const connectToCoordinator = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await realGameService.connect();
        if (mounted) {
          setIsConnected(true);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to connect to coordinator');
          setIsConnected(false);
          setIsLoading(false);
        }
      }
    };

    connectToCoordinator();

    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to game when gameId changes
  useEffect(() => {
    if (!gameId) {
      realGameService.unwatchGame();
      return;
    }

    const watchGame = async () => {
      try {
        await realGameService.watchGame(gameId);
        // Reset game state for new game
        store.resetGame();
        store.startGame();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to watch game');
      }
    };

    watchGame();

    return () => {
      realGameService.unwatchGame();
    };
  }, [gameId]);

  // Sync contract state to store when it changes
  useEffect(() => {
    if (!gameId || !contractState) return;

    realGameService.syncContractState(gameId, contractState, playersRef.current);
  }, [gameId, contractState]);

  // Watch contract events
  const handleAction = useCallback(
    (player: `0x${string}`, action: number, amount: bigint) => {
      realGameService.handleContractAction(player, action, amount);
    },
    []
  );

  const handlePhaseChange = useCallback((newPhase: number) => {
    realGameService.handlePhaseChange(newPhase);
  }, []);

  const handleGameEnd = useCallback((winner: `0x${string}`, pot: bigint) => {
    realGameService.handleGameEnd(winner, pot);
  }, []);

  // Watch for contract events
  useGameEvents(gameId as `0x${string}` | undefined, {
    onAction: handleAction,
    onPhaseChange: handlePhaseChange,
    onGameEnd: handleGameEnd,
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      realGameService.disconnect();
    };
  }, []);

  return {
    isLoading: isLoading || isContractLoading,
    isConnected,
    error: error || (contractError ? contractError.message : null),
    contractState,
  };
}

/**
 * Hook to check if connected to coordinator
 */
export function useCoordinatorStatus() {
  const [isConnected, setIsConnected] = useState(realGameService.isConnected());

  useEffect(() => {
    // Poll connection status
    const interval = setInterval(() => {
      setIsConnected(realGameService.isConnected());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return { isConnected };
}
