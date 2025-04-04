#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Run the start script in the background
echo -e "${YELLOW}Starting all services in the background...${NC}"
USE_MOCK_AI=true nohup ./start.sh > /dev/null 2>&1 &

# Wait a moment for services to start
sleep 3

# Print status message
echo -e "${GREEN}Services are starting in the background.${NC}"
echo -e "${YELLOW}Check logs in /home/runner/workspace/logs/ for details.${NC}"
echo -e "${YELLOW}To view logs: cat /home/runner/workspace/logs/*.log${NC}"

# Check if services have started by looking for processes
if pgrep -f "node.*server" > /dev/null; then
    echo -e "${GREEN}✓ Main server is running${NC}"
else
    echo -e "${YELLOW}⚠ Main server may not have started yet${NC}"
fi

if pgrep -f "python.*mock_ai_server" > /dev/null; then
    echo -e "${GREEN}✓ Mock AI server is running${NC}"
else
    echo -e "${YELLOW}⚠ Mock AI server may not have started yet${NC}"
fi

if pgrep -f "node.*market-update" > /dev/null; then
    echo -e "${GREEN}✓ Market data service is running${NC}"
else
    echo -e "${YELLOW}⚠ Market data service may not have started yet${NC}"
fi

echo -e "${GREEN}You can continue using the terminal while services run in the background.${NC}" 