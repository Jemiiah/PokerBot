import { useAccount, useConnect, useDisconnect, useBalance, useSwitchChain } from 'wagmi';
import { monadTestnet } from '../config/chains';

// Check if a Web3 wallet is available (OKX, MetaMask, or other)
const isWalletAvailable = () => {
  if (typeof window === 'undefined') return false;
  return !!(
    (window as any).okxwallet ||
    (window as any).ethereum?.isOkxWallet ||
    (window as any).ethereum
  );
};

// Get wallet name for display
const getWalletName = () => {
  if (typeof window === 'undefined') return 'Wallet';
  if ((window as any).okxwallet) return 'OKX Wallet';
  if ((window as any).ethereum?.isOkxWallet) return 'OKX Wallet';
  if ((window as any).ethereum?.isMetaMask) return 'MetaMask';
  if ((window as any).ethereum) return 'Wallet';
  return 'Wallet';
};

export function WalletConnect() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { data: balance } = useBalance({
    address,
    query: { enabled: isConnected },
  });

  const isWrongNetwork = isConnected && chain?.id !== monadTestnet.id;
  const okxConnector = connectors.find(c => c.id === 'okxWallet') || connectors[0];

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {/* Wrong Network - Show Switch Button */}
        {isWrongNetwork ? (
          <button
            onClick={() => switchChain({ chainId: monadTestnet.id })}
            disabled={isSwitching}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg transition-colors"
          >
            <span className="text-red-400 text-sm">
              {isSwitching ? 'Switching...' : 'Switch to Monad'}
            </span>
          </button>
        ) : (
          /* Network + Balance */
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-green-400 font-medium text-sm">
              {balance ? `${Number(balance.formatted).toFixed(3)} MON` : '...'}
            </span>
          </div>
        )}

        {/* Address & Disconnect */}
        <button
          onClick={() => disconnect()}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <span className="text-white text-sm font-mono">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
          <span className="text-red-400 text-xs">×</span>
        </button>
      </div>
    );
  }

  // Not connected - show single connect button
  return (
    <button
      onClick={() => okxConnector && connect({ connector: okxConnector })}
      disabled={isPending || !isWalletAvailable()}
      className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors text-sm"
    >
      {isPending ? 'Connecting...' : isWalletAvailable() ? `Connect ${getWalletName()}` : 'Install Wallet'}
    </button>
  );
}

// Compact version for sidebar
export function WalletStatus() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { data: balance } = useBalance({
    address,
    query: { enabled: isConnected },
  });

  const okxConnector = connectors.find(c => c.id === 'okxWallet') || connectors[0];
  const isWrongNetwork = isConnected && chain?.id !== monadTestnet.id;

  if (!isConnected) {
    return (
      <button
        onClick={() => okxConnector && connect({ connector: okxConnector })}
        disabled={isPending || !isWalletAvailable()}
        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors text-sm"
      >
        {isPending ? 'Connecting...' : isWalletAvailable() ? `Connect ${getWalletName()}` : 'Install Wallet'}
      </button>
    );
  }

  if (isWrongNetwork) {
    return (
      <button
        onClick={() => switchChain({ chainId: monadTestnet.id })}
        disabled={isSwitching}
        className="w-full px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg transition-colors text-sm"
      >
        <span className="text-red-400">
          {isSwitching ? 'Switching...' : 'Switch to Monad Testnet'}
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-white text-sm font-mono">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-green-400 text-sm font-medium">
          {balance ? `${Number(balance.formatted).toFixed(2)} MON` : '...'}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-red-400 hover:text-red-300 text-xs"
        >
          ×
        </button>
      </div>
    </div>
  );
}
