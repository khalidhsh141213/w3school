# Trading Platform Guide

## Overview

This document consolidates key information from various documentation files into a comprehensive guide for development, operation, and maintenance of the trading platform.

## Architecture Overview

### Core Components

- **Full-stack TypeScript/Node.js with React frontend**: Modern, type-safe codebase
- **PostgreSQL database with Drizzle ORM**: Robust data storage with ORM
- **WebSocket server for real-time data**: Efficient real-time market updates
- **Polygon.io integration**: Source for market data
- **AI-powered customer support**: Multi-language conversational support
- **Circuit breaker pattern**: Prevent service overload during outages
- **Message queuing system**: Efficient handling of high-volume WebSocket traffic

### Real-Time Features

- Enhanced WebSocket connections with:
  - Intelligent connection pooling
  - Exponential backoff for reconnections
  - Subscription batching and deduplication
  - Proper error handling for connection limits
  - Cleanup of unused subscriptions
  - Message queuing for high volume
- Market ticker with resilient updates
- Portfolio value real-time calculations

## WebSocket Best Practices

### Core Principles

1. **Reserved for Real-time Data Only**: Use WebSockets only for data requiring real-time updates
2. **Use REST for Less Frequent Updates**: Use REST API for assets without continuous updates
3. **Handle Disconnections**: Implement automatic reconnection mechanisms
4. **Limit Subscriptions**: Apply limits to prevent exceeding usage quotas

### Using WebSocketManager

- Central component for managing WebSocket communications
- Provides unified interface for connections, messages, and subscriptions
- Implemented as a Singleton pattern for connection reuse
- Handles subscription management and cleanup

### Error Handling and Reconnection

The WebSocketManager includes advanced error handling:

1. **Circuit Breaker**: Prevents repeated reconnection attempts during server issues
2. **Rate Limiter**: Controls message flow to prevent service overload
3. **Message Queue**: Maintains messages when connection is down
4. **Automatic Reconnection**: Intelligently retries connections after failures

## Polygon API Integration

### Configuration

- Requires API keys for both REST and WebSocket access
- Separate keys for development and production environments
- WebSocket authentication must be done before subscribing to data

### Data Streams

- **Stocks**: `/AM/{symbol}` for minute aggregates
- **Crypto**: `XT.{symbol}` for trades, `XA.{symbol}` for aggregates
- **Forex**: `C.{symbol}` for trades, `CA.{symbol}` for aggregates

### Best Practices

- Implement rate limiting to avoid hitting API quotas
- Cache responses to reduce API calls
- Handle authentication errors properly
- Batch subscriptions for multiple symbols

## Testing Strategy

### Testing Stack

- Jest for unit testing
- React Testing Library for component testing
- MSW for API mocking
- Cypress for E2E testing

### Key Test Files

- `test-polygon-websocket.js`: Tests WebSocket connection to Polygon.io
- `test-polygon-api.js`: Tests REST API integration with Polygon.io
- `test-ai-service.js`: Tests AI service functionality

## Startup Commands

### Main Application Commands

- `npm run dev`: Start app in development mode
- `npm run start`: Start app in production mode
- `npm run build`: Build app for production
- `bash scripts/start/start-all-services.sh`: Start all services at once

### Database Management

- `npm run db:migrate`: Run database migrations
- `npm run db:setup`: Set up database tables and initial data
- `npm run db:verify-optimizations`: Verify database optimizations

### Market Data Management

- `npm run market:update`: Update market data immediately
- `npm run market:update:cron`: Schedule automatic updates
- `node scripts/update-market-data.js`: Run market data update directly

## Recommendations for Improvement

### Service Management

- Implement service health endpoints (`/health`)
- Use PM2 or Docker for better process lifecycle management
- Separate service configurations for independent restarts

### Database Optimization

- Improve migration management
- Add performance indexes
- Implement data partitioning for historical data

### WebSocket Architecture

- Implement topic-based channel pattern
- Enhance connection management
- Add rate limiting protection

### AI Integration

- Use task queues for AI requests
- Implement prediction caching
- Consider stateless server approach

### Security Enhancements

- Implement strong authentication with short-lived JWTs
- Use Role-Based Access Control (RBAC)
- Implement API rate limiting and input validation
- Encrypt sensitive financial and personal data

## Current Issues and Future Work

### Current Issues

1. **WebSocket Connection Stability**: Enhance reconnection and error handling
2. **Type Definition Coverage**: Fix remaining TypeScript errors
3. **Performance Optimization**: Implement selective updates and caching
4. **Market Data Integration**: Enhance real-time updates and error recovery
5. **Mobile Responsiveness**: Improve layout adaptability on mobile devices

### Next Steps

1. Resolve WebSocket stability issues
2. Complete type definition coverage
3. Implement comprehensive monitoring
4. Optimize mobile experience
5. Enhance error recovery mechanisms
6. Implement additional trading features
7. Expand market data coverage
8. Enhance AI capabilities

This guide consolidates information from multiple documentation files to provide a comprehensive reference for working with the trading platform. Refer to specific documentation files for more detailed information on each topic.
