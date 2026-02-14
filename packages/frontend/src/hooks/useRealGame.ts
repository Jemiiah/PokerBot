import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useGameStore } from "../stores/gameStore";
import { useGameState, useGameEvents } from "./usePokerContract";
import { realGameService } from "../services/realGameService";
import { type AgentId } from "../lib/constants";

// Wallet address to Agent ID mapping
// These should match the addresses in the agent .env files
const WALLET_TO_AGENT: Record<string, AgentId> = {
  // All 8 agents
  "0x1dbe9020C99F62A1d9D0a6Fd60f5A6e396a97603": "blaze",
  "0x717c5A190AEC2c9beb855Cba7a15d266e3b1Ab25": "frost",
  "0xb213F4E9eb291fBbD0B0C2d9735b012E3569aE60": "shadow",
  "0xD91ac4F452A5e059dCCf03F35A0966D4dC81dCD4": "storm",
  "0x2388d2DDDF59aFFe840756dCd2515ef23f7D29E7": "sage",
  "0x98C0D1D88Da8C6f118afB276514995fECC0F9E1d": "ember",
  "0xb0ac45e121ecc9cd261ddd4aa1ebf8881de2a479": "viper",
  "0xBDD02f353914aefD7b9094692B34bB2d45E1CD67": "titan",
};

// Helper to get agent ID from wallet address (case-insensitive)
function getAgentFromWallet(wallet: string): AgentId | null {
  const normalized = wallet.toLowerCase();
  for (const [addr, agentId] of Object.entries(WALLET_TO_AGENT)) {
    if (addr.toLowerCase() === normalized) {
      return agentId;
    }
  }
  return null;
}

// Type for the contract state returned by wagmi (readonly)
type ContractStateData = ReturnType<typeof useGameState>["data"];

export interface UseRealGameResult {
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  contractState: ContractStateData;
  activePlayers: AgentId[];
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

