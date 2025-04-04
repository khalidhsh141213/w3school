# WebSocket Integration Guide

## WebSocket Manager Architecture

Located in `client/src/services/WebSocketManagerSingleton.ts` and used through `client/src/hooks/useWebSocketManager.tsx`

The application uses a Singleton pattern for WebSocket connections to ensure only one active connection exists for each WebSocket endpoint. This approach minimizes resource usage and prevents connection limit issues.

## External WebSocket Connections (Polygon.io)

For direct connections to Polygon.io:

- A dedicated hardcoded WebSocket API key is used specifically for WebSocket connections
- Authentication must succeed before subscribing to data channels
- Connection parameters vary by asset type (crypto, forex, stocks)

## Usage in Components

```typescript
import { useWebSocketManager } from '@/hooks/useWebSocketManager';
import { ConnectionStatus } from '@/services/WebSocketManagerSingleton';

function Component() {
  // Use the WebSocketManager hook
  const { status, send, subscribe } = useWebSocketManager();

  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    if (status !== ConnectionStatus.CONNECTED) return;

    // Create a message handler function
    const handleMessage = (data: any) => {
      // Process different message types (marketUpdate, marketData, etc.)
      console.log('WebSocket message received:', data);
    };

    // Subscribe to WebSocket updates
    const unsubscribe = subscribe('marketUpdate', handleMessage);

    // Send a subscription message for specific symbols
    send('subscribe', {
      channel: 'market',
      symbols: ['BTC/USD', 'ETH/USD']
    });

    // Clean up subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [status, subscribe, send]);

  // Display connection status
  return (
    <div>
      {status === ConnectionStatus.CONNECTED && <span>Connected</span>}
      {status === ConnectionStatus.CONNECTING && <span>Connecting...</span>}
      {status === ConnectionStatus.ERROR && <span>Connection Error</span>}
    </div>
  );
}
```

## Message Types

- `marketUpdate`: Real-time individual asset updates with format:

  ```typescript
  {
    type: 'marketUpdate',
    symbol: string,
    price: number,
    changePercent: number,
    timestamp?: number
  }
  ```

- `marketData`: Batch updates for multiple assets with format:

  ```typescript
  {
    type: 'marketData',
    data: Array<{
      symbol: string,
      price: number,
      changePercent: number
    }>
  }
  ```

- `tradeConfirmation`: Trade confirmations
- `systemStatus`: System status updates

## WebSocket URL Construction

The WebSocket URL is dynamically constructed based on the environment:

```typescript
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const host = window.location.host;
const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${host}/ws`;
```

## Error Handling

- The WebSocketManager includes automatic reconnection logic
- Components should handle `ConnectionStatus.ERROR` states appropriately
- Use the `reconnect` action to manually trigger reconnection:
  ```typescript
  send("reconnect", {});
  ```
