# Typed API Client Usage Guide

This guide explains how to use the centralized, type-safe API client for making requests to the backend API. This client leverages the shared types to provide a consistent and type-safe interface for all API interactions.

## Basic Usage

The API client is organized by resource category (auth, users, assets, etc.) and provides typed methods for interacting with each endpoint:

```tsx
import api from "@/lib/api";

// Example: Fetch user profile
async function fetchUserProfile(userId: string) {
  try {
    const response = await api.users.getProfile(userId);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    // Handle error
  }
}

// Example: Create an order
async function placeOrder(orderData) {
  try {
    const response = await api.orders.create(orderData);
    return response.data;
  } catch (error) {
    console.error("Failed to place order:", error);
    // Handle error
  }
}
```

## Type Safety

The API client uses TypeScript generics to provide type-safe responses. All endpoints return data typed according to the shared type definitions:

```tsx
// Using the shared types with the API client
import { Order, Asset, ApiResponse } from "@/types";
import api from "@/lib/api";

async function fetchAssetAndPlaceOrder(symbol: string, quantity: number) {
  try {
    // getBySymbol returns ApiResponse<Asset>
    const assetResponse = await api.assets.getBySymbol(symbol);
    const asset = assetResponse.data;

    if (!asset) {
      throw new Error(`Asset not found: ${symbol}`);
    }

    // create returns ApiResponse<Order>
    const orderResponse = await api.orders.create({
      assetId: asset.id,
      symbol: asset.symbol,
      type: "market",
      direction: "buy",
      quantity: quantity,
      leverage: 1,
    });

    return orderResponse.data;
  } catch (error) {
    // Error handling
  }
}
```

## Error Handling

The API client provides consistent error handling through the `ApiError` class:

```tsx
import api, { ApiError } from "@/lib/api";

async function fetchData() {
  try {
    const response = await api.market.getLatestPrice("BTC-USD");
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      // Type-safe error handling
      console.error(`API Error (${error.code}): ${error.message}`);

      if (error.status === 401) {
        // Handle authentication error
      } else if (error.status === 404) {
        // Handle not found error
      } else {
        // Handle other errors
      }
    } else {
      // Handle unexpected errors
      console.error("Unexpected error:", error);
    }
  }
}
```

## Using with React Components

### Simple Component Example

```tsx
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { MarketData } from "@/types";

function PriceDisplay({ symbol }) {
  const [price, setPrice] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPrice() {
      try {
        setLoading(true);
        const response = await api.market.getLatestPrice(symbol);
        setPrice(response.data);
        setError(null);
      } catch (error) {
        setError(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchPrice();
  }, [symbol]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!price) return <div>No data available</div>;

  return (
    <div>
      <h2>{symbol}</h2>
      <p>Current Price: ${price.price.toFixed(2)}</p>
      <p>Change: {price.changePercent}%</p>
    </div>
  );
}
```

### With React Query

For more advanced data fetching, you can combine the API client with React Query:

```tsx
import { useQuery, useMutation } from "@tanstack/react-query";
import api from "@/lib/api";

// Example: Fetch user profile with React Query
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: async () => {
      const response = await api.users.getProfile(userId);
      return response.data;
    },
    enabled: !!userId,
  });
}

// Example: Create order mutation
export function useCreateOrder() {
  return useMutation({
    mutationFn: async (orderData) => {
      const response = await api.orders.create(orderData);
      return response.data;
    },
    onSuccess: (data) => {
      // Handle successful order placement
    },
  });
}

// Usage in component
function OrderForm({ userId, assetId }) {
  const { data: user } = useUserProfile(userId);
  const createOrder = useCreateOrder();

  const handleSubmit = (formData) => {
    createOrder.mutate({
      userId,
      assetId,
      ...formData,
    });
  };

  // Component JSX
}
```

## Pagination Support

The API client handles paginated responses through the `PaginatedResponse<T>` type:

```tsx
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Order } from "@/types";

function OrderHistory({ userId }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await api.orders.getAll(userId, {
          page,
          limit: 10,
          status: "filled",
        });

        setOrders(response.data.items);
        setTotalPages(response.data.totalPages);
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      }
    }

    fetchOrders();
  }, [userId, page]);

  // Component JSX
}
```

## Custom Hooks

Create reusable hooks for common API operations:

```tsx
// hooks/useAsset.ts
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Asset } from "@/types";

export function useAsset(symbol: string) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchAsset() {
      try {
        setLoading(true);
        const response = await api.assets.getBySymbol(symbol);

        if (mounted) {
          setAsset(response.data);
          setError(null);
        }
      } catch (error) {
        if (mounted) {
          setError(
            error instanceof Error ? error : new Error("Failed to fetch asset"),
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    if (symbol) {
      fetchAsset();
    }

    return () => {
      mounted = false;
    };
  }, [symbol]);

  return { asset, loading, error };
}
```

## Best Practices

1. **Type Everything**: Use the shared types from `@/types` for all API interactions.

2. **Consistent Error Handling**: Use try/catch blocks and handle `ApiError` instances appropriately.

3. **Create Custom Hooks**: Abstract API calls into reusable hooks for better code organization.

4. **Use with React Query**: For advanced caching, refetching, and state management, combine the API client with React Query.

5. **Loading and Error States**: Always handle loading and error states in your components.

6. **Cleanup**: When using `useEffect` for API calls, implement proper cleanup to prevent memory leaks.

## Available API Endpoints

The API client includes the following endpoint groups:

- **auth**: Login, register, logout, and get current user
- **users**: Get and update user profiles
- **assets**: Get all assets, get by ID, get by symbol
- **market**: Get latest prices and historical data
- **portfolio**: Get portfolio summary, positions
- **orders**: Create, get, and cancel orders

Refer to the implementation in `src/lib/api.ts` for the complete list of available methods and their parameters.
