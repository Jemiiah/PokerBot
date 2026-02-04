import { pino } from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.logLevel,
});

export function createChildLogger(name: string) {
  return logger.child({ component: name });
}
