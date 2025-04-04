# WebSocket Usage Guide

## WebSocket Manager

- Centralized connection management
- Automatic reconnection
- Message queuing
- Circuit breaker implementation

## Subscription Management

- Topic-based subscriptions
- Dynamic subscription updates
- Subscription cleanup
- Connection pooling

## Message Types

- Market data updates
- Trade confirmations
- System notifications
- User events

## Error Handling

- Connection failures
- Message parsing errors
- Subscription errors
- Reconnection strategy

## Basic Usage

The WebSocket manager provides a simple interface for connecting to different WebSocket endpoints and managing subscriptions:

```tsx
import { WebSocketManager } from "@/lib/websocket/WebSocketManager";
import { useEffect, useRef } from "react";

function PriceDisplay({ symbol }) {
  const wsManager = useRef(new WebSocketManager());

  useEffect(() => {
    // Connect to the crypto endpoint
    wsManager.current.connect("crypto");

    // Subscribe to updates for a specific symbol
    const handleUpdate = (data) => {
      console.log(`New price for ${symbol}:`, data.price);
    };

    wsManager.current.subscribe(symbol, handleUpdate);

    // Cleanup on unmount
    return () => {
      wsManager.current.unsubscribe(symbol);

      // Close connection if no more subscriptions
      if (wsManager.current.getSubscriptionCount() === 0) {
        wsManager.current.disconnect();
      }
    };
  }, [symbol]);

  // Component JSX
}
```

## Singleton Pattern

The WebSocket manager is designed to be used as a singleton to prevent multiple connections to the same endpoint:

```tsx
// In a services file (e.g., websocketService.ts)
import { WebSocketManager } from "@/lib/websocket/WebSocketManager";

// Create a singleton instance
export const cryptoWebSocket = new WebSocketManager();
export const forexWebSocket = new WebSocketManager();

// In your component
import { cryptoWebSocket } from "@/services/websocketService";

function CryptoTracker() {
  useEffect(() => {
    cryptoWebSocket.connect("crypto");
    cryptoWebSocket.subscribe("BTC-USD", handleUpdate);

    return () => {
      cryptoWebSocket.unsubscribe("BTC-USD");
    };
  }, []);
}
```

## Connection Management

### Connecting to an Endpoint

```tsx
// Connect to a specific endpoint
wsManager.connect("crypto"); // For cryptocurrency data
wsManager.connect("forex"); // For forex market data
wsManager.connect("stocks"); // For stock market data
```

### Checking Connection Status

```tsx
if (wsManager.isConnected()) {
  console.log("WebSocket is connected");
} else {
  console.log("WebSocket is disconnected");
}
```

### Disconnecting

```tsx
// Close the WebSocket connection
wsManager.disconnect();
```

## Subscription Management

### Subscribing to Updates

```tsx
// Subscribe to updates for a specific symbol
const handleUpdate = (data) => {
  console.log("Received update:", data);
  // Process the data
};

wsManager.subscribe("BTC-USD", handleUpdate);
```

### Unsubscribing

```tsx
// Unsubscribe from a specific symbol
wsManager.unsubscribe("BTC-USD");
```

### Checking Subscription Count

```tsx
const count = wsManager.getSubscriptionCount();
console.log(`Active subscriptions: ${count}`);

// Use this to determine whether to disconnect
if (count === 0) {
  wsManager.disconnect();
}
```

## Error Handling

```tsx
// Register an error handler
wsManager.onError((error) => {
  console.error("WebSocket error:", error);
  // Handle the error
});
```

## Integration with React Components

### Using with useRef

```tsx
function MarketDataComponent({ symbol }) {
  const [price, setPrice] = useState(null);
  const wsManager = useRef(new WebSocketManager());

  useEffect(() => {
    // Determine the appropriate endpoint based on the symbol
    const endpoint = symbol.includes("-USD") ? "crypto" : "forex";

    wsManager.current.connect(endpoint);

    const handleUpdate = (data) => {
      setPrice(data.price);
    };

    wsManager.current.subscribe(symbol, handleUpdate);

    return () => {
      wsManager.current.unsubscribe(symbol);
      if (wsManager.current.getSubscriptionCount() === 0) {
        wsManager.current.disconnect();
      }
    };
  }, [symbol]);

  return (
    <div>
      <h2>{symbol}</h2>
      <p>Current Price: {price ? `$${price.toFixed(2)}` : "Loading..."}</p>
    </div>
  );
}
```

### Using with Context API

For global access to WebSocket connections, you can use React Context:

