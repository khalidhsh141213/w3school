import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { DatabaseStorage } from "./storage.js";

// Create an instance of the storage class
const storage = new DatabaseStorage();
import { log } from "./vite.js";
import zlib from "zlib";
import { promisify } from "util";
import {
  validateWebSocketMessage,
  marketUpdateSchema,
  subscriptionSchema,
  unsubscriptionSchema,
} from "./validation.js";
import { marketDataCache } from "./cache.js";
import {
  errorHandler,
  ErrorType,
  ErrorSeverity,
} from "./services/errorHandlingService.js";
import { performance } from "perf_hooks";
import {
  registerNotificationClient,
  unregisterNotificationClient,
  getUnseenNotifications,
  markNotificationsAsSeen,
  startNotificationService,
} from "./services/notificationService.js";
import { sendTestMarketData } from "./send-test-market-data.js";

// Use the validated type from our schema
type MarketUpdate = {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  volume?: string;
  timestamp: number;
  // Additional fields for enhanced client experience
  name?: string;
  assetType?: string;
  sector?: string;
  country?: string;
  high24h?: string | null;
  low24h?: string | null;
};

// Message batching config
const BATCH_SIZE = 50; // Max number of updates to include in a single message

// Compression helpers
const gzipPromise = promisify(zlib.gzip);
const COMPRESSION_THRESHOLD = 1024; // Only compress messages larger than 1KB

// System metrics
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

// Tracking metrics
const metrics: WebSocketMetrics = {
  connectedClients: 0,
  messagesReceived: 0,
  messagesSent: 0,
  errors: 0,
  lastBroadcastSize: 0,
  lastBroadcastTime: 0,
  compressionRatio: 0,
  compressionTime: 0,
  activeSubscriptions: new Map(),
};

// Track per-client metrics
interface ClientMetadata {
  isAlive: boolean;
  connectedAt: number;
  lastActivity: number;
  messageCount: number;
  subscriptionCount: number;
  ip?: string;
  compression: boolean;
  requestsPerMinute: number[];
  rpmTimestamp: number;
}

