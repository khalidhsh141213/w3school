# API Integration Guide

## Core API Client

The API client is located in `src/services/api/client.ts` and provides type-safe API interactions.

### Basic Usage

```typescript
import { useApi } from "@/hooks/useApi";

function Component() {
  const { data, isLoading } = useApi("/endpoint");
}
```

## Authentication

All authenticated endpoints require a valid JWT token in the Authorization header.

## Error Handling

The API client includes built-in error handling and retry logic for failed requests.
