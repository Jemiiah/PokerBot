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
  }
}

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [
    // Use injected connector with OKX wallet's provider specifically
    injected({
      target: {
        id: 'okxWallet',
        name: 'OKX Wallet',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        provider: () => (window as any).okxwallet,
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
