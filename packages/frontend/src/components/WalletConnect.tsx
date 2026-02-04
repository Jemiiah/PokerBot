import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { monadTestnet } from '../config/chains';

export function WalletConnect() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({
    address,
    query: { enabled: isConnected },
  });

  const isWrongNetwork = isConnected && chain?.id !== monadTestnet.id;

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        {/* Balance */}
        <div className="px-3 py-1.5 bg-gray-800 rounded-lg">
          <span className="text-green-400 font-medium">
            {balance ? `${Number(balance.formatted).toFixed(4)} ${balance.symbol}` : '...'}
          </span>
        </div>

        {/* Network indicator */}
        {isWrongNetwork ? (
          <div className="px-3 py-1.5 bg-red-500/20 border border-red-500/50 rounded-lg">
            <span className="text-red-400 text-sm">Wrong Network</span>
          </div>
        ) : (
          <div className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/50 rounded-lg">
            <span className="text-purple-400 text-sm">Monad Testnet</span>
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
          <span className="text-gray-400 text-xs">Disconnect</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          disabled={isPending}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
        >
          {isPending ? 'Connecting...' : `Connect ${connector.name}`}
        </button>
      ))}
    </div>
  );
}

// Compact version for sidebar
export function WalletStatus() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { data: balance } = useBalance({
    address,
    query: { enabled: isConnected },
  });

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        disabled={isPending}
        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors text-sm"
      >
        {isPending ? 'Connecting...' : 'Connect Wallet'}
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
      <span className="text-green-400 text-sm font-medium">
        {balance ? `${Number(balance.formatted).toFixed(2)} MON` : '...'}
      </span>
    </div>
  );
}
