# WebSocket Best Practices and Implementation Guide

This comprehensive document outlines best practices, implementation details, and usage patterns for WebSockets in our trading application.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Connection Management](#connection-management)
4. [Message Handling](#message-handling)
5. [React Integration](#react-integration)
6. [Error Handling and Resilience](#error-handling-and-resilience)
7. [Performance Optimization](#performance-optimization)
8. [Security Considerations](#security-considerations)
9. [Testing WebSockets](#testing-websockets)
10. [Observability and Monitoring](#observability-and-monitoring)
11. [Polygon.io WebSocket Integration](#polygionio-websocket-integration)
12. [Common Patterns and Examples](#common-patterns-and-examples)
13. [Troubleshooting Guide](#troubleshooting-guide)

## Architecture Overview

Our WebSocket implementation follows a layered architecture:

1. **Server WebSocket Layer** (`server/websocket.ts`): Handles all client connections, message validation, and broadcasting
2. **Client WebSocket Manager** (`client/src/services/WebSocketManager.ts`): Core class managing connection, reconnection, and message handling
3. **Singleton Pattern** (`client/src/services/WebSocketManagerSingleton.ts`): Ensures a single, shared connection instance
4. **React Hook** (`client/src/hooks/useWebSocketManager.tsx`): Provides React components with WebSocket functionality
5. **Component Integration** (Various UI components): Consumes WebSocket data with clean separation of concerns

This architecture ensures:

- Connection sharing to minimize resource usage
- Consistent error handling and reconnection logic
- Type safety throughout the WebSocket pipeline
- Clean component code that focuses on business logic

## Core Components

### WebSocketManager

The foundation of our client-side WebSocket implementation:

```typescript
class WebSocketManager {
  // Core functionality
  connect(): void;
  disconnect(): void;
  reset(): void;
  send(type: string, data: any, priority?: number): boolean;

  // Subscription management
  subscribe(type: string, handler: (data: any) => void): void;
  unsubscribe(type: string, handler: (data: any) => void): void;

  // Domain-specific helpers
  subscribeToMarketData(symbol: string): void;
  subscribeToEconomicEvents(categories?: string[]): void;
  subscribeToPortfolioUpdates(userId: string | number): void;
}
```

### WebSocketManagerSingleton

Ensures a single, shared instance across the application:

```typescript
class WebSocketManagerSingleton {
  private static instance: WebSocketManagerSingleton;

  public static getInstance(): WebSocketManagerSingleton;
  public connect(url: string): void;
  public isConnected(): boolean;
  public send(url: string, message: any): boolean;
  // Additional methods...
}
```

### useWebSocketManager Hook

Brings WebSocket functionality to React components:

```typescript
function useWebSocketManager() {
  // Returns an API for components to use
  return {
    status, // Current connection status
    subscribe, // Subscribe to message types
    send, // Send messages
    subscribeToMarketData, // Subscribe to market data for symbols
    unsubscribeFromMarketData, // Unsubscribe from market data
    subscribeToEconomicEvents, // Subscribe to economic events
    subscribeToPortfolioUpdates, // Subscribe to portfolio updates
    reset, // Reset connection
    isConnected, // Check if connected
  };
}
```

## Connection Management

### Using the Singleton Pattern

Always use the singleton pattern to maintain a single WebSocket connection:

```typescript
// Get the shared instance
const wsManager = WebSocketManagerSingleton.getInstance();

// Connect if not already connected
if (!wsManager.isConnected()) {
  wsManager.connect(getWebSocketUrl());
}
```

### Dynamic URL Construction

Proper WebSocket URL construction based on environment:

```typescript
function getWebSocketUrl() {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  // Use environment variable if available
  if (window.ENV && window.ENV.WS_URL) {
    return window.ENV.WS_URL;
  }

  let port = "";
  if (window.location.port) {
    port = `:${window.location.port}`;
  }

  // Special handling for Replit environment
  if (hostname.includes("replit.dev") || hostname.includes("replit.app")) {
    const baseUrl = `${protocol}//${hostname}${port}`;
    return `${baseUrl}/ws`;
  }

  return `${protocol}//${hostname}${port}/ws`;
}
```

### Automatic Reconnection

Our implementation includes robust reconnection with exponential backoff:

```typescript
private scheduleReconnect(): void {
  if (this.reconnectAttempt >= this.options.reconnectAttempts) {
    this.triggerCircuitBreaker();
    return;
  }

  this.reconnectAttempt++;
  const delay = this.reconnectAttempt * this.options.reconnectInterval;

  this.setStatus(ConnectionStatus.RECONNECTING);

  setTimeout(() => {
    this.connect();
  }, delay);
}
```

### Connection Status Monitoring

Track and react to connection state changes:

```typescript
export enum ConnectionStatus {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  RECONNECTING = "reconnecting",
  ERROR = "error",
}

// Register for status updates
wsManager.onStatusChange((status) => {
  console.log(`WebSocket status changed: ${status}`);
  // Update UI or take appropriate action
});
```

## Message Handling

### Type-Safe Messages

Define TypeScript interfaces for all messages:

```typescript
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
  priority?: number;
}

interface MarketUpdate {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  volume?: string;
  timestamp: number;
  // Additional fields
  name?: string;
  assetType?: string;
  sector?: string;
  country?: string;
  high24h?: string | null;
  low24h?: string | null;
}

// Usage with validation
const validatedUpdate = validateWebSocketMessage(update, marketUpdateSchema);
```

### Subscription Management

Subscribe and unsubscribe to specific message types:

```typescript
// In a component
const { subscribe, unsubscribe } = useWebSocketManager();

useEffect(() => {
  // Subscribe to market updates for specific symbols
  const handleMarketUpdate = (data) => {
    if (watchlistSymbols.includes(data.symbol)) {
      updatePriceData(data);
    }
  };

  subscribe("marketUpdate", handleMarketUpdate);

  // Cleanup when component unmounts
  return () => {
    unsubscribe("marketUpdate", handleMarketUpdate);
  };
}, [subscribe, unsubscribe, watchlistSymbols]);
```

### Message Prioritization

Our implementation includes message prioritization:

```typescript
private queueMessage(message: WebSocketMessage): void {
  // Add to queue, sorted by priority (highest first)
  this.messageQueue.push(message);
  this.messageQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // Process queue later
  setTimeout(() => this.processQueue(), 0);
}
```

## React Integration

### Using the useWebSocketManager Hook

```typescript
import useWebSocketManager from "../hooks/useWebSocketManager";

function MarketTicker({ symbols }) {
  const { status, subscribeToMarketData, unsubscribeFromMarketData } =
    useWebSocketManager();
  const [prices, setPrices] = useState({});

  useEffect(() => {
    // Only proceed if connection is ready
    if (status !== ConnectionStatus.CONNECTED) return;

    // Subscribe to relevant symbols
    symbols.forEach((symbol) => subscribeToMarketData(symbol));

    // Create handler for updates
    const handleUpdate = (data) => {
      if (symbols.includes(data.symbol)) {
        setPrices((prev) => ({
          ...prev,
          [data.symbol]: data.price,
        }));
      }
    };

    // Subscribe to marketUpdate events
    const unsubscribe = subscribe("marketUpdate", handleUpdate);

    // Cleanup
    return () => {
      unsubscribe();
      symbols.forEach((symbol) => unsubscribeFromMarketData(symbol));
    };
  }, [
    status,
    symbols,
    subscribe,
    subscribeToMarketData,
    unsubscribeFromMarketData,
  ]);

  // Render ticker with prices...
}
```

### Component Lifecycle Management

Always handle component lifecycle properly:

```typescript
useEffect(() => {
  // Initialize WebSocket connection if needed
  if (!isConnected()) {
    connect();
  }

  // Subscribe to required data
  const subscriptions = symbols.map((symbol) => {
    return subscribeToMarketData(symbol);
  });

  // Clean up on unmount
  return () => {
    // Call all unsubscribe functions
    subscriptions.forEach((unsubscribe) => unsubscribe());
  };
}, [symbols]); // Only re-run when symbols change
```

## Error Handling and Resilience

### Circuit Breaker Pattern

Prevent reconnection storms during service outages:

```typescript
private triggerCircuitBreaker(): void {
  console.warn("[WebSocketManager] Circuit breaker triggered");
  this.circuitOpen = true;
  this.circuitOpenTime = Date.now();

  // Allow one more attempt after the circuit breaker timeout
  setTimeout(() => {
    console.log("[WebSocketManager] Circuit breaker reset timeout reached");
    this.circuitOpen = false;
    this.reconnectAttempt = 0;
    this.connect();
  }, this.options.circuitBreaker.resetTimeout);
}
```

### Heartbeat Mechanism

Detect and recover from dead connections:

```typescript
private startHeartbeat(): void {
  this.clearHeartbeat();

  this.heartbeatTimer = setInterval(() => {
    if (this.status === ConnectionStatus.CONNECTED) {
      // Send heartbeat
      this.sendMessage({
        type: 'heartbeat',
        data: { timestamp: Date.now() },
        timestamp: Date.now(),
        priority: 10 // High priority
      });

      // Set a timeout for the response
      this.heartbeatTimeout = setTimeout(() => {
        console.warn("[WebSocketManager] Heartbeat timeout, connection may be dead");
        this.reset();
      }, this.options.heartbeatTimeout);
    }
  }, this.options.heartbeatInterval);
}
```

### Robust Error Reporting

Log and handle all WebSocket errors:

```typescript
private handleError(event: Event): void {
  console.error("[WebSocketManager] Connection error:", event);
  this.setStatus(ConnectionStatus.ERROR);

  // Report to monitoring service
  if (this.options.errorReporting) {
    this.options.errorReporting.reportError({
      type: 'WEBSOCKET_ERROR',
      url: this.url,
      timestamp: Date.now(),
      reconnectAttempt: this.reconnectAttempt
    });
  }
}
```

## Performance Optimization

### Message Batching

Group related updates into batches:

```typescript
// Server-side batching implementation
if (updates.length > BATCH_SIZE) {
  // Send in batches
  const totalBatches = Math.ceil(updates.length / BATCH_SIZE);

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE);

    // Prepare the message with metadata
    const message = JSON.stringify({
      type: "marketData",
      data: batch,
      batchIndex,
      totalBatches,
      timestamp: Date.now(),
      isComplete: batchIndex === totalBatches - 1, // Mark last batch
    });

    // Send with a slight delay to prevent client overload
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }, batchIndex * 50); // 50ms delay between batches
  }
}
```

### Message Compression

Compress large messages to reduce bandwidth:

```typescript
// Server-side compression for large messages
if (metadata.compression && jsonMessage.length > COMPRESSION_THRESHOLD) {
  try {
    const compressionStart = performance.now();
    const compressed = await gzipPromise(Buffer.from(jsonMessage));
    const compressionEnd = performance.now();

    compressionTimeTotal += compressionEnd - compressionStart;
    totalCompressedSize += compressed.length;

    // Send compressed data with binary flag set
    client.send(compressed, { binary: true });
  } catch (compressionError) {
    // Fallback to uncompressed if compression fails
    client.send(jsonMessage);
  }
} else {
  // Send uncompressed
  client.send(jsonMessage);
}
```

### Selective Subscription

Only subscribe to data that's actually needed:

```typescript
// Bad: subscribing to all market data
wsManager.send("subscribe", { channel: "allMarketData" });

// Good: subscribing only to symbols being displayed
wsManager.send("subscribe", {
  channel: "market",
  symbols: displayedSymbols,
});
```

## Security Considerations

### Validation

Always validate both incoming and outgoing messages:

```typescript
// Server-side validation with schemas
const marketUpdateSchema = z.object({
  symbol: z.string(),
  price: z.string(),
  change: z.string(),
  changePercent: z.string(),
  volume: z.string().optional(),
  timestamp: z.number(),
});

function validateWebSocketMessage(message, schema) {
  try {
    return schema.parse(message);
  } catch (error) {
    console.error("Invalid message format:", error);
    return null;
  }
}

// Usage
const validMessage = validateWebSocketMessage(data, marketUpdateSchema);
if (!validMessage) {
  ws.send(
    JSON.stringify({
      type: "error",
      message: "Invalid message format",
      code: "INVALID_FORMAT",
    }),
  );
  return;
}
```

### Rate Limiting

Prevent abuse by implementing rate limiting:

```typescript
// Server-side rate limiting
const currentRate = client.metadata.requestsPerMinute[currentMinuteIndex];
if (currentRate > 1000) {
  errorHandler.logError(
    new Error(`Client exceeded rate limit: ${currentRate} requests/minute`),
    ErrorType.WEBSOCKET,
    ErrorSeverity.ERROR,
    {
      code: "WS_RATE_LIMIT_EXCEEDED",
      ip: client.metadata.ip,
      rate: currentRate,
    },
  );

  // Send rate limit error
  ws.send(
    JSON.stringify({
      type: "error",
      message: "Rate limit exceeded",
      code: "RATE_LIMIT",
    }),
  );

  // Terminate connection if severe abuse
  if (currentRate > 600) {
    clients.delete(ws);
    ws.terminate();
    return;
  }
}
```

### Authentication and Authorization

Ensure proper authentication for WebSocket connections:

```typescript
// Server-side authentication check for sensitive operations
if (
  data.type === "portfolio_update" &&
  !isAuthenticated(data.userId, data.token)
) {
  ws.send(
    JSON.stringify({
      type: "error",
      message: "Unauthorized request",
      code: "UNAUTHORIZED",
    }),
  );
  return;
}

// Client-side authentication
ws.send(
  JSON.stringify({
    type: "authenticate",
    token: authToken,
  }),
);
```

## Testing WebSockets

### Mock WebSocket for Unit Tests

```typescript
// mock-websocket.ts
export class MockWebSocket extends EventTarget {
  readyState = WebSocket.CONNECTING;

  constructor(url: string) {
    super();
    // Simulate connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
    }, 50);
  }

  send(data: string) {
    // Process the data
    try {
      const parsed = JSON.parse(data);
      // Mock responses based on message type
      if (parsed.type === "ping") {
        this.mockResponse({ type: "pong", timestamp: Date.now() });
      } else if (parsed.type === "subscribe") {
        this.mockResponse({ type: "subscribed", symbols: parsed.symbols });
      }
    } catch (e) {
      console.error("Error in mock WebSocket:", e);
    }
  }

  mockResponse(data: any) {
    this.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify(data),
      }),
    );
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    this.dispatchEvent(new CloseEvent("close"));
  }
}

