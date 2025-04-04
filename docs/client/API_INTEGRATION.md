# API Integration Guide

## API Client Structure

- Located in `src/services/api`
- Uses Axios for HTTP requests
- Includes automatic retry logic
- Implements circuit breaker pattern

## Authentication

- JWT token-based authentication
- Token refresh mechanism
- Session persistence
- Secure token storage

## Available Endpoints

- `/api/auth` - Authentication endpoints
- `/api/market` - Market data endpoints
- `/api/trading` - Trading endpoints
- `/api/user` - User management
- `/api/portfolio` - Portfolio management

## Error Handling

- Standardized error responses
- Network error recovery
- Session expiration handling
- Rate limit handling

## WebSocket Integration

- Real-time market data
- Portfolio updates
- Trade confirmations
- System notifications
