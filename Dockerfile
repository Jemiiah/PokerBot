# Multi-stage build for PokerBot Backend
# Runs: Coordinator + 4 Agents (Shadow, Storm, Sage, Ember)

FROM node:20-alpine AS builder

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files and tsconfig
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/coordinator/package.json ./packages/coordinator/
COPY packages/agent/package.json ./packages/agent/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/coordinator ./packages/coordinator
COPY packages/agent ./packages/agent

# Build all packages
RUN pnpm --filter @poker/shared build
RUN pnpm --filter @poker/coordinator build
RUN pnpm --filter @poker/agent build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Install pnpm and pm2 for process management
RUN npm install -g pnpm pm2

# Copy built files and node_modules from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/coordinator ./packages/coordinator
COPY --from=builder /app/packages/agent ./packages/agent

# Copy startup files
COPY scripts/start-backend.sh ./start-backend.sh
COPY ecosystem.config.cjs ./ecosystem.config.cjs
RUN chmod +x ./start-backend.sh

# Expose coordinator port
EXPOSE 8080

# Start all services
CMD ["./start-backend.sh"]