// Usage in tests
beforeEach(() => {
  // Replace native WebSocket with mock
  global.WebSocket = MockWebSocket as any;
});
```

### WebSocket Test Component

We provide a WebSocketTest component for interactive testing:

```typescript
// Use the component to test WebSocket functionality
<WebSocketTest />
```

This component allows you to:

- Test connection establishment
- Send and receive messages
- Monitor connection status
- Test reconnection behavior
- Measure WebSocket latency

## Observability and Monitoring

### Connection Metrics

Track and report WebSocket connection metrics:

```typescript
// Server-side metrics tracking
interface WebSocketMetrics {
  connectedClients: number;
  messagesReceived: number;
  messagesSent: number;
  errors: number;
  lastBroadcastSize: number;
  lastBroadcastTime: number;
  compressionRatio: number;
  compressionTime: number;
  activeSubscriptions: Map<string, number>; // symbol -> subscriber count
}

// Update and log metrics
function updateMetrics() {
  metrics.connectedClients = wss.clients.size;

  // Log top subscriptions
  const topSubscriptions = [...metrics.activeSubscriptions.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  log(
    `WebSocket metrics: ${metrics.connectedClients} clients, ${metrics.messagesReceived} received, ${metrics.messagesSent} sent, ${metrics.errors} errors`,
  );
}
```

### Client-Side Telemetry

```typescript
// Track WebSocket performance metrics
const wsMetrics = {
  connectAttempts: 0,
  successfulConnects: 0,
  messagesSent: 0,
  messagesReceived: 0,
  errors: 0,
  latency: [],
};

// Report to analytics
function reportWebSocketMetrics() {
  if (window.analytics) {
    window.analytics.track("websocket_metrics", {
      ...wsMetrics,
      averageLatency: wsMetrics.latency.length
        ? wsMetrics.latency.reduce((a, b) => a + b, 0) /
          wsMetrics.latency.length
        : null,
    });
  }
}
```

## Polygon.io WebSocket Integration

Our application connects directly to Polygon.io WebSockets for real-time market data:

### Authentication and Connection

```typescript
function connectPolygonWebSocket() {
  // Different URLs for crypto vs stocks/forex
  const wsUrl = isCrypto
    ? "wss://socket.polygon.io/crypto"
    : "wss://socket.polygon.io/stocks";

  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    // Authenticate with API key
    ws.send(
      JSON.stringify({
        action: "auth",
        params: process.env.POLYGON_API_KEY,
      }),
    );

    // Subscribe to relevant channels
    ws.send(
      JSON.stringify({
        action: "subscribe",
        params: symbols.map((s) => `T.${s}`), // T.AAPL for trades
      }),
    );
  };

  return ws;
}
```

### Asset-Specific Channel Formats

- **Crypto asset subscriptions:**

  - `XT.TICKER` (trades)
  - `XA.TICKER` (aggregates)
  - `XQ.TICKER` (quotes)
  - `XAS.TICKER` (snapshot)

- **Forex asset subscriptions:**

  - `C.TICKER` (trades)
  - `CA.TICKER` (aggregates)
  - `CAS.TICKER` (snapshot)

- **Stock/Equity asset subscriptions:**
  - `T.TICKER` (trades)
  - `A.TICKER` (aggregates)
  - `Q.TICKER` (quotes)
  - `AM.TICKER` (minute bars)

### Message Handling

```typescript
// Handle Polygon.io messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  // Authentication confirmation
  if (data[0]?.status === "connected") {
    console.log("Connected to Polygon.io");
    return;
  }

  // Authentication success
  if (data[0]?.status === "auth_success") {
    console.log("Successfully authenticated with Polygon.io");
    return;
  }

  // Process trade data
  if (data[0]?.ev === "T") {
    // Transform to our internal format
    const trade = data[0];
    const marketUpdate = {
      symbol: trade.sym,
      price: trade.p.toString(),
      volume: trade.s.toString(),
      timestamp: trade.t,
      // Add other fields as needed
    };

    // Broadcast to clients
    broadcastMarketUpdate(marketUpdate);
  }
};
```

## Common Patterns and Examples

### Watching a List of Symbols

```typescript
function WatchlistTable({ symbols }) {
  const { status, subscribe, send } = useWebSocketManager();
  const [marketData, setMarketData] = useState({});

  // Subscribe to updates when component mounts
  useEffect(() => {
    if (status !== ConnectionStatus.CONNECTED || !symbols.length) return;

    // Handler for market updates
    const handleMarketUpdate = (data) => {
      if (data && Array.isArray(data)) {
        // Handle batch updates
        const updates = {};
        data.forEach((update) => {
          if (symbols.includes(update.symbol)) {
            updates[update.symbol] = update;
          }
        });

        if (Object.keys(updates).length > 0) {
          setMarketData((prev) => ({ ...prev, ...updates }));
        }
      } else if (data && symbols.includes(data.symbol)) {
        // Handle single update
        setMarketData((prev) => ({
          ...prev,
          [data.symbol]: data,
        }));
      }
    };

    // Subscribe to market updates
    const unsubscribe = subscribe("marketUpdate", handleMarketUpdate);

    // Send subscription request
    send("subscribe", {
      symbols: symbols,
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
      // Unsubscribe from server
      send("unsubscribe", {
        symbols: symbols,
      });
    };
  }, [symbols, status, subscribe, send]);

  // Render watchlist table...
}
```

### Real-Time Chart Updates

```typescript
function RealTimeChart({ symbol }) {
  const { status, subscribeToMarketData, unsubscribeFromMarketData } =
    useWebSocketManager();
  const [chartData, setChartData] = useState([]);
  const chartRef = useRef(null);

  // Subscribe to market data for this symbol
  useEffect(() => {
    if (status !== ConnectionStatus.CONNECTED || !symbol) return;

    // Subscribe to updates
    const handleUpdate = (data) => {
      if (data.symbol === symbol) {
        setChartData((prev) => {
          const newData = [
            ...prev,
            {
              time: data.timestamp,
              price: parseFloat(data.price),
            },
          ];

          // Keep only last 100 points
          if (newData.length > 100) {
            return newData.slice(-100);
          }
          return newData;
        });

        // Update chart if available
        if (chartRef.current) {
          chartRef.current.update({
            price: parseFloat(data.price),
            time: data.timestamp,
          });
        }
      }
    };

    // Subscribe to market data
    subscribeToMarketData(symbol);
    const unsubscribe = subscribe("marketUpdate", handleUpdate);

    return () => {
      unsubscribe();
      unsubscribeFromMarketData(symbol);
    };
  }, [
    symbol,
    status,
    subscribe,
    subscribeToMarketData,
    unsubscribeFromMarketData,
  ]);

  // Render chart...
}
```

## Troubleshooting Guide

### Common Issues and Solutions

1. **WebSocket Connection Fails**

   _Symptoms:_ Cannot establish WebSocket connection, status stays in CONNECTING or ERROR

   _Solutions:_

   - Check if the WebSocket URL is correct
   - Verify the WebSocket server is running
   - Check for CORS issues (different domain, port, or protocol)
   - Check for network/proxy restrictions
   - Verify Replit environment support using the correct URL construction

   ```javascript
   // Debug WebSocket URL construction
   console.log("[Debug] Protocol:", window.location.protocol);
   console.log("[Debug] Hostname:", window.location.hostname);
   console.log("[Debug] Constructed URL:", getWebSocketUrl());
   ```

2. **Messages Not Being Received**

   _Symptoms:_ WebSocket connects but no updates are received

   _Solutions:_

   - Verify subscription was sent correctly
   - Check that handlers are properly registered
   - Confirm server is sending messages for the subscribed data
   - Look for errors in message parsing
   - Check for rate limiting issues

   ```javascript
   // Add verbose logging to debug message flow
   subscribe("marketUpdate", (data) => {
     console.log("[Debug] Received market update:", data);
     // Regular handler logic...
   });
   ```

3. **Messages Stop After Some Time**

   _Symptoms:_ Updates work initially but stop after a period of time

   _Solutions:_

   - Verify heartbeat mechanism is working
   - Check for firewall/proxy timeouts closing idle connections
   - Verify the WebSocket server hasn't crashed
   - Check for memory leaks causing client-side issues

   ```javascript
   // Implement manual pings to keep connection alive
   setInterval(() => {
     if (ws.readyState === WebSocket.OPEN) {
       ws.send(JSON.stringify({ type: "ping" }));
       console.log("[Debug] Sent ping");
     }
   }, 30000);
   ```

4. **High CPU or Memory Usage**

   _Symptoms:_ Browser becomes sluggish, high resource consumption

   _Solutions:_

   - Limit update frequency on the server side
   - Implement throttling for high-frequency updates
   - Only subscribe to required data
   - Optimize UI rendering to handle updates efficiently
   - Consider using virtual lists for large data sets

   ```javascript
   // Throttle UI updates with useEffect
   useEffect(() => {
     // Update UI at most every 500ms
     const timer = setTimeout(() => {
       updateUI(latestData);
     }, 500);

     return () => clearTimeout(timer);
   }, [latestData]);
   ```

5. **Memory Leaks from WebSocket Subscriptions**

   _Symptoms:_ Increasing memory usage, performance degradation

   _Solutions:_

   - Ensure all subscriptions are cleaned up in useEffect returns
   - Verify that components unmount properly
   - Check for lingering event listeners
   - Use useRef for stable references to functions

   ```javascript
   // Proper cleanup with stable function references
   useEffect(() => {
     const handlerRef = useRef((data) => {
       // Handle message
     });

     subscribe("marketUpdate", handlerRef.current);

     return () => {
       unsubscribe("marketUpdate", handlerRef.current);
     };
   }, [subscribe, unsubscribe]);
   ```

### Debugging Tools

- **WebSocket Test Component**: Use our `<WebSocketTest />` component to interactively test connections
- **Browser DevTools**: Check Network tab with WS filter to inspect WebSocket traffic
- **Console Logging**: Enable verbose logging with `localStorage.setItem('DEBUG_WS', 'true')`
- **Server Logs**: Check server logs for connection issues or message processing errors
