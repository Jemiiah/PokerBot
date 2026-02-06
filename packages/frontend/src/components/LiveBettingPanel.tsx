import { useState, useEffect } from 'react';
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt, useConnect, useSwitchChain } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { SPECTATOR_BETTING_ABI, SPECTATOR_BETTING_ADDRESS } from '../config/contracts';
import { monadTestnet } from '../config/chains';

interface LiveBettingPanelProps {
  gameId: string | null;
  player0Name?: string;
  player1Name?: string;
  gamePhase?: number;
}

// Preset bet amounts in MON
const BET_PRESETS = [0.01, 0.05, 0.1, 0.5, 1];

// Check if OKX wallet is available
const isOKXWalletAvailable = () => {
  return typeof window !== 'undefined' && !!(window as any).okxwallet;
};

export function LiveBettingPanel({
  gameId,
  player0Name = 'Blaze',
  player1Name = 'Frost',
  gamePhase = 0
}: LiveBettingPanelProps) {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending: isConnectPending } = useConnect();
  const { switchChain, isPending: isSwitchPending } = useSwitchChain();
  const { data: balanceData } = useBalance({ address });

  const isWrongNetwork = isConnected && chain?.id !== monadTestnet.id;
  const okxConnector = connectors.find(c => c.id === 'okxWallet') || connectors[0];
  const [selectedPlayer, setSelectedPlayer] = useState<0 | 1 | null>(null);
  const [betAmount, setBetAmount] = useState('0.05');
  const [customAmount, setCustomAmount] = useState('');

  // Read betting pool data
  const { data: poolData, refetch: refetchPool } = useReadContract({
    address: SPECTATOR_BETTING_ADDRESS,
    abi: SPECTATOR_BETTING_ABI,
    functionName: 'getPool',
    args: gameId ? [gameId as `0x${string}`] : undefined,
    query: { enabled: !!gameId }
  });

  // Read odds
  const { data: oddsData } = useReadContract({
    address: SPECTATOR_BETTING_ADDRESS,
    abi: SPECTATOR_BETTING_ABI,
    functionName: 'getOdds',
    args: gameId ? [gameId as `0x${string}`] : undefined,
    query: { enabled: !!gameId }
  });

  // Read user's bets
  const { data: userBetsData, refetch: refetchUserBets } = useReadContract({
    address: SPECTATOR_BETTING_ADDRESS,
    abi: SPECTATOR_BETTING_ABI,
    functionName: 'getUserBets',
    args: gameId && address ? [gameId as `0x${string}`, address] : undefined,
    query: { enabled: !!gameId && !!address }
  });

  // Write functions
  const { writeContract: placeBet, data: placeBetHash, isPending: isPlacingBet } = useWriteContract();
  const { writeContract: claimWinnings, data: claimHash, isPending: isClaiming } = useWriteContract();
  const { writeContract: settleBets, data: settleHash, isPending: isSettling } = useWriteContract();

  // Wait for transactions
  const { isLoading: isPlaceBetConfirming, isSuccess: placeBetSuccess } = useWaitForTransactionReceipt({ hash: placeBetHash });
  const { isLoading: isClaimConfirming, isSuccess: claimSuccess } = useWaitForTransactionReceipt({ hash: claimHash });
  const { isLoading: isSettleConfirming, isSuccess: settleSuccess } = useWaitForTransactionReceipt({ hash: settleHash });

  // Refetch data when transactions complete
  useEffect(() => {
    if (placeBetSuccess || claimSuccess || settleSuccess) {
      refetchPool();
      refetchUserBets();
    }
  }, [placeBetSuccess, claimSuccess, settleSuccess, refetchPool, refetchUserBets]);

  // Parse pool data - format: [totalPool0, totalPool1, totalBets, settled, winner, winnerIndex]
  const poolArray = poolData as readonly [bigint, bigint, bigint, boolean, `0x${string}`, number] | undefined;
  const pool0 = poolArray ? poolArray[0] : 0n;
  const pool1 = poolArray ? poolArray[1] : 0n;
  const totalBets = poolArray ? Number(poolArray[2]) : 0;
  const isSettled = poolArray ? poolArray[3] : false;
  const winnerIndex = poolArray ? poolArray[5] : 255;

  // Parse odds data - format: [odds0, odds1]
  const oddsArray = oddsData as readonly [bigint, bigint] | undefined;
  const odds0 = oddsArray ? Number(oddsArray[0]) / 100 : 1;
  const odds1 = oddsArray ? Number(oddsArray[1]) / 100 : 1;

  // Parse user bets data - format: [totalOnPlayer0, totalOnPlayer1, betCount]
  const userBetsArray = userBetsData as readonly [bigint, bigint, bigint] | undefined;
  const userBetOn0 = userBetsArray ? userBetsArray[0] : 0n;
  const userBetOn1 = userBetsArray ? userBetsArray[1] : 0n;
  const userBetCount = userBetsArray ? Number(userBetsArray[2]) : 0;

  const canBet = isConnected && !isWrongNetwork && gameId && gamePhase > 0 && gamePhase < 5 && !isSettled;
  const canClaim = isConnected && gameId && isSettled && userBetCount > 0;
  const canSettle = isConnected && gameId && !isSettled && gamePhase === 6;

  const handlePlaceBet = () => {
    if (!gameId || selectedPlayer === null) return;

    const amount = customAmount || betAmount;
    placeBet({
      address: SPECTATOR_BETTING_ADDRESS,
      abi: SPECTATOR_BETTING_ABI,
      functionName: 'placeBet',
      args: [gameId as `0x${string}`, selectedPlayer],
      value: parseEther(amount),
    });
  };

  const handleClaimWinnings = () => {
    if (!gameId) return;
    claimWinnings({
      address: SPECTATOR_BETTING_ADDRESS,
      abi: SPECTATOR_BETTING_ABI,
      functionName: 'claimWinnings',
      args: [gameId as `0x${string}`],
    });
  };

  const handleSettleBets = () => {
    if (!gameId) return;
    settleBets({
      address: SPECTATOR_BETTING_ADDRESS,
      abi: SPECTATOR_BETTING_ABI,
      functionName: 'settleBets',
      args: [gameId as `0x${string}`],
    });
  };

  const isLoading = isPlacingBet || isPlaceBetConfirming || isClaiming || isClaimConfirming || isSettling || isSettleConfirming;

  if (!gameId) {
    return (
      <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-bold mb-2">Live Betting</h3>
        <p className="text-gray-400 text-sm">Select a game to place bets</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Live Betting</h3>
        {isConnected && balanceData && (
          <div className="text-sm">
            <span className="text-gray-400">Balance: </span>
            <span className="text-green-400 font-bold">
              {parseFloat(formatEther(balanceData.value)).toFixed(4)} MON
            </span>
          </div>
        )}
      </div>

      {/* Pool Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={`p-3 rounded-lg border-2 ${winnerIndex === 0 ? 'border-green-500 bg-green-500/10' : 'border-orange-500/30 bg-orange-500/5'}`}>
          <div className="text-center">
            <span className="text-2xl">🔥</span>
            <p className="font-bold text-orange-400">{player0Name}</p>
            <p className="text-lg font-bold">{parseFloat(formatEther(pool0)).toFixed(3)} MON</p>
            <p className="text-xs text-gray-400">{odds0.toFixed(2)}x odds</p>
            {winnerIndex === 0 && <p className="text-xs text-green-400 mt-1">WINNER!</p>}
          </div>
        </div>
        <div className={`p-3 rounded-lg border-2 ${winnerIndex === 1 ? 'border-green-500 bg-green-500/10' : 'border-blue-500/30 bg-blue-500/5'}`}>
          <div className="text-center">
            <span className="text-2xl">❄️</span>
            <p className="font-bold text-blue-400">{player1Name}</p>
            <p className="text-lg font-bold">{parseFloat(formatEther(pool1)).toFixed(3)} MON</p>
            <p className="text-xs text-gray-400">{odds1.toFixed(2)}x odds</p>
            {winnerIndex === 1 && <p className="text-xs text-green-400 mt-1">WINNER!</p>}
          </div>
        </div>
      </div>

      {/* User's Bets */}
      {userBetCount > 0 && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-sm text-yellow-400 font-medium mb-2">Your Bets:</p>
          <div className="flex gap-4 text-sm">
            {userBetOn0 > 0n && (
              <div className="flex items-center gap-2">
                <span>🔥</span>
                <span>{parseFloat(formatEther(userBetOn0)).toFixed(3)} MON on {player0Name}</span>
              </div>
            )}
            {userBetOn1 > 0n && (
              <div className="flex items-center gap-2">
                <span>❄️</span>
                <span>{parseFloat(formatEther(userBetOn1)).toFixed(3)} MON on {player1Name}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Betting Interface */}
      {canBet && (
        <>
          {/* Player Selection */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setSelectedPlayer(0)}
              disabled={isLoading}
              className={`p-3 rounded-lg border-2 transition-all ${
                selectedPlayer === 0
                  ? 'border-orange-400 bg-orange-400/20'
                  : 'border-gray-700 hover:border-orange-400/50'
              }`}
            >
              <span className="text-xl">🔥</span>
              <p className="font-medium">Bet on {player0Name}</p>
            </button>
            <button
              onClick={() => setSelectedPlayer(1)}
              disabled={isLoading}
              className={`p-3 rounded-lg border-2 transition-all ${
                selectedPlayer === 1
                  ? 'border-blue-400 bg-blue-400/20'
                  : 'border-gray-700 hover:border-blue-400/50'
              }`}
            >
              <span className="text-xl">❄️</span>
              <p className="font-medium">Bet on {player1Name}</p>
            </button>
          </div>

          {/* Bet Amount */}
          {selectedPlayer !== null && (
            <>
              <div className="flex gap-2 mb-3">
                {BET_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setBetAmount(preset.toString());
                      setCustomAmount('');
                    }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      betAmount === preset.toString() && !customAmount
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {preset} MON
                  </button>
                ))}
              </div>

              <div className="flex gap-2 mb-4">
                <input
                  type="number"
                  placeholder="Custom amount..."
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-yellow-500 focus:outline-none"
                  step="0.01"
                  min="0.001"
                />
                <button
                  onClick={handlePlaceBet}
                  disabled={isLoading}
                  className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : 'Place Bet'}
                </button>
              </div>

              <p className="text-center text-sm text-gray-400">
                Potential payout:{' '}
                <span className="text-green-400 font-bold">
                  {(parseFloat(customAmount || betAmount) * (selectedPlayer === 0 ? odds0 : odds1)).toFixed(3)} MON
                </span>
              </p>
            </>
          )}
        </>
      )}

      {/* Settle Button (when game is complete) */}
      {canSettle && (
        <button
          onClick={handleSettleBets}
          disabled={isLoading}
          className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 mb-3"
        >
          {isLoading ? 'Processing...' : 'Settle Bets'}
        </button>
      )}

      {/* Claim Button */}
      {canClaim && (
        <button
          onClick={handleClaimWinnings}
          disabled={isLoading}
          className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Processing...' : 'Claim Winnings'}
        </button>
      )}

      {/* Wallet Connection */}
      {!isConnected && (
        <button
          onClick={() => okxConnector && connect({ connector: okxConnector })}
          disabled={isConnectPending || !isOKXWalletAvailable()}
          className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white font-bold rounded-lg transition-colors"
        >
          {isConnectPending ? 'Connecting...' : isOKXWalletAvailable() ? 'Connect OKX Wallet' : 'Install OKX Wallet'}
        </button>
      )}

      {/* Wrong Network */}
      {isWrongNetwork && (
        <button
          onClick={() => switchChain({ chainId: monadTestnet.id })}
          disabled={isSwitchPending}
          className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 font-bold rounded-lg transition-colors"
        >
          {isSwitchPending ? 'Switching...' : 'Switch to Monad Testnet'}
        </button>
      )}

      {isSettled && winnerIndex === 255 && (
        <p className="text-center text-yellow-400 text-sm py-2">
          Game ended in a tie - bets refunded
        </p>
      )}

      <div className="mt-3 pt-3 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          Total bets: {totalBets} | 2% platform fee
        </p>
      </div>
    </div>
  );
}