  // Connect to coordinator WebSocket only when we have a gameId
  useEffect(() => {
    // Don't connect if no game selected
    if (!gameId) {
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

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
      } catch {
        // Coordinator not available - this is OK, contract data will still work
        if (mounted) {
          setIsConnected(false);
          setIsLoading(false);
          // Don't set error - coordinator is optional for viewing games
        }
      }
    };

    connectToCoordinator();

    return () => {
      mounted = false;
    };
  }, [gameId]);

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
        setError(err instanceof Error ? err.message : "Failed to watch game");
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

    // Cast to any since realGameService handles both 2-player and 4-player contract formats
    realGameService.syncContractState(gameId, contractState as any, playersRef.current);
  }, [gameId, contractState]);

  // Watch contract events
  const handleAction = useCallback(
    (player: `0x${string}`, action: number, amount: bigint) => {
      realGameService.handleContractAction(player, action, amount);
    },
    [],
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

  // Compute active players from contract state
  const activePlayers = useMemo<AgentId[]>(() => {
    if (!contractState || !contractState.players) return [];

    const players: AgentId[] = [];
    const zeroAddress = "0x0000000000000000000000000000000000000000";

    for (const player of contractState.players) {
      if (player.wallet && player.wallet !== zeroAddress) {
        const agentId = getAgentFromWallet(player.wallet);
        if (agentId) {
          players.push(agentId);
        }
      }
    }

    return players;
  }, [contractState]);

  return {
    isLoading: isLoading || isContractLoading,
    isConnected,
    error: error || (contractError ? contractError.message : null),
    contractState,
    activePlayers,
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

/**
 * Queued agent info for display
 */
export interface QueuedAgent {
  address: string;
  name: string;
  balance?: string;
}

/**
 * Simplified hook for live mode - auto-connects and discovers active game
 * Shows the 4 live agents (Shadow, Storm, Sage, Ember) playing poker
 */
export interface UseLiveGameResult {
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  currentGameId: string | null;
  activePlayers: AgentId[];
  phase: number | undefined;
  queuedAgents: QueuedAgent[];
  isMatchmaking: boolean;
  connectedAgentNames: string[];
}

export function useLiveGame(active: boolean): UseLiveGameResult {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [activePlayers, setActivePlayers] = useState<AgentId[]>([]);
  const [queuedAgents, setQueuedAgents] = useState<QueuedAgent[]>([]);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [connectedAgentNames, setConnectedAgentNames] = useState<string[]>([]);

  const store = useGameStore();
  const playersRef = useRef<Map<string, AgentId>>(new Map());

  // Get game state from contract when we have a gameId
  const { data: contractState, isLoading: isContractLoading } = useGameState(
    active && currentGameId ? (currentGameId as `0x${string}`) : undefined,
  );

  // Sync contract state to store when it changes
  useEffect(() => {
    if (!currentGameId || !contractState) return;

    // Sync to game store
    realGameService.syncContractState(
      currentGameId,
      contractState as any,
      playersRef.current,
    );

    // Update active players from contract state
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    const players: AgentId[] = [];
    for (const player of contractState.players) {
      if (player.wallet && player.wallet !== zeroAddress) {
        const agentId = getAgentFromWallet(player.wallet);
        if (agentId) {
          players.push(agentId);
          playersRef.current.set(player.wallet.toLowerCase(), agentId);
        }
      }
    }
    if (players.length > 0) {
      setActivePlayers(players);
    }
  }, [currentGameId, contractState]);

  // Watch contract events
  const handleAction = useCallback(
    (player: `0x${string}`, action: number, amount: bigint) => {
      realGameService.handleContractAction(player, action, amount);
    },
    [],
  );

  const handlePhaseChange = useCallback((newPhase: number) => {
    realGameService.handlePhaseChange(newPhase);
  }, []);

  const handleGameEnd = useCallback((winner: `0x${string}`, pot: bigint) => {
    realGameService.handleGameEnd(winner, pot);
    // Clear game after a delay to show final state
    setTimeout(() => setCurrentGameId(null), 5000);
  }, []);

  useGameEvents(active && currentGameId ? (currentGameId as `0x${string}`) : undefined, {
    onAction: handleAction,
    onPhaseChange: handlePhaseChange,
    onGameEnd: handleGameEnd,
  });

  // Get phase from contract state
  const phase = contractState?.phase;

  // Connect to coordinator when active
  useEffect(() => {
    if (!active) {
      realGameService.disconnect();
      setIsConnected(false);
      setCurrentGameId(null);
      return;
    }

    let mounted = true;

    const connect = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await realGameService.connect();
        if (mounted) {
          setIsConnected(true);
          setIsLoading(false);
          // Start game - mode is already set by HomePage.handleModeChange
          // Only start if we're in live mode (mode should already be set)
          if (store.mode === "live") {
            store.startGame();
          }
        }
      } catch (err) {
        if (mounted) {
          setIsConnected(false);
          setIsLoading(false);
          setError("Coordinator not available. Start the agents to play live.");
        }
      }
    };

    connect();

    return () => {
      mounted = false;
    };
  }, [active]);

  // Listen for coordinator messages to discover games and players
  useEffect(() => {
    if (!active || !isConnected) return;

    const unsubscribe = realGameService.onMessage((message) => {
      switch (message.type) {
        case "game_started":
        case "game_created":
        case "match_created":
          setCurrentGameId(message.gameId);
          // Watch this game
          realGameService.watchGame(message.gameId);
          // Update active players from full player list (if available)
          if ("playerNames" in message && Array.isArray(message.playerNames)) {
            const players = message.playerNames
              .map((name: string) => name.toLowerCase() as AgentId)
              .filter((id: AgentId) =>
                [
                  "shadow",
                  "storm",
                  "sage",
                  "blaze",
                  "ember",
                  "frost",
                  "viper",
                  "titan",
                ].includes(id),
              );
            if (players.length > 0) {
              setActivePlayers(players);
              // Also update the store's activePlayers
              store.setActivePlayers(players);
            }
          } else if ("creatorName" in message && message.creatorName) {
            // Fallback to creator only
            const creatorId = message.creatorName.toLowerCase() as AgentId;
            if (
              [
                "shadow",
                "storm",
                "sage",
                "ember",
                "blaze",
                "frost",
                "viper",
                "titan",
              ].includes(creatorId)
            ) {
              setActivePlayers((prev) => {
                if (!prev.includes(creatorId)) {
                  return [creatorId, ...prev.filter((id) => id !== creatorId)];
                }
                return prev;
              });
            }
          }
          break;

        case "subscribed":
          if (message.gameId) {
            setCurrentGameId(message.gameId);
          }
          // Update active players from match data
          if ("match" in message && message.match && message.match.playerNames) {
            const players = message.match.playerNames
              .map((name: string) => name.toLowerCase() as AgentId)
              .filter((id: AgentId) =>
                [
                  "shadow",
                  "storm",
                  "sage",
                  "blaze",
                  "ember",
                  "frost",
                  "viper",
                  "titan",
                ].includes(id),
              );
            if (players.length > 0) {
              setActivePlayers(players);
            }
          }
          break;

        case "player_joined":
          // Update active players based on who joined
          if ("playerNames" in message && message.playerNames) {
            const players = message.playerNames
              .map((name: string) => name.toLowerCase() as AgentId)
              .filter((id: AgentId) =>
                [
                  "shadow",
                  "storm",
                  "sage",
                  "blaze",
                  "ember",
                  "frost",
                  "viper",
                  "titan",
                ].includes(id),
              );
            if (players.length > 0) {
              setActivePlayers(players);
            }
          }
          break;

        case "agent_thought":
          // Update phase from thought context if available
          break;

        case "game_ended":
          // Keep state visible briefly for celebration, then clear
          setTimeout(() => {
            useGameStore.getState().resetGame();
          }, 5000);
          setCurrentGameId(null);
          setActivePlayers([]);
          setIsMatchmaking(false);
          break;

        // --- Connected agent tracking ---
        case "agent_connected":
          if ("name" in message && message.name) {
            setConnectedAgentNames((prev) =>
              prev.includes(message.name) ? prev : [...prev, message.name],
            );
          }
          break;

        case "agent_disconnected":
          if ("name" in message && message.name) {
            setConnectedAgentNames((prev) => prev.filter((n) => n !== message.name));
          }
          break;

        // --- Queue tracking (also updates connected agents) ---
        case "queue_state":
        case "agent_queued":
        case "agent_dequeued":
          // Update queued agents from coordinator
          if ("queuedAgents" in message && Array.isArray(message.queuedAgents)) {
            setQueuedAgents(
              message.queuedAgents.map((a: any) => ({
                address: a.address || "",
                name: a.name || "Unknown",
                balance: a.balance,
              })),
            );
            // Agents in the queue are connected — merge into connected list
            setConnectedAgentNames((prev) => {
              const names = new Set(prev);
              message.queuedAgents.forEach((a: any) => {
                if (a.name) names.add(a.name);
              });
              return Array.from(names);
            });
          }
          if ("queueSize" in message) {
            setIsMatchmaking((message.queueSize as number) >= 2);
          }
          break;

        case "matchmaking_started":
          // Match is being created
          if ("isMatchmaking" in message) {
            setIsMatchmaking(true);
          }
          if ("players" in message && Array.isArray(message.players)) {
            // Clear queue when match starts
            setQueuedAgents([]);
          }
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [active, isConnected]);

  // Poll connection status
  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      setIsConnected(realGameService.isConnected());
    }, 2000);

    return () => clearInterval(interval);
  }, [active]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (active) {
        realGameService.disconnect();
      }
    };
  }, []);

  return {
    isLoading: isLoading || isContractLoading,
    isConnected,
    error,
    currentGameId,
    activePlayers,
    phase,
    queuedAgents,
    isMatchmaking,
    connectedAgentNames,
  };
}
