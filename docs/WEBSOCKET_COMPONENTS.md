# WebSocket Components Guide

This document provides a comprehensive overview of the key WebSocket components in the trading platform, their responsibilities, and how they work together.

## Core Components

### 1. WebSocketManager

**Path**: `/client/src/services/WebSocketManager.ts`

**Responsibility**:

- Central manager for all WebSocket connections
- Handles connection lifecycle (connect, disconnect, reconnect)
- Implements circuit breaker pattern to prevent reconnection storms
- Handles message serialization and deserialization
- Manages subscriptions and message routing

**Key Features**:

- Singleton pattern to ensure single connection per endpoint
- Exponential backoff for reconnection attempts
- Heartbeat mechanism to detect dead connections
- Rate limiting to prevent overwhelming the server
- Connection status tracking and reporting

**Usage Example**:

```typescript
import {
  WebSocketManager,
  ConnectionStatus,
} from "@/services/WebSocketManager";

// Get instance
const manager = WebSocketManager.getInstance();

// Connect
manager.connect("wss://example.com/ws");

// Subscribe to messages
manager.subscribe("marketUpdate", (data) => {
  console.log("Received market update:", data);
});

// Send message
manager.send({
  type: "subscribe",
  symbols: ["BTC-USD", "ETH-USD"],
});

// Check connection status
if (manager.getStatus() === ConnectionStatus.CONNECTED) {
  // Connection is active
}
```

### 2. useWebSocketManager Hook

**Path**: `/client/src/hooks/useWebSocketManager.tsx`

**Responsibility**:

- React hook that provides components with access to WebSocketManager
- Handles React-specific lifecycle integration
- Manages WebSocket URL construction based on environment
- Provides simplified interface for React components

**Key Features**:

- Automatically manages subscriptions based on component lifecycle
- Handles proper cleanup on component unmount
- Provides connection status for UI feedback
- Environment-aware WebSocket URL construction

**Usage Example**:

```typescript
import { useWebSocketManager } from '@/hooks/useWebSocketManager';

function MyComponent() {
  const {
    status,
    connected,
    send,
    subscribe
  } = useWebSocketManager();

  useEffect(() => {
    // Subscribe to messages
    const unsubscribe = subscribe((message) => {
      if (message.type === 'priceUpdate') {
        // Handle price update
      }
    });

    // Send subscription request
    send({
      action: 'subscribe',
      symbols: ['BTC-USD']
    });

    // Cleanup on unmount
    return unsubscribe;
  }, [subscribe, send]);

  return (
    <div>
      Connection status: {status}
      {/* Component UI */}
    </div>
  );
}
```

### 3. WebSocketStatus Component

**Path**: `/client/src/components/WebSocketStatus.tsx`

**Responsibility**:

- Provides visual feedback on WebSocket connection status
- Allows manual reconnection
- Displays debugging information about the connection
- Shows circuit breaker and rate limiter status

**Key Features**:

- Visual indicators for connection states
- Reconnect button for manual reconnection
- Detailed status information in debug mode
- Customizable appearance

**Usage Example**:

```tsx
import WebSocketStatus from "@/components/WebSocketStatus";

function TradingPage() {
  return (
    <div>
      {/* Other components */}
      <WebSocketStatus
        url="wss://example.com/ws"
        onReconnect={handleReconnect}
        showDebugInfo={true}
      />
    </div>
  );
}
```

### 4. server/websocket.ts

**Path**: `/server/websocket.ts`

**Responsibility**:

- Server-side WebSocket handler
- Manages client connections and subscriptions
- Broadcasts market data updates to subscribed clients
- Handles authentication and authorization

**Key Features**:

- Topic-based subscription management
- Client connection tracking
- Message queuing for high-volume periods
- Rate limiting and circuit breaking
- Connection cleanup and monitoring

**Usage Example**:

```typescript
// Server-side initialization
import { setupWebSocketServer } from "./websocket";
import { createServer } from "http";

const server = createServer();
const wss = setupWebSocketServer(server);

// Broadcast market update to all subscribed clients
wss.broadcast("marketUpdate", {
  symbol: "BTC-USD",
  price: 50000,
  change: 2.5,
  volume: 1000,
});
```

## Connection Flow

The WebSocket connection flow involves the following steps:

1. **URL Construction**:

   - useWebSocketManager determines the correct WebSocket URL
   - For Replit environment, special handling is applied
   - Protocol (ws/wss) is selected based on the current page protocol

2. **Connection Initialization**:

   - WebSocketManager creates a new WebSocket connection
   - Connection status is set to CONNECTING
   - Event handlers are attached for open, close, error, and message events

3. **Authentication**:

   - After connection is established, authentication message is sent
   - For Polygon.io, API key is included in authentication message
   - For internal WebSocket server, user credentials or session token is used

4. **Subscription**:

   - Components subscribe to specific message types
   - WebSocketManager sends subscription messages to the server
   - Server registers client for the requested topics

5. **Message Handling**:

   - Server sends messages to subscribed clients
   - WebSocketManager processes incoming messages
   - Messages are routed to registered handlers

6. **Reconnection**:

   - If connection is lost, WebSocketManager initiates reconnection
   - Exponential backoff is applied to prevent reconnection storms
   - Circuit breaker may prevent reconnection in case of persistent failures

7. **Cleanup**:
   - When components unmount, they unsubscribe from topics
   - If no subscribers remain for a topic, server is notified
   - When all components are unmounted, connection may be closed

