import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { monadTestnet } from './chains';

// Type for window with OKX wallet
declare global {
  interface Window {
    okxwallet?: {
      isOKXWallet?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
    // Note: ethereum is typed as 'any' in other libs, so we use any here
  }
}

// Get the OKX wallet provider - it can be injected in different ways
function getOKXProvider() {
  if (typeof window === 'undefined') return undefined;

  // Check for window.okxwallet (direct injection)
  if ((window as any).okxwallet) {
    return (window as any).okxwallet;
  }

  // Check for window.ethereum with isOkxWallet flag
  if ((window as any).ethereum?.isOkxWallet) {
    return (window as any).ethereum;
  }

  // Fallback to window.ethereum (might be OKX or other wallet)
  if ((window as any).ethereum) {
    return (window as any).ethereum;
  }

  return undefined;
}

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [
    // Use injected connector - will auto-detect available wallet
    injected({
      target: {
        id: 'okxWallet',
        name: 'OKX Wallet',
        provider: getOKXProvider,
      },
    }),
  ],
  transports: {
    [monadTestnet.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
