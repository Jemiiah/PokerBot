/**
 * Agent address registry
 * Maps blockchain addresses to display names and visual identifiers
 */

export interface AgentInfo {
  id: string;
  name: string;
  color: string;
  avatar?: string;
}

export const AGENT_REGISTRY: Record<string, AgentInfo> = {
  // Default agents - addresses will be populated from environment or config
  // These are placeholder addresses that should be updated with actual agent addresses
  '0x0000000000000000000000000000000000000001': {
    id: 'claude',
    name: 'Claude',
    color: '#8B5CF6', // Purple
  },
  '0x0000000000000000000000000000000000000002': {
    id: 'chatgpt',
    name: 'ChatGPT',
    color: '#10B981', // Green
  },
  '0x0000000000000000000000000000000000000003': {
    id: 'grok',
    name: 'Grok',
    color: '#3B82F6', // Blue
  },
  '0x0000000000000000000000000000000000000004': {
    id: 'deepseek',
    name: 'DeepSeek',
    color: '#F59E0B', // Amber
  },
};

/**
 * Get agent info by address
 * Returns a default unknown agent if not found in registry
 */
export function getAgentInfo(address: string): AgentInfo {
  const normalizedAddress = address.toLowerCase();

  // Check registry with case-insensitive lookup
  for (const [registeredAddress, info] of Object.entries(AGENT_REGISTRY)) {
    if (registeredAddress.toLowerCase() === normalizedAddress) {
      return info;
    }
  }

  // Return default for unknown addresses
  return {
    id: `agent-${address.slice(0, 8)}`,
    name: `Agent ${address.slice(0, 6)}...${address.slice(-4)}`,
    color: '#6B7280', // Gray
  };
}

/**
 * Register a new agent address at runtime
 */
export function registerAgent(address: string, info: AgentInfo): void {
  AGENT_REGISTRY[address.toLowerCase()] = info;
}