## WebSocket Message Types

### Client to Server Messages

#### 1. Authentication

```json
{
  "action": "auth",
  "params": "API_KEY"
}
```

#### 2. Subscribe

```json
{
  "action": "subscribe",
  "symbols": ["BTC-USD", "ETH-USD"]
}
```

#### 3. Unsubscribe

```json
{
  "action": "unsubscribe",
  "symbols": ["BTC-USD"]
}
```

### Server to Client Messages

#### 1. Connection Acknowledgment

```json
{
  "type": "connected",
  "message": "Connected successfully"
}
```

#### 2. Price Update

```json
{
  "type": "priceUpdate",
  "data": {
    "symbol": "BTC-USD",
    "price": 50000,
    "change": 2.5,
    "changePercent": 0.05,
    "volume": 1000,
    "timestamp": "2023-04-03T12:34:56Z"
  }
}
```

#### 3. Error Message

```json
{
  "type": "error",
  "code": "auth_failed",
  "message": "Authentication failed"
}
```

## Best Practices

1. **Always Clean Up Subscriptions**:

   ```typescript
   useEffect(() => {
     const unsubscribe = subscribe(handleMessage);
     return unsubscribe;
   }, [subscribe]);
   ```

2. **Check Connection Status Before Sending**:

   ```typescript
   if (status === ConnectionStatus.CONNECTED) {
     send(message);
   }
   ```

3. **Handle Reconnection Events**:

   ```typescript
   useEffect(() => {
     if (status === ConnectionStatus.CONNECTED) {
       // Resubscribe after reconnection
       send({
         action: "subscribe",
         symbols: symbols,
       });
     }
   }, [status, send, symbols]);
   ```

4. **Batch Subscriptions**:

   ```typescript
   // Good
   send({
     action: "subscribe",
     symbols: ["BTC-USD", "ETH-USD", "LTC-USD"],
   });

   // Avoid
   send({ action: "subscribe", symbols: ["BTC-USD"] });
   send({ action: "subscribe", symbols: ["ETH-USD"] });
   send({ action: "subscribe", symbols: ["LTC-USD"] });
   ```

5. **Implement Proper Error Handling**:
   ```typescript
   subscribe((message) => {
     try {
       // Process message
     } catch (error) {
       console.error("Error processing WebSocket message:", error);
     }
   });
   ```

## Troubleshooting

### Common Issues

1. **Connection Failures**:

   - Check if URL is correct
   - Verify that API keys are valid
   - Check for network connectivity issues
   - Verify that WebSocket server is running

2. **Authentication Failures**:

   - Check API key format
   - Verify that credentials are correct
   - Check if authentication message is properly formatted

3. **Message Not Received**:

   - Verify subscription was successful
   - Check that message handlers are registered
   - Look for any error messages in the console
   - Verify that server is broadcasting messages

4. **Performance Issues**:
   - Reduce number of subscriptions
   - Implement message filtering
   - Check for memory leaks in message handlers
   - Verify cleanup is working properly

### Debugging Tools

1. **WebSocketStatus Component**:

   - Use showDebugInfo option to see detailed status
   - Monitor connection state changes
   - Check circuit breaker and rate limiter status

2. **Console Logging**:

   - Enable debug logs in WebSocketManager
   - Monitor incoming and outgoing messages
   - Track connection status changes

3. **Browser DevTools**:
   - Use Network tab to monitor WebSocket traffic
   - Check for connection errors
   - Analyze message patterns

## WebSocket Usage Examples

### Market Data Updates

```tsx
function MarketDataComponent() {
  const { status, subscribe, send } = useWebSocketManager();
  const [marketData, setMarketData] = useState({});

  useEffect(() => {
    if (status !== ConnectionStatus.CONNECTED) return;

    const unsubscribe = subscribe((message) => {
      if (message.type === "priceUpdate") {
        setMarketData((prev) => ({
          ...prev,
          [message.data.symbol]: message.data,
        }));
      }
    });

    send({
      action: "subscribe",
      symbols: ["BTC-USD", "ETH-USD"],
    });

    return () => {
      unsubscribe();
      send({
        action: "unsubscribe",
        symbols: ["BTC-USD", "ETH-USD"],
      });
    };
  }, [status, subscribe, send]);

  return <div>{/* Render market data */}</div>;
}
```

### Real-Time Chart Updates

```tsx
function RealTimeChart({ symbol }) {
  const { status, subscribe, send } = useWebSocketManager();
  const [prices, setPrices] = useState([]);

  useEffect(() => {
    if (status !== ConnectionStatus.CONNECTED) return;

    const unsubscribe = subscribe((message) => {
      if (message.type === "priceUpdate" && message.data.symbol === symbol) {
        setPrices((prev) => [
          ...prev,
          {
            time: new Date(message.data.timestamp),
            price: message.data.price,
          },
        ]);
      }
    });

    send({
      action: "subscribe",
      symbols: [symbol],
    });

    return () => {
      unsubscribe();
      send({
        action: "unsubscribe",
        symbols: [symbol],
      });
    };
  }, [status, symbol, subscribe, send]);

  return <div>{/* Render chart with prices */}</div>;
}
```

This document provides a comprehensive guide to the WebSocket components in the trading platform. By understanding these components and following the best practices, you can effectively work with real-time data in the application.
