# Trading Platform

A full-stack trading platform with real-time market data using Polygon.io. Optimized for performance, stability, and efficient resource usage in the Replit environment.

## Project Structure

- **Client** (`/client/src/`): React frontend with TypeScript
- **Server** (`/server/`): Node.js/Express backend
- **Shared** (`/shared/`): Common types and schemas

## Features

- Real-time market data via optimized WebSocket connections
- Intelligent connection management with exponential backoff
- Batch processing of subscriptions to prevent duplicate connections
- Secure user authentication and authorization
- Portfolio management with real-time value updates
- Advanced trading interface with stop loss and take profit
- Smart caching and rate limiting for external API calls
- Responsive UI with light/dark themes
- Replit-optimized for resource efficiency and stability
- AI-powered customer support in English and Arabic
  - Intelligent response generation for common trading questions
  - Multi-lingual support with fallback mechanisms
  - Optimized for Replit environment with mock responses when needed
  - Robust error handling and response formatting

## Setup Instructions for Replit

### Environment Setup in Replit

1. Create a new Replit using the Node.js template
2. Fork this repository to your Replit workspace
3. Set up the following environment variables in the Replit Secrets tab:

```
# Database connection (automatically provided by Replit)
DATABASE_URL=your_postgres_connection_string

# Polygon.io API key (required for market data)
POLYGON_API_KEY=your_polygon_api_key

# Session secret (generate a strong random string)
SESSION_SECRET=your_session_secret

# AI Service Configuration
AI_SERVICE_URL="http://0.0.0.0:8000"
LLM_MODEL="bigscience/bloom-560m"
FLASK_PORT="8000"
USE_MOCK_AI=true          # Set to false to use the real model
USE_ARABIC_MODEL=true     # Enable Arabic model support

# Environment
NODE_ENV=production
```

### Database Setup

The application uses Replit's built-in database. Set up the database with:

```bash
# Initialize the database tables
npm run db:setup:replit

# Seed the database with initial data
npm run db:seed:replit
```

### Replit-Specific Deployment

```bash
# Install dependencies
npm install

# Set up deployment for Replit
yarn rw setup deploy replit

# Start the server for development
npm run dev

# For production deployment, Replit will use:
npm run start
```

## WebSocket Optimizations

The platform includes several optimizations for WebSocket connections, specifically tuned for Replit environment:

1. **WebSocketManagerSingleton Pattern**: Single instance management of WebSocket connections
2. **Dynamic URL Construction**: Automatically determines correct WebSocket URL based on Replit environment
3. **Exponential Backoff**: Smart reconnection strategy with proper delay calculation
4. **TypeScript Integration**: Strong typing for all WebSocket messages and responses
5. **Connection Status Tracking**: Real-time connection status with visual indicators for users
6. **Polygon.io Direct Integration**: Specialized handling for crypto and forex assets
7. **Asset-Specific Channel Formats**: Proper subscription channels based on asset types
8. **Component Lifecycle Management**: Proper cleanup when components unmount

## Database Schema

The application uses PostgreSQL with Drizzle ORM, with tables for:

- Users and authentication
- Assets (stocks, crypto, forex)
- Trades and positions with stop loss/take profit
- Transactions
- Watchlists
- Economic events
- User settings

## API Integration

The platform integrates with Polygon.io for market data:

- REST API for historical data (with smart caching)
- WebSocket connections for real-time updates (with connection management)
- TradingView for interactive charts

## Performance Optimizations

- In-memory caching with configurable expiration
- Rate limiting to avoid API quota exhaustion
- Batched database operations
- Selective updates based on price change thresholds
- Prioritized updates for assets that need them most
- Replit-specific resource management

## Replit Environment Considerations

When running in the Replit environment, our implementation considers:

1. **Resource Management**:

   - Memory constraints that could affect connection pooling
   - CPU limitations that might impact subscription processing
   - Network bandwidth limitations that affect data throughput

2. **Container Lifecycle**:

   - Proper handling of container sleep/wake cycles
   - Graceful recovery after unexpected container restarts
   - Caching to reduce startup time after inactivity

