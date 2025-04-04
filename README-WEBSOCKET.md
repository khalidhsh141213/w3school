# WebSocket Implementation - Quick Start Guide

## Overview

This documentation provides a quick-start guide to our comprehensive WebSocket implementation that powers real-time market data in our trading platform. The system supports different data update strategies based on asset types and market hours, with Polygon.io integration for direct market data access.

## Key Components

Our WebSocket architecture consists of:

1. **Server WebSocket Layer** (`server/websocket.ts`)
2. **Client WebSocket Manager** (`client/src/services/WebSocketManager.ts`)
3. **Singleton Pattern** (`client/src/services/WebSocketManagerSingleton.ts`)
4. **React Hook** (`client/src/hooks/useWebSocketManager.tsx`)
5. **UI Components** (e.g., `client/src/components/watchlist/WatchlistTable.tsx`)

## Recent Updates (April 2025)

- **Fixed Polygon.io WebSocket Authentication**: Implemented hardcoded WebSocket API key in connections
- **Improved WebSocket URL Construction**: Added dynamic WebSocket URL detection for all environments
- **Enhanced TypeScript Integration**: Added proper type annotations for all WebSocket-related components
- **Fixed WatchlistTable Component**: Properly integrated with useWebSocketManager hook for real-time updates
- **Circuit Breaker Implementation**: Added circuit breaker pattern to prevent reconnection storms

## Getting Started

### 1. Using the WebSocketManager Hook

```typescript
import useWebSocketManager from "@/hooks/useWebSocketManager";
import { ConnectionStatus } from "@/services/WebSocketManagerSingleton";

function WatchlistComponent() {
  const {
    status,
    subscribe,
    subscribeToMarketData,
    unsubscribeFromMarketData,
  } = useWebSocketManager();

  useEffect(() => {
    // Only proceed when connection is established
    if (status !== ConnectionStatus.CONNECTED) return;

    // Subscribe to market data for specific symbols
    const symbols = ["AAPL", "MSFT", "GOOG"];
    symbols.forEach((symbol) => subscribeToMarketData(symbol));

    // Handle incoming market updates
    const handleMarketUpdate = (data) => {
      if (symbols.includes(data.symbol)) {
        // Update your UI with the new price data
        updatePriceData(data);
      }
    };

    // Subscribe to marketUpdate messages
    const unsubscribe = subscribe("marketUpdate", handleMarketUpdate);

    // Clean up on unmount
    return () => {
      unsubscribe();
      symbols.forEach((symbol) => unsubscribeFromMarketData(symbol));
    };
  }, [status, subscribe, subscribeToMarketData, unsubscribeFromMarketData]);

  // Render your component...
}
```

### 2. Connection Status Handling

```tsx
function ConnectionStatusIndicator() {
  const { status } = useWebSocketManager();

  return (
    <div>
      {status === ConnectionStatus.CONNECTED && (
        <Badge className="bg-green-500">
          <span className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-200 mr-1"></div>
            Live
          </span>
        </Badge>
      )}

      {status === ConnectionStatus.CONNECTING && (
        <Badge className="bg-yellow-500">Connecting...</Badge>
      )}

      {status === ConnectionStatus.ERROR && (
        <Badge className="bg-red-500">Connection Error</Badge>
      )}
    </div>
  );
}
```

### 3. Debugging WebSocket Connections

When having WebSocket connection issues, add this debug code:

```typescript
// Debug WebSocket URL construction
console.log("[WebSocket Debug] Protocol:", window.location.protocol);
console.log("[WebSocket Debug] Hostname:", window.location.hostname);
console.log("[WebSocket Debug] Port:", window.location.port);
console.log("[WebSocket Debug] Constructed URL:", getWebSocketUrl());

// For Replit environments specifically
if (window.location.hostname.includes("replit")) {
  console.log("[WebSocket Debug] Running in Replit environment");
}
```

## Features and Benefits

- **Singleton Pattern**: Ensures a single, shared WebSocket connection across components
- **Automatic Reconnection**: With exponential backoff and circuit breaker pattern
- **Message Prioritization**: Critical messages are processed first during high load
- **Asset-Specific Channels**: Different formats for crypto, forex, and stocks
- **Performance Optimization**: Message batching and selective subscription
- **Type Safety**: Full TypeScript integration for all messages and APIs

## WebSocket Message Types

| Message Type   | Direction       | Purpose                                    |
| -------------- | --------------- | ------------------------------------------ |
| `subscribe`    | Client → Server | Subscribe to symbols or data channels      |
| `unsubscribe`  | Client → Server | Unsubscribe from symbols or channels       |
| `marketUpdate` | Server → Client | Real-time price update for a single symbol |
| `marketData`   | Server → Client | Batch updates for multiple symbols         |
| `heartbeat`    | Bidirectional   | Connection health check                    |
| `error`        | Server → Client | Error notification                         |

## Polygon.io Integration

Our system connects directly to Polygon.io WebSockets for real-time data:

### Asset-Specific Channel Formats

- **Crypto**: `XT.BTC-USD` (trades), `XA.BTC-USD` (aggregates)
- **Forex**: `C.EUR-USD` (trades), `CA.EUR-USD` (aggregates)
- **Stocks**: `T.AAPL` (trades), `Q.AAPL` (quotes), `A.AAPL` (aggregates)

## Comprehensive Documentation

For more detailed documentation, refer to:

- [WebSocket Best Practices](./docs/client/WEBSOCKET_BEST_PRACTICES.md) - Complete implementation guide with code examples
- [WebSocket Enhancements](./docs/client/WEBSOCKET_ENHANCEMENTS.md) - Recent improvements and features
- [Polygon API Guide](./docs/POLYGON_API_GUIDE.md) - Polygon.io integration details

## Testing WebSocket Functionality

We provide a special test component to verify WebSocket connectivity:

```tsx
import { WebSocketTest } from "@/components/WebSocketTest";

// Use this in development to test WebSocket connections
<WebSocketTest />;
```

You can also run our automated test scripts:

```bash
# Test WebSocket connection
node test-websocket-connection.js

# Test Polygon.io WebSocket connection
node polygon-websocket-test.js
```

## Troubleshooting

If you encounter WebSocket issues:

1. **Check the connection URL**: Verify the WebSocket URL construction for your environment
2. **Verify server status**: Ensure the WebSocket server is running
3. **Check browser console**: Look for connection errors and WebSocket status logs
4. **Test in WebSocketTest component**: Use our interactive testing component
5. **Check message format**: Ensure your subscription messages follow the correct format

For detailed troubleshooting, see the [Troubleshooting Guide](./docs/client/WEBSOCKET_BEST_PRACTICES.md#troubleshooting-guide) section in our best practices document.
