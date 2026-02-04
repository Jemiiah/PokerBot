import { PokerAgent } from './Agent.js';
import { logger } from './utils/logger.js';
import { config } from './utils/config.js';

async function main() {
  logger.info('=================================');
  logger.info('   Poker Agent for Monad');
  logger.info('   Moltiverse Hackathon 2026');
  logger.info('=================================');
  logger.info({ agentName: config.agentName }, 'Starting agent');

  const agent = new PokerAgent();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down...');
    agent.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down...');
    agent.stop();
    process.exit(0);
  });

  // Start the agent
  try {
    await agent.start();
  } catch (error) {
    logger.error({ error }, 'Fatal error');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Failed to start agent:', error);
  process.exit(1);
});

export { PokerAgent } from './Agent.js';
export * from './strategy/index.js';
export * from './opponent/index.js';
export * from './bankroll/index.js';
export * from './blockchain/index.js';
