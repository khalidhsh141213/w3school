# API Client Guide

This document provides comprehensive information about our API client implementation, including core features, usage patterns, and best practices.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Key Features](#key-features)
3. [Using the API Client](#using-the-api-client)
4. [Using the useApi Hook](#using-the-useapi-hook)
5. [Schema Validation](#schema-validation)
6. [Error Handling](#error-handling)
7. [Caching Strategy](#caching-strategy)
8. [Best Practices](#best-practices)
9. [Extension Points](#extension-points)

## Architecture Overview

Our API client implements a layered architecture:

1. **Core API Client (`ApiClient.ts`)**: Handles HTTP requests, error normalization, retries, and caching
2. **API Services (`ApiService.ts`)**: Defines endpoints and provides typed methods for API operations
3. **API Hook (`useApi.ts`)**: React hook for declarative API access with loading/error states
4. **Schemas (`schemas.ts`)**: Type definitions and validators for API data

The architecture ensures separation of concerns while providing a consistent approach to API interaction.

## Key Features

### Error Handling

- **Normalized Errors**: All API errors are normalized into a consistent format
- **Error Classification**: Errors are categorized (network, server, authentication, etc.)
- **Detailed Error Information**: Error objects include status, message, and original error details

### Retry Logic

- **Configurable Retries**: Automatically retry failed requests (defaults to 3 attempts)
- **Exponential Backoff**: Increasing delay between retry attempts
- **Selective Retry**: Only retry for specific error types (network errors, server errors)

### Caching

- **Request Caching**: Cache responses based on URL and parameters
- **TTL-based Expiration**: Configurable time-to-live for cached data
- **Cache Invalidation**: Manually invalidate cache for specific requests
- **Automatic Cleanup**: Background process to remove expired cache entries

### Request Customization

- **Timeout Configuration**: Set custom timeouts for requests
- **Custom Headers**: Add request-specific headers
- **Authentication Integration**: Automatic inclusion of auth tokens

## Using the API Client

### Direct Usage

```typescript
import { getApiClient } from "./services/ApiClient";

// Basic GET request
const data = await getApiClient().get("/assets");

// POST request with body
const response = await getApiClient().post("/auth/login", {
  email: "user@example.com",
  password: "password",
});

// Request with custom options
const result = await getApiClient().get("/market-data/quotes", {
  headers: { "X-Custom-Header": "value" },
  timeout: 5000,
  cache: {
    ttl: 60000, // 1 minute
  },
  retry: {
    attempts: 2,
    retryableErrors: ["NETWORK"],
  },
});
```

### Using API Services

```typescript
import { AssetsApi, MarketDataApi } from "./services/ApiService";

// Get all assets
const assets = await AssetsApi.getAll();

// Search for assets
const searchResults = await AssetsApi.search("AAPL");

// Get market data with validation
const marketData = await MarketDataApi.getQuote("AAPL");
```

## Using the useApi Hook

The `useApi` hook provides a declarative way to use the API in React components:

```typescript
import { useApi } from "./hooks/useApi";
import { AssetsApi } from "./services/ApiService";

// Basic usage
const { data, loading, error } = useApi({
  apiMethod: AssetsApi.getAll,
});

// With dependencies (refetches when dependencies change)
const { data, loading, error } = useApi({
  apiMethod: () => AssetsApi.getBySymbol(symbol),
  dependencies: [symbol],
});

// With manual refetch
const { data, loading, error, refetch } = useApi({
  apiMethod: AssetsApi.getTrending,
});

// Conditional fetching
const { data, loading, error } = useApi({
  apiMethod: () => AssetsApi.search(query),
  skip: query.length < 2,
});

// With initial data
const { data, loading, error } = useApi({
  apiMethod: MarketDataApi.getQuotes,
  initialData: cachedQuotes,
});

// With callbacks
const { data, loading, error } = useApi({
  apiMethod: () => TradingApi.createOrder(orderData),
  onSuccess: (data) => {
    showNotification("Order created successfully");
    navigate(`/orders/${data.id}`);
  },
  onError: (error) => {
    showErrorMessage(`Failed to create order: ${error.message}`);
  },
});
```

## Schema Validation

We use Zod for runtime type validation of API responses:

```typescript
// Example validator
const assetValidator = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  // ...other fields
});

// Using validation in API request
const result = await getApiClient().get<Asset>("/assets/AAPL", {
  validation: {
    schema: assetValidator,
  },
});
```

Benefits of schema validation:

1. **Runtime Type Safety**: Catch API inconsistencies at runtime
2. **Self-Documenting**: Schemas serve as documentation for API responses
3. **Error Messages**: Detailed information about validation failures
4. **Type Inference**: TypeScript types are inferred from validators

## Error Handling

### Error Types

```typescript
enum ApiErrorType {
  NETWORK = "NETWORK", // Connection issues
  SERVER = "SERVER", // 5xx errors
  CLIENT = "CLIENT", // 4xx errors (except auth)
  AUTHENTICATION = "AUTH", // 401, 403 errors
  VALIDATION = "VALIDATION", // Schema validation errors
  TIMEOUT = "TIMEOUT", // Request timeout
  UNKNOWN = "UNKNOWN", // Unclassified errors
}
```

### Handling Errors

```typescript
try {
  const data = await AssetsApi.getBySymbol("AAPL");
  // Handle success
} catch (error) {
  if (error instanceof ApiError) {
    switch (error.type) {
      case "AUTHENTICATION":
        // Handle auth error (redirect to login, etc.)
        break;
      case "NETWORK":
        // Handle network error (offline message, etc.)
        break;
      case "VALIDATION":
        // Handle validation error (show field errors, etc.)
        break;
      default:
        // Handle other errors
        break;
    }
  }
}
```

## Caching Strategy

### Cache Configuration

```typescript
// Global cache config (in api.ts)
const CACHE_TTL = {
  SHORT: 30 * 1000, // 30 seconds
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
  VERY_LONG: 2 * 60 * 60 * 1000, // 2 hours
};

// Request-specific cache options
const data = await getApiClient().get("/assets", {
  cache: {
    ttl: CACHE_TTL.MEDIUM,
    key: "custom-cache-key",
  },
});
```

### Cache Invalidation

```typescript
// Invalidate specific cache entry
getApiClient().invalidateCache("/assets/AAPL");

// Invalidate all cache entries that match a pattern
getApiClient().invalidateCacheByPattern("/assets/*");

// Clear entire cache
getApiClient().clearCache();
```

## Best Practices

1. **Use API Services**: Prefer the service layer over direct client usage for better code organization
2. **Implement Schema Validation**: Always validate API responses to ensure data consistency
3. **Handle Loading and Error States**: Always account for loading and error states in UI components
4. **Configure Appropriate Caching**: Use caching for read-only data with appropriate TTL values
5. **Implement Retry for Unreliable Operations**: Add retry logic for network-dependent operations
6. **Cancel Unused Requests**: Use cancellation tokens for requests that might become obsolete

## Extension Points

The API client architecture is designed for extensibility:

1. **Custom Error Handlers**: Register global error handlers for specific error types
2. **Request Interceptors**: Add pre-request processing (e.g., logging, analytics)
3. **Response Interceptors**: Add post-response processing (e.g., data transformation)
4. **Custom Cache Providers**: Implement alternative caching strategies
5. **Middleware Support**: Add request/response middleware for cross-cutting concerns
