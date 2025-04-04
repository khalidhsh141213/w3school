# Polygon.io API Guide

This document provides information on how to use the Polygon.io API in the trading platform.

## API Keys

The trading platform requires two separate API keys for Polygon.io:

1. **REST API Key**: Used for HTTP requests to the Polygon.io REST API

   - Set in the environment variable: `POLYGON_API_KEY`

2. **WebSocket API Key**: Used specifically for WebSocket connections
   - Hardcoded in the WebSocket connection logic for security and reliability
   - Different from the REST API key to maintain separate rate limits

## WebSocket Integration

### Connection Endpoints by Asset Type

The platform connects to different WebSocket endpoints based on asset type:

- **Stocks**: `wss://socket.polygon.io/stocks`
- **Crypto**: `wss://socket.polygon.io/crypto`
- **Forex**: `wss://socket.polygon.io/forex`

### Authentication Flow

All WebSocket connections follow this authentication pattern:

1. Establish connection to the appropriate endpoint
2. Send authentication message immediately after connection:
   ```json
   { "action": "auth", "params": "YOUR_WEBSOCKET_API_KEY" }
   ```
3. Wait for authentication success response:
   ```json
   { "ev": "status", "status": "auth_success", "message": "authenticated" }
   ```
4. Only subscribe to data channels after successful authentication

### Asset-Specific Channel Formats

#### Crypto Assets

Subscribe to these channels for cryptocurrency data:

- `XT.TICKER` - Trades (e.g., `XT.BTC-USD`)
- `XA.TICKER` - Aggregates (e.g., `XA.BTC-USD`)
- `XQ.TICKER` - Quotes (e.g., `XQ.BTC-USD`)
- `XAS.TICKER` - Snapshots (e.g., `XAS.BTC-USD`)

#### Forex Assets

Subscribe to these channels for foreign exchange data:

- `C.TICKER` - Trades (e.g., `C.EUR-USD`)
- `CA.TICKER` - Aggregates (e.g., `CA.EUR-USD`)
- `CAS.TICKER` - Snapshots (e.g., `CAS.EUR-USD`)

### Subscription Example

```javascript
// Establish connection
const ws = new WebSocket("wss://socket.polygon.io/crypto");

// Define authentication and subscription flow
ws.onopen = function () {
  // Step 1: Send authentication
  ws.send(
    JSON.stringify({
      action: "auth",
      params: "YOUR_WEBSOCKET_API_KEY",
    }),
  );
};

// Step 2: Listen for messages
ws.onmessage = function (event) {
  const messages = JSON.parse(event.data);

  // Process each message (Polygon sends arrays of messages)
  messages.forEach((msg) => {
    // Step 3: Check for authentication success
    if (msg.ev === "status" && msg.status === "auth_success") {
      console.log("Authentication successful");

      // Step 4: Subscribe to channels AFTER authentication success
      ws.send(
        JSON.stringify({
          action: "subscribe",
          params: "XT.BTC-USD,XT.ETH-USD,XA.BTC-USD,XA.ETH-USD",
        }),
      );
    }

    // Step 5: Process subscription confirmations
    if (
      msg.ev === "status" &&
      msg.status === "success" &&
      msg.message.includes("subscribed")
    ) {
      console.log(
        `Successfully subscribed to: ${msg.message.split("subscribed to: ")[1]}`,
      );
    }

    // Step 6: Process actual market data
    if (["XT", "XA", "XQ", "XAS", "C", "CA", "CAS"].includes(msg.ev)) {
      console.log("Received market data:", msg);
      // Process market data...
    }
  });
};

// Error and close handlers
ws.onerror = function (error) {
  console.error("WebSocket error:", error);
};

ws.onclose = function (event) {
  console.log(
    `WebSocket closed with code: ${event.code}, reason: ${event.reason}`,
  );
  // Implement reconnection logic here
};
```

## Error Handling and Reconnection

The platform implements sophisticated error handling and reconnection logic:

1. **Connection Verification**

   - Check WebSocket state before attempting operations
   - Never close a WebSocket in CONNECTING state
   - Reset WebSocket to null after proper closure

2. **Reconnection Strategy**

   - Implement exponential backoff starting at 1000ms
   - Cap maximum retry delay at 30 seconds
   - Limit maximum reconnection attempts
   - Reset reconnection counter on successful connection

3. **Error State Management**
   - Track current connection status with enum values
   - Broadcast status changes to subscribed components
   - Provide visual indicators in UI based on connection status

## REST API Fallbacks

When WebSocket connections are unavailable or market is closed:

1. The system falls back to REST API requests
2. Implements smart caching to reduce API calls
3. Periodically refreshes data at configurable intervals

## Usage Best Practices

1. **Subscribe only to needed data**

   - Only subscribe to assets in user's watchlist
   - Unsubscribe when components unmount
   - Group subscriptions when possible

2. **Handle rate limits gracefully**

   - Implement client-side throttling
   - Catch and log rate limit errors
   - Back off automatically when rate limited

3. **Process data efficiently**

   - Only update UI when values actually change
   - Batch process updates for multiple assets
   - Use appropriate data structures for quick lookups

4. **Error resilience**
   - Always validate incoming data
   - Implement fallbacks for missing or corrupt data
   - Log detailed error information for debugging