export function setupWebsocket(server: Server): WebSocketServer {
  // Creating WebSocket server with better error handling
  const wss = new WebSocketServer({
    server,
    // IMPORTANT: For Replit, we must NOT use a path at all
    // This is critical for Replit routing to work correctly
    noServer: false, // Use the http server directly
    // Add heartbeat checking
    clientTracking: true,
    // Increase max payload size for efficiency
    maxPayload: 1024 * 1024, // 1MB max payload
    // Add request rate throttling
    verifyClient: (info, callback) => {
      // Could add IP-based rate limiting here if needed
      // Log verification attempts for debugging
      log(
        `WebSocket verification request from ${info.req.socket.remoteAddress}`,
        "websocket",
      );
      callback(true);
    },
  });

  log("WebSocket server initialized", "websocket");

  // Track connected clients with subscription preferences and metadata
  const clients = new Map<
    WebSocket,
    {
      subscriptions: Set<string>;
      metadata: ClientMetadata;
    }
  >();

  // Implement ping/pong for detecting disconnected clients
  // Increase interval to reduce overhead and prevent false disconnects
  const pingInterval = setInterval(() => {
    let deadClients = 0;

    wss.clients.forEach((ws) => {
      const client = clients.get(ws);

      if (!client) {
        // Client data missing, terminate connection
        ws.terminate();
        deadClients++;
        return;
      }

      // Handle clients already marked as not alive
      if (!client.metadata.isAlive) {
        // Send a test ping first before terminating
        try {
          ws.ping(() => {});

          // Give a bit more slack time for truly dead connections
          // This prevents false terminations due to network hiccups
          setTimeout(() => {
            if (clients.has(ws) && !clients.get(ws)?.metadata.isAlive) {
              log("Client failed to respond to pong, terminating", "websocket");
              clients.delete(ws);
              ws.terminate();
            }
          }, 5000);
        } catch (e) {
          // Error sending ping, client is definitely dead
          clients.delete(ws);
          ws.terminate();
          deadClients++;
        }
        return;
      }

      // Only mark as not alive for next cycle
      client.metadata.isAlive = false;

      // Send ping in a try-catch to handle immediate errors
      try {
        ws.ping(() => {});
      } catch (e) {
        log(`Error sending ping: ${e}`, "websocket");
        clients.delete(ws);
        ws.terminate();
        deadClients++;
        return;
      }

      // Check for extremely long idle clients (inactive for > 30 minutes)
      // Increased from 10 minutes to reduce false disconnects
      const idleTime = Date.now() - client.metadata.lastActivity;
      if (idleTime > 30 * 60 * 1000) {
        log(
          `Terminating idle client (inactive for ${Math.round(idleTime / 1000)}s)`,
          "websocket",
        );
        clients.delete(ws);
        ws.terminate();
        deadClients++;
      }

      // Check client request rate (per minute)
      const now = Date.now();
      if (now - client.metadata.rpmTimestamp > 60000) {
        // Reset RPM counter every minute
        client.metadata.requestsPerMinute = [0];
        client.metadata.rpmTimestamp = now;
      }
    });

    if (deadClients > 0) {
      log(`Cleaned up ${deadClients} dead connections`, "websocket");
      updateMetrics(wss, clients);
    }
  }, 60000); // Increased from 30s to 60s

  // Periodically update subscription metrics
  const metricsInterval = setInterval(() => {
    updateMetrics(wss, clients);
  }, 60000);

  // Clean up interval on server close
  wss.on("close", () => {
    clearInterval(pingInterval);
    clearInterval(metricsInterval);
  });

  // Handle connection
  wss.on("connection", (ws: WebSocket, req) => {
    // Create client metadata
    const metadata: ClientMetadata = {
      isAlive: true,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      subscriptionCount: 0,
      ip: req.socket.remoteAddress,
      compression: false, // Will negotiate compression if client supports it
      requestsPerMinute: [0],
      rpmTimestamp: Date.now(),
    };

    // Track client by default with empty subscription set
    clients.set(ws, {
      subscriptions: new Set<string>(),
      metadata,
    });

    // Update metrics
    metrics.connectedClients = wss.clients.size;
    log(`Client connected (${wss.clients.size} total)`, "websocket");

    // Register pong responder to keep connection alive
    ws.on("pong", () => {
      const client = clients.get(ws);
      if (client) {
        client.metadata.isAlive = true;
        client.metadata.lastActivity = Date.now();
      }
    });

    // Send initial market data
    sendInitialMarketData(ws);

    // Handle client messages with validation and rate limiting
    ws.on("message", async (message: string) => {
      try {
        // Update activity timestamp and message count
        const client = clients.get(ws);
        if (!client) return;

        client.metadata.lastActivity = Date.now();
        client.metadata.messageCount++;

        // Rate limiting - track requests per minute
        const currentMinuteIndex = client.metadata.requestsPerMinute.length - 1;
        client.metadata.requestsPerMinute[currentMinuteIndex]++;

        // Basic rate limiting - if client exceeds 1000 messages per minute
        const currentRate =
          client.metadata.requestsPerMinute[currentMinuteIndex];
        if (currentRate > 1000) {
          errorHandler.logError(
            new Error(
              `Client exceeded rate limit: ${currentRate} requests/minute`,
            ),
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

          return;
        }

        metrics.messagesReceived++;
        const data = JSON.parse(message.toString());

        // Feature negotiation
        if (data.type === "features") {
          const response = {
            type: "features",
            supported: {
              compression: true,
              throttling: true,
              batchProcessing: true,
              circuitBreaker: true,
            },
          };

          // Update client capabilities
          if (data.supports && typeof data.supports === "object") {
            client.metadata.compression = !!data.supports.compression;
          }

          ws.send(JSON.stringify(response));
          return;
        }

        // Handle subscription
        if (data.type === "subscribe") {
          // Validate subscription message
          const validSubscription = validateWebSocketMessage(
            data,
            subscriptionSchema,
          );

          if (!validSubscription) {
            // Send error message back to client
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Invalid subscription format",
                code: "INVALID_FORMAT",
              }),
            );
            return;
          }

          // Handle subscription to specific symbols
          const { subscriptions } = client;
          validSubscription.symbols.forEach((symbol: string) => {
            subscriptions.add(symbol);

            // Update global subscription metrics
            const count = metrics.activeSubscriptions.get(symbol) || 0;
            metrics.activeSubscriptions.set(symbol, count + 1);
          });

          client.metadata.subscriptionCount = subscriptions.size;

          // Send confirmation
          ws.send(
            JSON.stringify({
              type: "subscribed",
              symbols: Array.from(subscriptions),
              timestamp: Date.now(),
            }),
          );

          log(
            `Client subscribed to symbols: ${Array.from(subscriptions).join(", ")}`,
            "websocket",
          );
        } else if (data.type === "unsubscribe") {
          // Validate unsubscription message
          const validUnsubscription = validateWebSocketMessage(
            data,
            unsubscriptionSchema,
          );

          if (!validUnsubscription) {
            // Send error message back to client
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Invalid unsubscription format",
                code: "INVALID_FORMAT",
              }),
            );
            return;
          }

          // Handle unsubscription
          const { subscriptions } = client;

          // If no symbols specified, clear all subscriptions
          if (
            !validUnsubscription.symbols ||
            validUnsubscription.symbols.length === 0
          ) {
            // Update global subscription metrics first
            subscriptions.forEach((symbol) => {
              const count = metrics.activeSubscriptions.get(symbol) || 0;
              if (count > 0) {
                metrics.activeSubscriptions.set(symbol, count - 1);
              }
            });

            subscriptions.clear();
            client.metadata.subscriptionCount = 0;
            log("Client unsubscribed from all symbols", "websocket");
          } else {
            // Remove specific symbols
            validUnsubscription.symbols.forEach((symbol: string) => {
              if (subscriptions.has(symbol)) {
                subscriptions.delete(symbol);

                // Update global subscription metrics
                const count = metrics.activeSubscriptions.get(symbol) || 0;
                if (count > 0) {
                  metrics.activeSubscriptions.set(symbol, count - 1);
                }
              }
            });

            client.metadata.subscriptionCount = subscriptions.size;
            log(
              `Client unsubscribed from symbols: ${validUnsubscription.symbols.join(", ")}`,
              "websocket",
            );
          }

          // Send confirmation
          ws.send(
            JSON.stringify({
              type: "unsubscribed",
              symbols: Array.from(subscriptions),
              timestamp: Date.now(),
            }),
          );
        } else if (data.type === "ping") {
          // Respond to client-initiated ping
          ws.send(
            JSON.stringify({
              type: "pong",
              timestamp: Date.now(),
              serverTime: new Date().toISOString(),
            }),
          );
        } else if (data.type === "metrics") {
          // Allow clients to request server metrics
          // Security: Only send non-sensitive metrics
          ws.send(
            JSON.stringify({
              type: "metrics",
              data: {
                connectedClients: metrics.connectedClients,
                lastBroadcastTime: metrics.lastBroadcastTime,
                compressionRatio: metrics.compressionRatio,
              },
              timestamp: Date.now(),
            }),
          );
        } else if (data.type === "notifications_register") {
          // Register client for notifications
          if (data.userId && typeof data.userId === "number") {
            registerNotificationClient(data.userId, ws);

            ws.send(
              JSON.stringify({
                type: "notification_registered",
                userId: data.userId,
                timestamp: Date.now(),
              }),
            );

            log(
              `Client registered for notifications: userId=${data.userId}`,
              "websocket",
            );
          } else {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Invalid userId for notification registration",
                code: "INVALID_USER_ID",
              }),
            );
          }
        } else if (data.type === "notifications_get") {
          // Get unseen notifications
          if (data.userId && typeof data.userId === "number") {
            const notifications = getUnseenNotifications(data.userId);

            ws.send(
              JSON.stringify({
                type: "notifications",
                data: notifications,
                timestamp: Date.now(),
              }),
            );
          } else {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Invalid userId for notification request",
                code: "INVALID_USER_ID",
              }),
            );
          }
        } else if (data.type === "notifications_mark_seen") {
          // Mark notifications as seen
          if (
            data.userId &&
            typeof data.userId === "number" &&
            data.notificationIds &&
            Array.isArray(data.notificationIds)
          ) {
            markNotificationsAsSeen(data.userId, data.notificationIds);

            ws.send(
              JSON.stringify({
                type: "notifications_marked_seen",
                count: data.notificationIds.length,
                timestamp: Date.now(),
              }),
            );
          } else {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Invalid parameters for marking notifications as seen",
                code: "INVALID_PARAMETERS",
              }),
            );
          }
        } else if (data.type === "request_market_data") {
          // Client requesting market data (either all or for specific symbols)
          try {
            // Get all market data if no symbols specified, or filter by requested symbols
            const requestedSymbols =
              data.symbols &&
              Array.isArray(data.symbols) &&
              data.symbols.length > 0
                ? data.symbols
                : null;

            // Use existing method to get and send market data
            sendMarketDataForSymbols(ws, requestedSymbols);

            log(
              `Sent market data on request${requestedSymbols ? " for symbols: " + requestedSymbols.join(", ") : " (all symbols)"}`,
              "websocket",
            );
          } catch (error) {
            errorHandler.logError(
              error,
              ErrorType.WEBSOCKET,
              ErrorSeverity.ERROR,
              { code: "WS_MARKET_DATA_REQUEST_FAILED" },
            );

            ws.send(
              JSON.stringify({
                type: "error",
                message: "Failed to retrieve market data",
                code: "DATA_RETRIEVAL_FAILED",
              }),
            );
          }
        } else if (data.type === "request_asset_details") {
          // Client requesting detailed information about a specific asset
          if (data.symbol && typeof data.symbol === "string") {
            try {
              // Get asset details from storage
              const asset = await storage.getAsset(data.symbol);

              if (asset) {
                // Get the most recent market data
                const marketData = await storage.getMarketData(data.symbol);

                // Combine asset and market data
                const assetDetails = {
                  ...asset,
                  ...(marketData || {}),
                  lastUpdated: new Date().toISOString(),
                };

                ws.send(
                  JSON.stringify({
                    type: "asset_details",
                    data: assetDetails,
                    timestamp: Date.now(),
                  }),
                );

                log(`Sent asset details for ${data.symbol}`, "websocket");
              } else {
                ws.send(
                  JSON.stringify({
                    type: "error",
                    message: `Asset not found: ${data.symbol}`,
                    code: "ASSET_NOT_FOUND",
                  }),
                );
              }
            } catch (error) {
              errorHandler.logError(
                error,
                ErrorType.WEBSOCKET,
                ErrorSeverity.ERROR,
                {
                  code: "WS_ASSET_DETAILS_REQUEST_FAILED",
                  symbol: data.symbol,
                },
              );

              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Failed to retrieve asset details",
                  code: "DATA_RETRIEVAL_FAILED",
                }),
              );
            }
          } else {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Missing or invalid symbol for asset details request",
                code: "INVALID_SYMBOL",
              }),
            );
          }
        } else {
          // Unknown message type
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Unknown message type",
              code: "UNKNOWN_TYPE",
            }),
          );
        }
      } catch (error) {
        // Use error handling service
        errorHandler.logError(error, ErrorType.WEBSOCKET, ErrorSeverity.ERROR, {
          code: "WS_MESSAGE_PROCESSING",
          messageType: "client",
        });

        metrics.errors++;
        log(`Error handling message: ${error}`, "websocket");

        // Send error message back to client
        try {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Failed to process message",
              code: "INTERNAL_ERROR",
            }),
          );
        } catch (e) {
          // Log but ignore errors when trying to send error messages
          errorHandler.logError(e, ErrorType.NETWORK, ErrorSeverity.WARNING, {
            code: "WS_ERROR_SEND_FAILED",
          });
        }
      }
    });

    // Handle disconnection
    ws.on("close", () => {
      // Clean up client tracking on disconnect
      const client = clients.get(ws);

      if (client) {
        // Update global subscription metrics
        client.subscriptions.forEach((symbol) => {
          const count = metrics.activeSubscriptions.get(symbol) || 0;
          if (count > 0) {
            metrics.activeSubscriptions.set(symbol, count - 1);
          }
        });
      }

      clients.delete(ws);
      metrics.connectedClients = wss.clients.size;
      log(`Client disconnected (${wss.clients.size} remaining)`, "websocket");
    });

    // Handle errors
    ws.on("error", (error) => {
      // Use error handling service
      errorHandler.logError(error, ErrorType.NETWORK, ErrorSeverity.ERROR, {
        code: "WS_CONNECTION_ERROR",
        clientCount: wss.clients.size,
      });

      metrics.errors++;
      log(`WebSocket error: ${error}`, "websocket");

      // Try to gracefully terminate on error
      try {
        clients.delete(ws);
        metrics.connectedClients = wss.clients.size;
        ws.terminate();
      } catch (e) {
        // Log but ignore errors during cleanup
        errorHandler.logError(e, ErrorType.NETWORK, ErrorSeverity.WARNING, {
          code: "WS_CONNECTION_CLEANUP_ERROR",
        });
      }
    });
  });

  // Set interval to broadcast market updates with optimized frequency
  const updateInterval = parseInt(process.env.WS_HEARTBEAT_INTERVAL || "5000");
  const broadcastTimer = setInterval(() => {
    broadcastMarketUpdates(wss, clients).catch((error) => {
      errorHandler.logError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
        code: "WS_BROADCAST_TIMER_ERROR",
        clientCount: wss.clients.size,
        timestamp: new Date().toISOString(),
      });
      log(`Error in broadcast timer: ${error}`, "websocket");
    });
  }, updateInterval);

  // Start notification service
  startNotificationService();

  // Ensure cleanup on server shutdown
  server.on("close", () => {
    clearInterval(broadcastTimer);
    clearInterval(pingInterval);
    clearInterval(metricsInterval);

    // Send close notification to all clients
    wss.clients.forEach((client) => {
      try {
        client.send(
          JSON.stringify({
            type: "serverShutdown",
            message: "Server is shutting down",
            timestamp: Date.now(),
          }),
        );
        client.terminate();
      } catch (e) {
        // Ignore errors during shutdown
      }
    });
  });

  return wss;
}