```tsx
// WebSocketContext.tsx
import React, { createContext, useContext, ReactNode } from "react";
import { WebSocketManager } from "@/lib/websocket/WebSocketManager";

const WebSocketContext = createContext<{
  cryptoWs: WebSocketManager;
  forexWs: WebSocketManager;
}>({
  cryptoWs: new WebSocketManager(),
  forexWs: new WebSocketManager(),
});

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Initialize managers
  const cryptoWs = new WebSocketManager();
  const forexWs = new WebSocketManager();

  // Connect to endpoints on provider mount
  React.useEffect(() => {
    cryptoWs.connect("crypto");
    forexWs.connect("forex");

    return () => {
      cryptoWs.disconnect();
      forexWs.disconnect();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ cryptoWs, forexWs }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);

// Usage in components
function CryptoWidget() {
  const { cryptoWs } = useWebSocket();

  useEffect(() => {
    cryptoWs.subscribe("BTC-USD", handleUpdate);

    return () => {
      cryptoWs.unsubscribe("BTC-USD");
    };
  }, []);
}
```

## Best Practices

1. **Use useRef for Component-Specific Instances**:

   ```tsx
   const wsManager = useRef(new WebSocketManager());
   ```

2. **Always Clean Up Subscriptions**:

   ```tsx
   return () => {
     wsManager.current.unsubscribe(symbol);
   };
   ```

3. **Close Connections When No Longer Needed**:

   ```tsx
   if (wsManager.current.getSubscriptionCount() === 0) {
     wsManager.current.disconnect();
   }
   ```

4. **Handle Connection Errors**:

   ```tsx
   wsManager.current.onError((error) => {
     console.error("WebSocket error:", error);
     setError("Connection lost. Retrying...");
   });
   ```

5. **Consider Connection Status in UI**:

   ```tsx
   return (
     <div>
       {wsManager.current.isConnected() ? (
         <p>Connected</p>
       ) : (
         <p>Connecting...</p>
       )}
     </div>
   );
   ```

6. **Use Singleton Pattern for Global Connections**:
   Create shared instances for app-wide use to reduce connection overhead.

7. **Implement Fallback Mechanisms**:
   Have a strategy for handling disconnections or when WebSockets are unavailable.

## Complete Example

Here's a complete example of a component using the WebSocket Manager:

```tsx
import React, { useState, useEffect, useRef } from "react";
import { WebSocketManager } from "@/lib/websocket/WebSocketManager";
import { MarketData } from "@/types";

interface PriceTrackerProps {
  symbol: string;
  onPriceUpdate?: (price: number) => void;
}

const PriceTracker: React.FC<PriceTrackerProps> = ({
  symbol,
  onPriceUpdate,
}) => {
  const [price, setPrice] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const wsManager = useRef<WebSocketManager>(new WebSocketManager());

  useEffect(() => {
    // Determine endpoint based on symbol
    const endpoint = symbol.includes("-USD") ? "crypto" : "forex";

    try {
      // Connect to WebSocket
      wsManager.current.connect(endpoint);
      setIsConnected(true);
      setError(null);

      // Handle connection errors
      wsManager.current.onError((err) => {
        console.error("WebSocket error:", err);
        setError(`Connection error: ${err.message}`);
        setIsConnected(false);
      });

      // Subscribe to price updates
      const handlePriceUpdate = (data: MarketData) => {
        if (data && data.price) {
          setPrice(data.price);
          if (onPriceUpdate) {
            onPriceUpdate(data.price);
          }
        }
      };

      wsManager.current.subscribe(symbol, handlePriceUpdate);

      // Cleanup on unmount
      return () => {
        wsManager.current.unsubscribe(symbol);

        if (wsManager.current.getSubscriptionCount() === 0) {
          wsManager.current.disconnect();
        }
      };
    } catch (err) {
      setError(
        `Failed to connect: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
      setIsConnected(false);
      return () => {};
    }
  }, [symbol, onPriceUpdate]);

  return (
    <div className="price-tracker">
      <div className="status-indicator">
        {isConnected ? (
          <span className="status connected">Connected</span>
        ) : (
          <span className="status disconnected">Disconnected</span>
        )}
      </div>

      <h3>{symbol}</h3>

      {error ? (
        <div className="error-message">{error}</div>
      ) : price === null ? (
        <div className="loading">Waiting for data...</div>
      ) : (
        <div className="price">${price.toFixed(2)}</div>
      )}
    </div>
  );
};

export default PriceTracker;
```
