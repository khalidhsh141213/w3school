#!/bin/bash

# Create log directories if they don't exist
mkdir -p logs

# Add color to output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Mock AI Service Setup...${NC}"

# Kill any existing Node.js processes for our AI server
echo "Checking for existing server processes..."
if pkill -f "node improved-mock-ai.js"; then
  echo -e "${GREEN}Stopped existing server processes${NC}"
  # Wait a moment to ensure processes are terminated
  sleep 2
else
  echo "No existing server processes found"
fi

# Make the script executable if it isn't already
chmod +x improved-mock-ai.js

# Set environment variables
export FLASK_PORT=5000
export USE_MOCK_AI=true
export NODE_OPTIONS="--enable-source-maps --trace-warnings"

# Start the mock AI service with detailed logging
echo -e "${YELLOW}Starting Mock AI service on port ${FLASK_PORT}...${NC}"
node improved-mock-ai.js > logs/mock-ai.log 2>&1 &
server_pid=$!

# Wait for service to start
echo "Waiting for server to start..."
sleep 3

# Check if service is running
if kill -0 $server_pid 2>/dev/null; then
  echo -e "${GREEN}Process is running with PID: ${server_pid}${NC}"
  
  # Check if service is responding
  if curl -s http://0.0.0.0:${FLASK_PORT}/health > /dev/null; then
    echo -e "${GREEN}Mock AI service is now running!${NC}"
    echo -e "You can check the logs with: ${YELLOW}cat logs/mock-ai.log${NC}"
  else
    echo -e "${RED}Process is running but not responding to health checks${NC}"
    echo -e "Check logs for errors: ${YELLOW}cat logs/mock-ai.log${NC}"
  fi
else
  echo -e "${RED}Mock AI service failed to start${NC}"
  echo -e "Check logs for errors: ${YELLOW}cat logs/mock-ai.log${NC}"
  cat logs/mock-ai.log
fi 