import { defineChain } from 'viem';

// Monad Mainnet (Chain ID: 143)
export const monadMainnet = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: {
    decimals: 18,
    name: 'Monad',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Socialscan',
      url: 'https://monad.socialscan.io',
    },
    monadvision: {
      name: 'MonadVision',
      url: 'https://monadvision.com',
    },
    monadscan: {
      name: 'Monadscan',
      url: 'https://monadscan.com',
    },
  },
  testnet: false,
});

// Monad Testnet (Chain ID: 10143)
export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Monad',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://testnet.monadexplorer.com',
    },
  },
  testnet: true,
});

// Get chain by ID
export function getChainById(chainId: number) {
  switch (chainId) {
    case 143:
      return monadMainnet;
    case 10143:
      return monadTestnet;
    default:
      return monadTestnet; // Default to testnet
  }
}

// Current active chain (set via environment variable)
const activeChainId = parseInt(import.meta.env.VITE_CHAIN_ID || '10143');
export const activeChain = getChainById(activeChainId);

// All supported chains
export const supportedChains = [monadMainnet, monadTestnet] as const;