/**
 * Update and log WebSocket metrics
 */
function updateMetrics(
  wss: WebSocketServer,
  clients: Map<
    WebSocket,
    { subscriptions: Set<string>; metadata: ClientMetadata }
  >,
) {
  metrics.connectedClients = wss.clients.size;

  // Clear and recalculate subscription metrics
  metrics.activeSubscriptions.clear();

  // Tally subscriptions
  for (const [_, client] of clients.entries()) {
    for (const symbol of client.subscriptions) {
      const count = metrics.activeSubscriptions.get(symbol) || 0;
      metrics.activeSubscriptions.set(symbol, count + 1);
    }
  }

  // Log top subscriptions
  const topSubscriptions = [...metrics.activeSubscriptions.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (topSubscriptions.length > 0) {
    log(
      `Top subscriptions: ${topSubscriptions.map(([s, c]) => `${s} (${c})`).join(", ")}`,
      "websocket",
    );
  }

  // Log WebSocket metrics
  log(
    `WebSocket metrics: ${wss.clients.size} clients, ${metrics.messagesReceived} messages received, ${metrics.messagesSent} sent, ${metrics.errors} errors`,
    "websocket",
  );
}

/**
 * Send market data for specified symbols, or all symbols if none specified
 * @param ws WebSocket connection to send data to
 * @param symbols Optional array of symbol strings to filter for
 */
async function sendMarketDataForSymbols(
  ws: WebSocket,
  symbols: string[] | null = null,
) {
  try {
    // Try to get data from cache first
    let allMarketData = marketDataCache.get<any[]>("allMarketData");

    // If not in cache, fetch from storage
    if (!allMarketData) {
      try {
        // Get the market data for all available assets
        const assets = await storage.getAllAssets();
        const marketDataItems = await storage.getAllMarketData();

        // Create a map of symbol -> market data for faster lookups
        const marketDataMap = new Map();
        marketDataItems.forEach((item) => marketDataMap.set(item.symbol, item));

        // Generate a combined dataset with asset information and market data
        allMarketData = assets.map((asset) => {
          const symbol = asset.symbol;
          const marketItem = marketDataMap.get(symbol);

          return {
            symbol,
            name: asset.name,
            assetType: asset.type,
            price: marketItem?.price || "0",
            change: marketItem?.change || "0",
            changePercent: marketItem?.changePercent || "0",
            volume: marketItem?.volume || "0",
            high24h: marketItem?.high24h || null,
            low24h: marketItem?.low24h || null,
            lastUpdated: marketItem?.updatedAt || new Date(),
          };
        });

        // Cache for future requests (if we have data)
        if (allMarketData.length > 0) {
          marketDataCache.set("allMarketData", allMarketData, 10000); // 10 second TTL
        }
      } catch (error) {
        // Log and handle error but continue with empty market data
        errorHandler.logError(error, ErrorType.DATABASE, ErrorSeverity.ERROR, {
          code: "WS_DATA_FETCH_ERROR",
          source: "database",
        });

        log(`Error fetching market data: ${error}`, "websocket");
        allMarketData = [];
      }
    }

    // Filter by requested symbols if specified
    let marketData = allMarketData;
    if (symbols && symbols.length > 0) {
      const symbolSet = new Set(symbols.map((s) => s.toUpperCase()));
      marketData = allMarketData.filter((item) =>
        symbolSet.has(item.symbol.toUpperCase()),
      );
    }

    if (marketData && marketData.length > 0) {
      const updates = marketData.map((item) => ({
        symbol: item.symbol,
        name: item.name || item.symbol, // Fallback to symbol if name is missing
        assetType: item.assetType || "unknown",
        price: item.price.toString(),
        change: item.change.toString(),
        changePercent: item.changePercent.toString(),
        volume: item.volume?.toString() || "0",
        high24h: item.high24h?.toString() || null,
        low24h: item.low24h?.toString() || null,
        timestamp: Date.now(),
      }));

      if (ws.readyState === WebSocket.OPEN) {
        // Send data in batches if large
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

            // Send with a slight delay between batches to prevent overloading the client
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
                metrics.messagesSent++;
              }
            }, batchIndex * 50); // 50ms delay between batches
          }
        } else {
          // Small enough to send in one message
          ws.send(
            JSON.stringify({
              type: "marketData",
              data: updates,
              timestamp: Date.now(),
              isComplete: true, // Single message is complete
            }),
          );

          metrics.messagesSent++;
        }
      }
    } else {
      // No data available, send empty response
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "marketData",
            data: [],
            message: symbols
              ? `No market data available for requested symbols`
              : "No market data available",
            timestamp: Date.now(),
            isComplete: true,
          }),
        );

        metrics.messagesSent++;
      }
    }
  } catch (error) {
    // Use error handling service for unexpected errors
    errorHandler.logError(error, ErrorType.DATABASE, ErrorSeverity.ERROR, {
      code: "WS_DATA_SEND_ERROR",
      dataType: "marketData",
    });

    metrics.errors++;
    log(`Error sending market data: ${error}`, "websocket");
  }
}

