import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
// First try DOTENV_CONFIG_PATH if set, then fall back to ../../.env
const envPath = process.env.DOTENV_CONFIG_PATH || resolve(process.cwd(), '../../.env');
dotenvConfig({ path: envPath });

export interface AgentConfig {
  // Network
  rpcUrl: string;
  chainId: number;

  // Wallet
  privateKey: `0x${string}`;

  // Contracts
  pokerGameAddress: `0x${string}`;
  escrowAddress: `0x${string}`;
  tournamentAddress: `0x${string}`;

  // Coordinator
  coordinatorUrl: string;
  coordinatorApiUrl: string;

  // Agent settings
  agentName: string;
  maxWagerPercent: number;
  kellyFraction: number;
  timeoutSeconds: number;

  // Personality/LLM settings
  openaiApiKey: string | null;
  personalityName: string;
  agentMode: 'live' | 'demo';

  // Logging
  logLevel: string;
}

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export function loadConfig(): AgentConfig {
  return {
    // Network
    rpcUrl: getEnvOrDefault('MONAD_RPC_URL', 'https://testnet-rpc.monad.xyz'),
    chainId: parseInt(getEnvOrDefault('MONAD_CHAIN_ID', '10143')),

    // Wallet
    privateKey: getEnvOrThrow('AGENT_PRIVATE_KEY') as `0x${string}`,

    // Contracts
    pokerGameAddress: getEnvOrDefault('POKER_GAME_ADDRESS', '0x') as `0x${string}`,
    escrowAddress: getEnvOrDefault('ESCROW_ADDRESS', '0x') as `0x${string}`,
    tournamentAddress: getEnvOrDefault('TOURNAMENT_ADDRESS', '0x') as `0x${string}`,

    // Coordinator
    coordinatorUrl: getEnvOrDefault('COORDINATOR_URL', 'ws://localhost:8080'),
    coordinatorApiUrl: getEnvOrDefault('COORDINATOR_API_URL', 'http://localhost:8080'),

    // Agent settings
    agentName: getEnvOrDefault('AGENT_NAME', 'PokerBot001'),
    maxWagerPercent: parseFloat(getEnvOrDefault('MAX_WAGER_PERCENT', '5')),
    kellyFraction: parseFloat(getEnvOrDefault('KELLY_FRACTION', '0.25')),
    timeoutSeconds: parseInt(getEnvOrDefault('TIMEOUT_SECONDS', '60')),

    // Personality/LLM settings
    openaiApiKey: process.env.OPENAI_API_KEY || null,
    personalityName: getEnvOrDefault('AGENT_PERSONALITY', 'Blaze'),
    agentMode: (getEnvOrDefault('AGENT_MODE', 'live') as 'live' | 'demo'),

    // Logging
    logLevel: getEnvOrDefault('LOG_LEVEL', 'info'),
  };
}

export const config = loadConfig();
