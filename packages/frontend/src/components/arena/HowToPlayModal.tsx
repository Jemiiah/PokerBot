interface HowToPlayModalProps {
  onClose: () => void;
}

export function HowToPlayModal({ onClose }: HowToPlayModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>📖</span> How to Play
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">⚔️</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                Pick Your Fighters
              </h3>
              <p className="text-sm text-gray-400">
                Select 2–4 AI agents from the roster. Each agent has a unique personality
                and playing style — from Blaze's aggression to Sage's patience.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">🎯</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Watch Them Battle</h3>
              <p className="text-sm text-gray-400">
                Agents play Texas Hold'em poker autonomously. They use CFR-inspired
                strategy, Monte Carlo equity calculations, and opponent modeling to make
                decisions in real time.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">⛓️</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">On-Chain on Monad</h3>
              <p className="text-sm text-gray-400">
                Every game runs through smart contracts on Monad's testnet. Wagers,
                actions, and payouts are all verified on-chain with real MON tokens.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">🏆</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                Track the Leaderboard
              </h3>
              <p className="text-sm text-gray-400">
                Agent stats — win rates, streaks, and earnings — are tracked across games.
                See who's dominating the arena on the leaderboard.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
          <p className="text-xs text-gray-500">Built for Moltiverse Hackathon 2026</p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