/**
 * Send initial market data to newly connected client
 * Delegates to the shared sendMarketDataForSymbols function with no symbol filters
 */
async function sendInitialMarketData(ws: WebSocket) {
  await sendMarketDataForSymbols(ws, null);
}

/**
 * Broadcast market updates to all connected clients or by subscription
 */
async function broadcastMarketUpdates(
  wss: WebSocketServer,
  clients: Map<
    WebSocket,
    { subscriptions: Set<string>; metadata: ClientMetadata }
  >,
) {
  const startTime = performance.now();

  try {
    // Fetch market data only if we have connected clients
    if (wss.clients.size === 0) {
      return;
    }

    // Try to get market data from cache first
    let marketData = marketDataCache.get<any[]>("recentMarketData");

    // If not in cache, fetch from storage
    if (!marketData) {
      try {
        // Get the market data and assets together for a more complete update
        const assets = await storage.getAllAssets();
        const marketDataItems = await storage.getAllMarketData();

        // Create a map of symbol -> market data for faster lookups
        const marketDataMap = new Map();
        marketDataItems.forEach((item) => marketDataMap.set(item.symbol, item));

        // Create asset map for quick reference
        const assetMap = new Map();
        assets.forEach((asset) => assetMap.set(asset.symbol, asset));

        // Generate a combined dataset with asset information and market data
        marketData = assets
          .filter((asset) => asset.isActive) // Only include active assets
          .map((asset) => {
            const symbol = asset.symbol;
            const marketItem = marketDataMap.get(symbol);

            return {
              symbol,
              name: asset.name,
              assetType: asset.type,
              sector: asset.sector,
              country: asset.country,
              price: marketItem?.price || "0",
              change: marketItem?.change || "0",
              changePercent: marketItem?.changePercent || "0",
              volume: marketItem?.volume || "0",
              high24h: marketItem?.high24h || null,
              low24h: marketItem?.low24h || null,
              lastUpdated: marketItem?.updatedAt || new Date(),
            };
          });

        // Cache for next broadcast cycle to reduce DB load
        if (marketData.length > 0) {
          marketDataCache.set("recentMarketData", marketData, 5000); // 5 second TTL
          marketDataCache.set("allMarketData", marketData, 10000); // 10 second TTL for new connections
        }
      } catch (error) {
        // Use error handling service
        errorHandler.logError(error, ErrorType.DATABASE, ErrorSeverity.ERROR, {
          code: "getAllMarketData_FAILED",
          component: "WebSocket Broadcast",
        });

        metrics.errors++;
        log(`Failed to fetch market data: ${error}`, "websocket");
        return;
      }
    }

    if (!marketData || marketData.length === 0) {
      log(`No market data available for broadcast`, "websocket");
      return;
    }

    // Create a mapping of symbols to validated data for faster lookups
    const symbolsMap = new Map<string, MarketUpdate>();
    const timestamp = Date.now();

    // Process and validate each market data item
    for (const item of marketData) {
      // Create the market update object with proper string conversion
      // Only include essential data in the updates to reduce payload size
      const update = {
        symbol: item.symbol,
        price: item.price.toString(),
        change: item.change.toString(),
        changePercent: item.changePercent.toString(),
        volume: item.volume?.toString() || "0",
        timestamp: timestamp,
      };

      // Validate the update before adding it to the map
      const validatedUpdate = validateWebSocketMessage(
        update,
        marketUpdateSchema,
      );

      if (validatedUpdate !== null) {
        // Ensure we have a proper MarketUpdate type with additional metadata from the combined dataset
        const typedUpdate: MarketUpdate = {
          symbol: validatedUpdate.symbol,
          price: validatedUpdate.price.toString(),
          change: validatedUpdate.change.toString(),
          changePercent: validatedUpdate.changePercent.toString(),
          volume: validatedUpdate.volume?.toString(),
          timestamp: timestamp,
          // Include additional asset information for client UI enhancements
          name: item.name,
          assetType: item.assetType,
          sector: item.sector,
          country: item.country,
          high24h: item.high24h,
          low24h: item.low24h,
        };

        symbolsMap.set(item.symbol, typedUpdate);
      } else {
        // Log invalid data but don't send it to clients
        log(`Invalid market data for symbol ${item.symbol}`, "websocket");
        metrics.errors++;
      }
    }

    // Optimize by identifying which symbols have active subscribers
    const activeSymbols = new Set<string>();
    for (const [_, client] of clients.entries()) {
      // If client has specific subscriptions, note them as active
      if (client.subscriptions.size > 0) {
        for (const symbol of client.subscriptions) {
          activeSymbols.add(symbol);
        }
      }
    }

    // Pre-calculate full update list (for clients without specific subscriptions)
    const allUpdates = Array.from(symbolsMap.values());

    // Track metrics for this broadcast
    let totalMessageSize = 0;
    let totalCompressedSize = 0;
    let clientsUpdated = 0;
    let compressionTimeTotal = 0;

    // Broadcast to clients based on their subscriptions
    for (const [client, { subscriptions, metadata }] of clients.entries()) {
      if (client.readyState !== WebSocket.OPEN) {
        continue;
      }

      let updates: MarketUpdate[] = [];

      // If client has specific subscriptions, only send those
      if (subscriptions.size > 0) {
        for (const symbol of subscriptions) {
          const data = symbolsMap.get(symbol);
          if (data) {
            updates.push(data);
          }
        }
      } else {
        // If no specific subscriptions, send all data
        updates = allUpdates;
      }

      // Only send if we have updates
      if (updates.length > 0) {
        try {
          // Prepare message with timestamp
          const message = {
            type: "marketUpdate",
            data: updates,
            timestamp: timestamp,
          };

          // Convert to JSON
          const jsonMessage = JSON.stringify(message);
          totalMessageSize += jsonMessage.length;

          // Check if we should compress (client supports it and message is large enough)
          if (
            metadata.compression &&
            jsonMessage.length > COMPRESSION_THRESHOLD
          ) {
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
              errorHandler.logError(
                compressionError,
                ErrorType.UNKNOWN,
                ErrorSeverity.WARNING,
                {
                  code: "WS_COMPRESSION_ERROR",
                  messageSize: jsonMessage.length,
                },
              );

              client.send(jsonMessage);
            }
          } else {
            // Send uncompressed
            client.send(jsonMessage);
          }

          clientsUpdated++;
          metrics.messagesSent++;
        } catch (err) {
          // Use error handling service
          errorHandler.logError(err, ErrorType.NETWORK, ErrorSeverity.ERROR, {
            code: "WS_SEND_ERROR",
            dataCount: updates.length,
          });

          metrics.errors++;
          log(`Error sending to client: ${err}`, "websocket");

          // Try to clean up failed client
          try {
            clients.delete(client);
            client.terminate();
          } catch (e) {
            // Log but ignore errors during cleanup
            errorHandler.logError(e, ErrorType.NETWORK, ErrorSeverity.WARNING, {
              code: "WS_CLIENT_CLEANUP_ERROR",
            });
          }
        }
      }
    }

    // Update metrics
    const endTime = performance.now();
    metrics.lastBroadcastTime = endTime - startTime;
    metrics.lastBroadcastSize = totalMessageSize;

    // Calculate compression ratio if applicable
    if (totalCompressedSize > 0) {
      metrics.compressionRatio = totalMessageSize / totalCompressedSize;
      metrics.compressionTime = compressionTimeTotal;
    }

    // Log broadcast metrics
    if (clientsUpdated > 0) {
      log(
        `Broadcast completed: ${clientsUpdated} clients updated in ${metrics.lastBroadcastTime.toFixed(2)}ms`,
        "websocket",
      );
    }
  } catch (error) {
    // Use error handling service for the overall broadcast process
    errorHandler.logError(error, ErrorType.UNKNOWN, ErrorSeverity.ERROR, {
      code: "WS_BROADCAST_PROCESS_ERROR",
      clientCount: wss.clients.size,
      timestamp: new Date().toISOString(),
    });

    metrics.errors++;
    log(`Error broadcasting market updates: ${error}`, "websocket");
  }
}

/**
 * وظيفة لبدء اختبار WebSocket عبر إرسال بيانات اختبارية للعملاء
 * هذه تستخدم بشكل أساسي لاختبار اتصال WebSocket
 * @param wss خادم WebSocket المراد اختباره
 */
export async function startWebSocketTest(wss: WebSocketServer) {
  try {
    // إرسال بيانات اختبارية
    await sendTestMarketData(wss);

    // إعداد تدفق دوري للبيانات لاختبار الاتصال المستمر
    const interval = setInterval(async () => {
      try {
        // التحقق من وجود عملاء متصلين
        if (wss.clients.size > 0) {
          log(
            `Sending test data to ${wss.clients.size} WebSocket clients`,
            "websocket",
          );
          await sendTestMarketData(wss);
        } else {
          log("No WebSocket clients connected, waiting...", "websocket");
        }
      } catch (error) {
        log(`Error in WebSocket test interval: ${error}`, "websocket");
      }
    }, 10000); // كل 10 ثواني

    // إرجاع مرجع الفاصل الزمني حتى يمكن تنظيفه لاحقًا
    return interval;
  } catch (error) {
    log(`Error starting WebSocket test: ${error}`, "websocket");
    return null;
  }
}
