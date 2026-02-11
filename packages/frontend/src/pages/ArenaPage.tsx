import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { PokerTable } from "../components/PokerTable";
import { ArenaHeader, ArenaLeaderboard, ArenaGameFeed } from "../components/arena";
import { ArenaAgentSelect } from "../components/arena/ArenaAgentSelect";
import { HowToPlayModal } from "../components/arena/HowToPlayModal";
import { useLiveGame } from "../hooks/useRealGame";
import { useGameStore } from "../stores/gameStore";
import { WalletConnect } from "../components/WalletConnect";
import { monadTestnet } from "../config/chains";
import type { LiveAgentId } from "../lib/constants";

const COORDINATOR_API_URL =
  import.meta.env.VITE_COORDINATOR_API_URL || "http://localhost:8080";

export function ArenaPage() {
  const [isStartingMatch, setIsStartingMatch] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const { isConnected: isWalletConnected, chain } = useAccount();
  const isCorrectNetwork = chain?.id === monadTestnet.id;
  const canWatchLive = isWalletConnected && isCorrectNetwork;

  // Always live mode
  useEffect(() => {
    useGameStore.getState().setMode("live");
  }, []);

  const liveGame = useLiveGame(canWatchLive);

  const handleStartMatch = useCallback(async (agents: LiveAgentId[]) => {
    if (agents.length < 2) return;

    setIsStartingMatch(true);
    try {
      const response = await fetch(`${COORDINATOR_API_URL}/start-selected-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agents: agents.map((id) => id.charAt(0).toUpperCase() + id.slice(1)),
        }),
      });
      const result = await response.json();

      if (!result.success) {
        console.error("Failed to start match:", result.error || result.message);
      } else {
        console.log("Match started:", result);
      }
    } catch (err) {
      console.error("Failed to start match:", err);
    } finally {
      setIsStartingMatch(false);
    }
  }, []);

  const gameInProgress = !!liveGame.currentGameId;

  return (
    <div className="h-screen flex flex-col bg-[#0a0e13] overflow-hidden">
      <ArenaHeader
        isConnected={liveGame.isConnected}
        networkName={isCorrectNetwork ? "Monad Testnet" : undefined}
        onHowToPlay={() => setShowHowToPlay(true)}
      />

      <div className="flex-1 flex min-h-0">
        {/* Left Panel */}
        <div className="w-72 flex-shrink-0 p-4 flex flex-col gap-4 overflow-y-auto border-r border-gray-800">
          <ArenaAgentSelect
            gameInProgress={gameInProgress}
            currentPlayers={liveGame.activePlayers}
            isConnected={liveGame.isConnected}
            connectedAgents={liveGame.connectedAgentNames}
            onStartMatch={handleStartMatch}
            isStarting={isStartingMatch}
          />

          {/* Wager Placeholder - Coming Soon */}
          <div className="bg-gray-900/90 rounded-xl border border-gray-800 overflow-hidden opacity-60">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>💰</span> Custom Wager
              </h2>
              <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-semibold">
                Coming Soon
              </span>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Wager Amount</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value="0.01"
                    disabled
                    className="flex-1 bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
                  />
                  <span className="text-xs text-gray-500 font-medium">MON</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Wager Type</label>
                <select
                  disabled
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-400 cursor-not-allowed appearance-none"
                >
                  <option>Fixed Entry</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Center - Poker Table */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 min-w-0 gap-6">
          {!canWatchLive ? (
            <div className="flex flex-col items-center justify-center gap-6 p-8 bg-gray-900/90 rounded-2xl border border-gray-700 max-w-md">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <span className="text-4xl">🎰</span>
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Enter the Arena</h2>
                <p className="text-gray-400">
                  Connect your wallet to Monad Testnet to watch live AI poker battles.
                </p>
              </div>
              <WalletConnect />
              <p className="text-xs text-gray-500 text-center">
                Free to watch. No transactions required.
              </p>
            </div>
          ) : (
            <div className="w-full max-w-4xl">
              <PokerTable
                mode="live"
                activePlayers={liveGame.activePlayers}
                currentGameId={liveGame.currentGameId}
              />
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="w-80 flex-shrink-0 p-4 flex flex-col gap-4 overflow-hidden border-l border-gray-800">
          <ArenaLeaderboard />
          <div className="flex-1 min-h-0">
            <ArenaGameFeed />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 bg-gray-900/80 border-t border-gray-800 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>AI Poker Arena v1.0</span>
            <span className="text-gray-700">|</span>
            <span>Built on Monad</span>
          </div>
          <div className="flex items-center gap-4">
            {liveGame.currentGameId && (
              <span className="text-gray-400">
                Game: {liveGame.currentGameId.slice(0, 10)}...
              </span>
            )}
            <span className={liveGame.isConnected ? "text-green-400" : "text-red-400"}>
              {liveGame.isConnected ? "● Connected" : "○ Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {/* How to Play Modal */}
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
    </div>
  );
}
