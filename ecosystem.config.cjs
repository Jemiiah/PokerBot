// PM2 Ecosystem Configuration
// Runs: Coordinator + 4 Poker Agents

module.exports = {
  apps: [
    // Coordinator WebSocket Server
    {
      name: 'coordinator',
      cwd: './packages/coordinator',
      script: 'dist/index.js',
      node_args: '-r dotenv/config',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 8080,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'info',
      },
      // Wait for coordinator to start before agents
      wait_ready: true,
      listen_timeout: 10000,
    },

    // Agent: Shadow
    {
      name: 'agent-shadow',
      cwd: './packages/agent',
      script: 'dist/index.js',
      // Stagger startup to avoid rate limiting
      restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        AGENT_NAME: 'Shadow',
        AGENT_PERSONALITY: 'Shadow',
        AGENT_MODE: 'live',
        AGENT_PRIVATE_KEY: process.env.SHADOW_PRIVATE_KEY,
        POKER_GAME_ADDRESS: process.env.POKER_GAME_ADDRESS,
        MONAD_RPC_URL: process.env.RPC_URL,
        MONAD_CHAIN_ID: process.env.CHAIN_ID || '143',
        COORDINATOR_URL: 'ws://localhost:8080',
        MAX_WAGER_PERCENT: '5',
        KELLY_FRACTION: '0.25',
      },
    },

    // Agent: Storm
    {
      name: 'agent-storm',
      cwd: './packages/agent',
      script: 'dist/index.js',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        AGENT_NAME: 'Storm',
        AGENT_PERSONALITY: 'Storm',
        AGENT_MODE: 'live',
        AGENT_PRIVATE_KEY: process.env.STORM_PRIVATE_KEY,
        POKER_GAME_ADDRESS: process.env.POKER_GAME_ADDRESS,
        MONAD_RPC_URL: process.env.RPC_URL,
        MONAD_CHAIN_ID: process.env.CHAIN_ID || '143',
        COORDINATOR_URL: 'ws://localhost:8080',
        MAX_WAGER_PERCENT: '8',
        KELLY_FRACTION: '0.35',
      },
    },

    // Agent: Sage
    {
      name: 'agent-sage',
      cwd: './packages/agent',
      script: 'dist/index.js',
      restart_delay: 4000,
      env: {
        NODE_ENV: 'production',
        AGENT_NAME: 'Sage',
        AGENT_PERSONALITY: 'Sage',
        AGENT_MODE: 'live',
        AGENT_PRIVATE_KEY: process.env.SAGE_PRIVATE_KEY,
        POKER_GAME_ADDRESS: process.env.POKER_GAME_ADDRESS,
        MONAD_RPC_URL: process.env.RPC_URL,
        MONAD_CHAIN_ID: process.env.CHAIN_ID || '143',
        COORDINATOR_URL: 'ws://localhost:8080',
        MAX_WAGER_PERCENT: '3',
        KELLY_FRACTION: '0.15',
      },
    },

    // Agent: Ember
    {
      name: 'agent-ember',
      cwd: './packages/agent',
      script: 'dist/index.js',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        AGENT_NAME: 'Ember',
        AGENT_PERSONALITY: 'Ember',
        AGENT_MODE: 'live',
        AGENT_PRIVATE_KEY: process.env.EMBER_PRIVATE_KEY,
        POKER_GAME_ADDRESS: process.env.POKER_GAME_ADDRESS,
        MONAD_RPC_URL: process.env.RPC_URL,
        MONAD_CHAIN_ID: process.env.CHAIN_ID || '143',
        COORDINATOR_URL: 'ws://localhost:8080',
        MAX_WAGER_PERCENT: '5',
        KELLY_FRACTION: '0.20',
      },
    },
  ],
};
