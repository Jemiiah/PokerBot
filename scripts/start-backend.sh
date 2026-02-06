#!/bin/sh
# Start all backend services: Coordinator + 4 Agents

echo "============================================"
echo "   PokerBot Backend - Starting Services"
echo "============================================"

# Use PM2 to manage all processes
pm2-runtime start ecosystem.config.cjs