3. **Environment Variables**:
   - Secure storage of API keys and secrets using Replit Secrets
   - Proper fallbacks for missing environment variables
   - Clear error messages for misconfiguration

## Default Access

- Admin user: `admin@example.com` / `password123`
- Sample assets: BTC, ETH, AAPL, TSLA, EUR/USD

## Testing

For testing WebSocket functionality:

```bash
# Test WebSocket connections
node test-websocket.js

# Test database integration with WebSocket
node test-websocket-db.js

# Test Polygon API integration
node test-polygon-api.js

# Test direct connection to Polygon WebSocket
node test-polygon-websocket.js
```

## Troubleshooting in Replit

If you encounter issues with the application in Replit:

1. **WebSocket Connection Failures**:

   - Check the console for connection errors
   - Verify Polygon.io API key is correctly set in environment variables
   - Check if you've exceeded API rate limits

2. **Database Connection Issues**:

   - Ensure DATABASE_URL is set correctly in environment variables
   - Check database table structure with `npm run db:info`
   - Restart the Replit if database connection is stale

3. **UI Performance Issues**:
   - Check browser console for JavaScript errors
   - Verify that WebSocket connections are properly closed when components unmount
   - Consider reducing the number of active real-time subscriptions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Create a pull request

## License

MIT

# Documentation Structure

## Overview

This directory contains all project documentation, organized by category for easy access and maintenance.

## Directory Structure

```
docs/
├── ai/
│   └── ai-integration.md         # AI integration documentation
├── logs/
│   └── combined-logs.txt        # Consolidated log files
├── requirements/
│   └── requirements.md          # Project requirements
├── technical/
│   └── technical-documentation.md # Technical documentation
├── general/
│   └── general-documentation.md  # General project documentation
└── reports/
    └── consolidated-reports.md   # Project reports
```

## Documentation Categories

### AI Documentation (`/ai`)

- AI service integration
- Model configurations
- Arabic language support
- Performance considerations
- Error handling

### Logs (`/logs`)

- Server logs
- Error logs
- Database logs
- WebSocket logs
- Mock server logs

### Requirements (`/requirements`)

- System requirements
- Dependencies
- Environment setup
- Development requirements
- Production requirements

### Technical Documentation (`/technical`)

- Database schema
- System architecture
- API documentation
- Testing structure
- Performance optimization

### General Documentation (`/general`)

- Project overview
- Getting started
- Contributing guidelines
- Change log
- License information

### Reports (`/reports`)

- Status reports
- Performance reports
- Audit reports
- Change reports

## Usage Guidelines

### Accessing Documentation

1. Navigate to the appropriate category directory
2. Open the relevant markdown file
3. Use the table of contents for quick navigation

### Contributing to Documentation

1. Follow the established format
2. Update table of contents
3. Use proper markdown syntax
4. Include code examples where relevant

### Maintaining Documentation

1. Regular updates
2. Version control
3. Review process
4. Backup procedures

## Backup and Recovery

### Backup Location

```
backups/docs/
```

### Recovery Procedure

```bash
# Restore all documentation
cp -r backups/docs/* docs/

# Restore specific category
cp -r backups/docs/category_name/* docs/category_name/
```

## Search and Navigation

### Quick Links

- [AI Integration](ai/ai-integration.md)
- [Technical Documentation](technical/technical-documentation.md)
- [Requirements](requirements/requirements.md)
- [General Documentation](general/general-documentation.md)
- [Reports](reports/consolidated-reports.md)

### Search Tips

1. Use the file structure for navigation
2. Search within specific categories
3. Use document outlines
4. Reference the table of contents

## Maintenance Schedule

### Regular Updates

- Daily log rotation
- Weekly report updates
- Monthly documentation review
- Quarterly cleanup

### Version Control

- Document versions tracked in Git
- Change history maintained
- Backup schedule
- Recovery testing

## Contact Information

### Documentation Maintainers

- Technical Documentation Team
- AI Integration Team
- Development Team
- Operations Team

### Support Channels

- Issue tracking system
- Documentation chat
- Team communication
- Emergency contacts
