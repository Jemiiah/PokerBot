import { useGameStore } from '../stores/gameStore';
import { AgentSeat } from './AgentSeat';
import { CommunityCards } from './CommunityCards';
import { GameDuration } from './GameDuration';
import { getSeatPositions, type AgentId, type SeatPosition } from '../lib/constants';

interface PokerTableProps {
  mode?: 'demo' | 'live';
  activePlayers?: AgentId[]; // For live mode - which agents are actually in this game
  currentGameId?: string | null; // For live mode - the active game ID
}

export function PokerTable({ mode = 'demo', activePlayers, currentGameId }: PokerTableProps) {
  const { phase, pot, communityCards, activeAgentId, handNumber, dealerIndex, isRunning } = useGameStore();

  // In live mode, only show game state if there's an active game
  const hasActiveGame = mode === 'demo' ? isRunning : (currentGameId !== null && currentGameId !== undefined);

  // Use store values only if there's an active game, otherwise show empty/waiting state
  const displayPhase = hasActiveGame ? phase : 'waiting';
  const displayPot = hasActiveGame ? pot : 0;
  const displayCommunityCards = hasActiveGame ? communityCards : [];
  const displayHandNumber = hasActiveGame ? handNumber : 0;

  const phaseLabels: Record<string, string> = {
    waiting: 'WAITING',
    preflop: 'PRE-FLOP',
    flop: 'FLOP',
    turn: 'TURN',
    river: 'RIVER',
    showdown: 'SHOWDOWN',
  };

  const phaseColors: Record<string, string> = {
    waiting: 'bg-gray-600',
    preflop: 'bg-blue-600',
    flop: 'bg-green-600',
    turn: 'bg-yellow-600',
    river: 'bg-orange-600',
    showdown: 'bg-purple-600',
  };

  // Determine which players to show based on mode
  let playersToShow: AgentId[];
  if (mode === 'live') {
    if (hasActiveGame && activePlayers && activePlayers.length > 0) {
      // Live mode with active game - show the game's players
      playersToShow = activePlayers;
    } else {
      // Live mode waiting for game - show default live agents as placeholders
      playersToShow = ['shadow', 'storm', 'sage', 'blaze'] as AgentId[];
    }
  } else {
    // Demo mode uses fixed 4 demo agents
    playersToShow = ['deepseek', 'chatgpt', 'grok', 'claude'] as AgentId[];
  }

  // Get seat positions based on player count
  const seatPositions = getSeatPositions(playersToShow.length);

  // Map players to their positions
  const playerSeats: { agentId: AgentId; position: SeatPosition; isDealer: boolean; isSB: boolean; isBB: boolean }[] =
    playersToShow.map((agentId, index) => ({
      agentId,
      position: seatPositions[index],
      isDealer: index === dealerIndex,
      isSB: playersToShow.length === 2
        ? index === dealerIndex
        : index === (dealerIndex + 1) % playersToShow.length,
      isBB: playersToShow.length === 2
        ? index === (dealerIndex + 1) % 2
        : index === (dealerIndex + 2) % playersToShow.length,
    }));

  return (
    <div className="relative w-full max-w-6xl aspect-[16/10]">
      {/* Table Shadow */}
      <div className="absolute inset-[5%] rounded-[50%] bg-black/60 blur-3xl translate-y-4" />

      {/* Poker Table */}
      <div className="absolute inset-[5%] rounded-[50%] bg-gradient-to-b from-[#1a7a4c] to-[#145c3a] border-[16px] border-[#2d1810] shadow-[inset_0_0_80px_rgba(0,0,0,0.5)]">
        {/* Inner Felt Border */}
        <div className="absolute inset-4 rounded-[50%] border-2 border-[#2d9860]/30" />

        {/* Table Rail Highlight */}
        <div className="absolute inset-0 rounded-[50%] shadow-[inset_0_-4px_20px_rgba(255,255,255,0.1)]" />

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Logo/Title */}
          <div className="mb-4">
            <h1 className="text-3xl font-bold tracking-[0.3em] text-white/70 drop-shadow-lg">
              AI POKER
            </h1>
            {displayHandNumber > 0 && (
              <p className="text-center text-white/40 text-xs mt-1">
                Hand #{displayHandNumber}
              </p>
            )}
          </div>

          {/* Community Cards - only show if there's an active game */}
          <div className="mb-4">
            {hasActiveGame ? (
              <CommunityCards cards={displayCommunityCards} />
            ) : (
              <div className="h-[72px] flex items-center justify-center">
                <p className="text-white/30 text-sm">
                  {mode === 'live' ? 'Waiting for game...' : 'Start game to play'}
                </p>
              </div>
            )}
          </div>

          {/* Pot and Phase */}
          <div className="flex items-center gap-3">
            {displayPot > 0 && (
              <div className="flex items-center gap-2 px-5 py-2 bg-black/40 backdrop-blur rounded-full border border-yellow-500/30 shadow-lg">
                <div className="w-6 h-6 rounded-full bg-gradient-to-b from-yellow-400 to-yellow-600 flex items-center justify-center text-[10px] font-bold text-yellow-900">
                  $
                </div>
                <span className="text-yellow-400 font-bold text-lg">{displayPot}</span>
              </div>
            )}
            <div className={`px-4 py-2 ${phaseColors[displayPhase]} rounded-full text-white font-bold text-sm shadow-lg`}>
              {phaseLabels[displayPhase] || displayPhase.toUpperCase()}
            </div>
          </div>

          {/* Player Count and Game Duration (Live Mode) */}
          {mode === 'live' && hasActiveGame && (
            <div className="mt-2 flex items-center gap-3">
              {playersToShow.length > 0 && (
                <div className="px-3 py-1 bg-black/30 rounded-full text-white/50 text-xs">
                  {playersToShow.length} players
                </div>
              )}
              <GameDuration />
            </div>
          )}
        </div>
      </div>

      {/* Agent Seats - Dynamically positioned */}
      {playerSeats.map(({ agentId, position, isDealer, isSB, isBB }) => (
        <AgentSeat
          key={agentId}
          agentId={agentId}
          position={position}
          isActive={hasActiveGame && activeAgentId === agentId}
          isDealer={hasActiveGame && isDealer}
          isSmallBlind={hasActiveGame && isSB}
          isBigBlind={hasActiveGame && isBB}
          showCards={hasActiveGame && (mode === 'live' || displayPhase === 'showdown')}
        />
      ))}
    </div>
  );
}
