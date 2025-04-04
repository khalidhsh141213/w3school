# WebSocket Components Reference

This document provides a comprehensive reference for all WebSocket-related components in our trading platform application. It covers both client and server components, their interactions, and best practices for extending the system.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Client-Side Components](#client-side-components)
3. [Server-Side Components](#server-side-components)
4. [Component Interactions](#component-interactions)
5. [WebSocket Message Types](#websocket-message-types)
6. [Extension Points](#extension-points)
7. [Examples](#examples)

## Architecture Overview

Our WebSocket implementation follows a layered architecture with clear separation of concerns:

```
┌───────────────────────────────────────────────────────┐
│                     UI Components                     │
│ (WatchlistTable, MarketTicker, RealTimeChart, etc.)  │
└───────────────────┬───────────────────────────────────┘
                    │
┌───────────────────▼───────────────────────────────────┐
│                useWebSocketManager                    │
│          (React hook for WebSocket access)            │
└───────────────────┬───────────────────────────────────┘
                    │
┌───────────────────▼───────────────────────────────────┐
│           WebSocketManagerSingleton                   │
│          (Singleton pattern for connection)           │
└───────────────────┬───────────────────────────────────┘
                    │
┌───────────────────▼───────────────────────────────────┐
│                WebSocketManager                       │
│          (Core connection management)                 │
└───────────────────┬───────────────────────────────────┘
                    │
                    ▼
            WebSocket Connection
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│                 Node.js Server                       │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │              websocket.ts                   │    │
│  │     (WebSocket server implementation)       │    │
│  └─────────────────────────────────────────────┘    │
│                      │                               │
│  ┌─────────────────────────────────────────────┐    │
│  │           Polygon WebSocket                 │    │
│  │     (External market data source)           │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## Client-Side Components

### 1. WebSocketManager.ts

The core class responsible for WebSocket connection management:

**Location**: `client/src/services/WebSocketManager.ts`

**Key Responsibilities**:

- Establishing and maintaining WebSocket connections
- Handling connection lifecycle (connect, disconnect, reconnect)
- Implementing the circuit breaker pattern for fault tolerance
- Managing message subscriptions and publishing
- Prioritizing messages for efficient delivery
- Providing heartbeat mechanism

**Key Methods**:

```typescript
connect(): void;
disconnect(): void;
reset(): void;
isConnected(): boolean;
getStatus(): ConnectionStatus;
onStatusChange(listener: (status: ConnectionStatus) => void): void;
subscribe(type: string, handler: (data: any) => void): void;
unsubscribe(type: string, handler: (data: any) => void): void;
send(type: string, data: any, priority?: number): boolean;
```

### 2. WebSocketManagerSingleton.ts

Singleton wrapper that ensures a single WebSocketManager instance:

**Location**: `client/src/services/WebSocketManagerSingleton.ts`

**Key Responsibilities**:

- Maintaining a single instance of WebSocketManager
- Providing a global access point for WebSocket functionality
- Managing WebSocket URL determination
- Handling message routing between components

**Key Methods**:

```typescript
static getInstance(): WebSocketManagerSingleton;
connect(url: string): void;
isConnected(): boolean;
subscribe(url: string, handler: (data: any) => void): void;
unsubscribe(url: string, handler: (data: any) => void): void;
send(url: string, message: any): boolean;
reset(url: string): void;
```

### 3. useWebSocketManager.tsx

React hook that provides WebSocket functionality to components:

**Location**: `client/src/hooks/useWebSocketManager.tsx`

**Key Responsibilities**:

- Exposing WebSocket functionality to React components
- Managing WebSocket URL construction
- Providing component-friendly abstractions
- Handling React component lifecycle integration

**Key Exports**:

```typescript
function useWebSocketManager() {
  // Returns API object with:
  return {
    status, // Current connection status
    subscribe, // Subscribe to message types
    send, // Send messages
    subscribeToMarketData, // Subscribe to market data
    unsubscribeFromMarketData, // Unsubscribe from market data
    subscribeToEconomicEvents, // Subscribe to economic events
    subscribeToPortfolioUpdates, // Subscribe to portfolio updates
    reset, // Reset connection
    isConnected, // Check if connected
  };
}
```

### 4. WebSocketTest.tsx

Component for testing WebSocket connections:

**Location**: `client/src/components/WebSocketTest.tsx`

**Key Responsibilities**:

- Allowing interactive testing of WebSocket connections
- Displaying connection status and metrics
- Sending test messages and displaying responses
- Testing reconnection behavior

## Server-Side Components

### 1. websocket.ts

Main server-side WebSocket implementation:

**Location**: `server/websocket.ts`

**Key Responsibilities**:

- Setting up the WebSocket server
- Handling client connections and messaging
- Implementing connection validation and security
- Managing client subscriptions
- Broadcasting market data updates
- Logging and metrics collection

**Key Functions**:

```typescript
setupWebsocket(server: Server): WebSocketServer;
broadcastMarketUpdates(wss: WebSocketServer, clients: Map<...>): Promise<void>;
sendMarketDataForSymbols(ws: WebSocket, symbols: string[] | null): Promise<void>;
startWebSocketTest(wss: WebSocketServer): NodeJS.Timeout | null;
```

### 2. polygonWebSocket.ts

Polygon.io WebSocket integration:

**Location**: `server/services/polygonWebSocket.ts`

**Key Responsibilities**:

- Connecting to Polygon.io WebSocket API
- Authenticating with API key
- Subscribing to relevant market data channels
- Transforming external data format to internal format
- Managing reconnection to external services

## Component Interactions

### Connection Establishment Flow

1. `useWebSocketManager` hook is used in a React component
2. Hook calls `WebSocketManagerSingleton.getInstance()`
3. Singleton creates `WebSocketManager` if not exists
4. WebSocketManager attempts connection with provided URL
5. Connection status is propagated back to components
6. Components render appropriate UI based on connection status

### Subscription Flow

1. Component calls `subscribe()` from hook
2. Hook forwards to singleton with handler function
3. Singleton manages subscription with WebSocketManager
4. WebSocketManager tracks subscription and sends message
5. Server receives subscription request and updates client mapping
6. Server sends confirmed subscription message
7. When data arrives, propagates through chain to component

### Message Receiving Flow

1. Server receives market data (internal or from Polygon)
2. Server identifies relevant clients with matching subscriptions
3. Server broadcasts updates to subscribed clients
4. Client WebSocketManager receives message
5. Manager identifies message type and notifies subscribers
6. Component handlers receive data and update UI

## WebSocket Message Types

| Message Type   | Direction       | Structure                                                      | Purpose                              |
| -------------- | --------------- | -------------------------------------------------------------- | ------------------------------------ |
| `subscribe`    | Client → Server | `{ type: 'subscribe', symbols: string[] }`                     | Subscribe to market data for symbols |
| `unsubscribe`  | Client → Server | `{ type: 'unsubscribe', symbols?: string[] }`                  | Unsubscribe from market data         |
| `marketUpdate` | Server → Client | `{ type: 'marketUpdate', symbol: string, price: string, ... }` | Single symbol price update           |
| `marketData`   | Server → Client | `{ type: 'marketData', data: Array<MarketUpdate>, ... }`       | Batch price updates                  |
| `ping`/`pong`  | Bidirectional   | `{ type: 'ping'/'pong', timestamp: number }`                   | Connection health check              |
| `error`        | Server → Client | `{ type: 'error', message: string, code: string }`             | Error notification                   |
| `reconnect`    | Server → Client | `{ type: 'reconnect', timestamp: number }`                     | Request client reconnection          |
| `features`     | Bidirectional   | `{ type: 'features', supports: {...} }`                        | Capability negotiation               |

## Extension Points

### Adding New Message Types

1. Define message type interface in `WebSocketMessage.ts`
2. Add message validation in server's `validateWebSocketMessage()`
3. Implement server-side handler in `websocket.ts`
4. Add client-side convenience methods in `WebSocketManager.ts`
5. Expose in `useWebSocketManager` hook if needed

### Adding New Data Sources

1. Create a new connection manager in `server/services/`
2. Implement data transformation to internal format
3. Register with main WebSocket server in `websocket.ts`
4. Update message routing logic if needed

## Examples

### Basic Component Integration

```tsx
import useWebSocketManager from "../hooks/useWebSocketManager";
import { ConnectionStatus } from "../services/WebSocketManagerSingleton";

function PriceDisplay({ symbol }) {
  const [price, setPrice] = useState(null);
  const { status, subscribe, subscribeToMarketData } = useWebSocketManager();

  useEffect(() => {
    if (status !== ConnectionStatus.CONNECTED) return;

    // Subscribe to market data
    subscribeToMarketData(symbol);

    // Handle updates
    const handleUpdate = (data) => {
      if (data.symbol === symbol) {
        setPrice(data.price);
      }
    };

    // Subscribe to market updates
    const unsubscribe = subscribe("marketUpdate", handleUpdate);

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, [symbol, status, subscribe, subscribeToMarketData]);

  return (
    <div>
      <h3>{symbol}</h3>
      {price ? <p className="price">{price}</p> : <p>Loading...</p>}
    </div>
  );
}
```

### Connection Status Display

```tsx
function ConnectionStatus() {
  const { status } = useWebSocketManager();

  return (
    <div className="connection-status">
      {status === ConnectionStatus.CONNECTED && (
        <span className="connected">● Connected</span>
      )}

      {status === ConnectionStatus.CONNECTING && (
        <span className="connecting">● Connecting...</span>
      )}

      {status === ConnectionStatus.RECONNECTING && (
        <span className="reconnecting">● Reconnecting...</span>
      )}

      {status === ConnectionStatus.ERROR && (
        <span className="error">● Connection Error</span>
      )}

      {status === ConnectionStatus.DISCONNECTED && (
        <span className="disconnected">● Disconnected</span>
      )}
    </div>
  );
}
```

### Real-Time Chart Integration

```tsx
function RealTimeChart({ symbol }) {
  const chartRef = useRef(null);
  const { status, subscribe, subscribeToMarketData } = useWebSocketManager();

  useEffect(() => {
    if (status !== ConnectionStatus.CONNECTED || !symbol) return;

    // Initialize chart library
    const chart = initializeChart(chartRef.current);

    // Subscribe to real-time data
    subscribeToMarketData(symbol);

    // Handle data updates
    const handleUpdate = (data) => {
      if (data.symbol === symbol) {
        // Add new price point to chart
        chart.addPoint({
          time: data.timestamp,
          value: parseFloat(data.price),
        });
      }
    };

    const unsubscribe = subscribe("marketUpdate", handleUpdate);

    return () => {
      unsubscribe();
      chart.dispose();
    };
  }, [symbol, status, subscribe, subscribeToMarketData]);

  return <div ref={chartRef} className="chart-container"></div>;
}
```

For more detailed implementation examples, refer to:

- `client/src/components/watchlist/WatchlistTable.tsx`
- `client/src/components/trading/RealTimeChart.tsx`
- `client/src/components/market/MarketTicker.tsx`
