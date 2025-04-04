// تحديث مركزي للأسعار في قاعدة البيانات
// This script periodically updates market data in the database directly
/**
 * Market Update Service
 *
 * This script handles all market data updates and synchronizes the database with real-time
 * and historical price information from Polygon.io via both WebSocket and REST API.
 *
 * Features:
 * - WebSocket connections to Polygon.io for real-time crypto and forex data
 * - REST API fallback for traditional markets and when WebSocket is unavailable
 * - Price simulation for when APIs are unavailable
 * - Automatic reconnection with exponential backoff
 * - Time-aware updates based on market hours
 *
 * Environment variables:
 * - POLYGON_API_KEY: Required for API access
 */

// ====================== IMPORTS AND SETUP ======================
import { config } from "dotenv";
import WebSocket from "ws";
import pg from "pg";
import fetch from "node-fetch";
import { fetchCryptoData } from "./fetchCryptoData.js";

// Initialize environment variables
config();

// Create pool from pg
const { Pool } = pg;

// تكوين اتصال قاعدة البيانات
// Configure database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// Polygon API Keys - different keys for WebSocket and REST API
const POLYGON_API_KEY = process.env.POLYGON_API_KEY; // Used for REST API
// Fixed WebSocket API key - directly hardcoded as per requirements
const POLYGON_WS_API_KEY = "l5FtOG5QR83LKxj0lZHoKuMxu9bnvalv"; // Used for WebSocket connections

// WebSocket URLs
const POLYGON_CRYPTO_WS_URL = "wss://socket.polygon.io/crypto";
const POLYGON_FOREX_WS_URL = "wss://socket.polygon.io/forex";
const POLYGON_WS_URL = "wss://socket.polygon.io/stocks"; // Alias to prevent reference errors

// WebSocket channels
const CRYPTO_CHANNELS = ["XT", "XA", "XAS", "XQ"]; // Trades, Aggs, Second Aggs, Quotes
const FOREX_CHANNELS = ["C", "CA", "CAS"]; // Trades, Aggs, Second Aggs

// Constants and global state
const MAX_RECONNECT_DELAY = 30000; // 30 seconds maximum delay
const BATCH_SIZE = 50; // Maximum symbols per subscription batch
const BATCH_DELAY = 500; // 500ms between batch transmissions

// Update intervals
const FOREX_CRYPTO_UPDATE_INTERVAL = 15000; // 15 seconds for crypto and forex
const OTHER_ASSETS_UPDATE_INTERVAL = 60000; // 60 seconds for stocks and indices

// WebSocket connection objects
let polygonCryptoWs = null;
let polygonForexWs = null;
let reconnectAttempt = 0;

// Map to track current prices for comparison
const currentPrices = {};

// Categorized assets for easier processing
const assetsByType = {
  crypto: [],
  forex: [],
  stock: [],
  index: [],
};

// ====================== MARKET HOUR UTILITIES ======================

// التحقق إذا كانت الأسواق مفتوحة
function areMarketsOpen(assetType) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 for Sunday, 1-5 for Mon-Fri, 6 for Saturday
  const hourUTC = now.getUTCHours();

  // Crypto markets are always open
  if (assetType === "crypto") {
    return true;
  }

  // Simplified forex market hours check - closed on weekends
  // In reality, forex markets close Friday evening and open Sunday evening
  if (assetType === "forex") {
    return dayOfWeek !== 0; // Not Sunday
  }

  // Traditional markets (stocks, indices)
  // Simplified: Open Monday-Friday
  if (assetType === "stock" || assetType === "index") {
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  // Default fallback
  return false;
}

// ====================== WEBSOCKET CONNECTION MANAGEMENT ======================

// Initialize all WebSocket connections
async function initializeWebSocket() {
  try {
    // Check if API keys are available
    if (!POLYGON_WS_API_KEY) {
      console.error(
        "Polygon WebSocket API key is missing. Unable to establish WebSocket connections.",
      );
      return;
    }

    // Get crypto and forex assets from database
    const { cryptoAssets, forexAssets } = await getCryptoAndForexAssets();

    // Log current environment info
    console.log("===== WEBSOCKET INITIALIZATION =====");
    console.log(
      `DEBUG: Environment mode: ${process.env.NODE_ENV || "production"}`,
    );
    console.log(
      `DEBUG: Polygon API key available: ${POLYGON_API_KEY ? "Yes" : "No"}`,
    );
    console.log(
      `DEBUG: Polygon WebSocket API key available: ${POLYGON_WS_API_KEY ? "Yes" : "No"}`,
    );
    console.log(
      `DEBUG: Market status - Forex: ${areMarketsOpen("forex") ? "Open" : "Closed"}`,
    );

    // Initialize WebSocket connections
    if (cryptoAssets.length > 0) {
      await initializePolygonCryptoWebSocket(cryptoAssets);
    }

    if (forexAssets.length > 0 && areMarketsOpen("forex")) {
      await initializePolygonForexWebSocket(forexAssets);
    }
  } catch (error) {
    console.error("Error initializing WebSocket connections:", error);
  }
}

// Helper function to create simulated price changes
function simulatePriceChange(basePrice, volatilityFactor = 1) {
  if (!basePrice || isNaN(basePrice)) {
    basePrice = 100; // Default base price if none provided
  }

  // Random change between -1% and +1%, scaled by volatilityFactor
  const changePercent = (Math.random() * 2 - 1) * volatilityFactor;
  const change = basePrice * (changePercent / 100);
  const newPrice = basePrice + change;

  // Generate realistic values for high, low, volume
  const high24h = newPrice * (1 + Math.random() * 0.02); // 0-2% higher
  const low24h = newPrice * (1 - Math.random() * 0.02); // 0-2% lower
  const volume = Math.floor(Math.random() * 10000000);

  return {
    price: newPrice.toFixed(2),
    change: change.toFixed(2),
    changePercent: changePercent.toFixed(2),
    high24h: high24h.toFixed(2),
    low24h: low24h.toFixed(2),
    volume: volume.toString(),
  };
}

// Update asset in database with new price data
async function updateAssetInDatabase(symbol, data) {
  try {
    const assetType = data.assetType || "unknown";

    // First check if there's existing market data for this symbol
    const existingDataQuery = `
      SELECT id FROM market_data WHERE symbol = $1
    `;
    const existingResult = await pool.query(existingDataQuery, [symbol]);

    if (existingResult.rows.length > 0) {
      // Update existing record
      const updateQuery = `
        UPDATE market_data
        SET 
          price = $1,
          "dailyChange" = $2,
          "dailyChangePercent" = $3,
          volume = $4,
          high24h = $5,
          low24h = $6,
          "updatedAt" = NOW()
        WHERE symbol = $7
        RETURNING id
      `;

      await pool.query(updateQuery, [
        data.price,
        data.change || data.dailyChange || "0",
        data.changePercent || data.dailyChangePercent || "0",
        data.volume || "0",
        data.high24h || null,
        data.low24h || null,
        symbol,
      ]);

      // Also update the market_status in the assets table
      const assetUpdateQuery = `
        UPDATE assets
        SET 
          price = $1,
          "marketStatus" = $2,
          "lastUpdatedAt" = NOW()
        WHERE symbol = $3
      `;

      await pool.query(assetUpdateQuery, [
        data.price,
        areMarketsOpen(assetType) ? "active" : "closed",
        symbol,
      ]);
    } else {
      // Insert new record
      const insertQuery = `
        INSERT INTO market_data (
          symbol, price, "dailyChange", "dailyChangePercent", 
          volume, high24h, low24h, "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id
      `;

      await pool.query(insertQuery, [
        symbol,
        data.price,
        data.change || data.dailyChange || "0",
        data.changePercent || data.dailyChangePercent || "0",
        data.volume || "0",
        data.high24h || null,
        data.low24h || null,
      ]);
    }

    // Emit price update via WebSocket to clients
    emitPriceUpdate(symbol, data);

    return true;
  } catch (error) {
    console.error(`Database update error for ${symbol}:`, error);
    return false;
  }
}

// Fetch price data from Polygon REST API
async function fetchPolygonPrice(symbol, assetType) {
  if (!POLYGON_API_KEY) {
    return null;
  }

  try {
    let polygonSymbol;
    let apiUrl;

    if (assetType === "crypto") {
      // Format for crypto: X:BTCUSD
      polygonSymbol = `X:${symbol.replace("/", "")}`;
      apiUrl = `https://api.polygon.io/v2/aggs/ticker/${polygonSymbol}/prev?apiKey=${POLYGON_API_KEY}`;
    } else if (assetType === "forex") {
      // Format for forex: C:EURUSD
      polygonSymbol = `C:${symbol.replace("/", "")}`;
      apiUrl = `https://api.polygon.io/v2/aggs/ticker/${polygonSymbol}/prev?apiKey=${POLYGON_API_KEY}`;
    } else {
      // Stocks and indices use the symbol directly
      polygonSymbol = symbol;
      apiUrl = `https://api.polygon.io/v2/aggs/ticker/${polygonSymbol}/prev?apiKey=${POLYGON_API_KEY}`;
    }

    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error(
        `Polygon API error for ${symbol}: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const previousPrice = currentPrices[symbol] || result.c;
      const change = result.c - previousPrice;
      const changePercent =
        previousPrice > 0 ? (change / previousPrice) * 100 : 0;

      return {
        price: result.c.toFixed(assetType === "forex" ? 4 : 2),
        change: change.toFixed(assetType === "forex" ? 4 : 2),
        changePercent: changePercent.toFixed(2),
        high24h: result.h.toFixed(assetType === "forex" ? 4 : 2),
        low24h: result.l.toFixed(assetType === "forex" ? 4 : 2),
        volume: result.v.toString(),
        assetType,
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching Polygon price for ${symbol}:`, error);
    return null;
  }
}

// Helper function to emit price updates to WebSocket clients
function emitPriceUpdate(symbol, data) {
  // This function would send data to connected clients
  // Implementation depends on your WebSocket server setup
  try {
    // Example: If you have a global WebSocket server instance
    // globalWsServer.broadcast(JSON.stringify({
    //   type: 'marketUpdate',
    //   data: { symbol, ...data }
    // }));
    // If you're using the express-ws or socket.io approach
    // This is likely implemented elsewhere in your server code
    // This function is just a placeholder
  } catch (error) {
    console.error("Error broadcasting price update:", error);
  }
}

/**
 * Initialize and manage WebSocket connection for cryptocurrency data from Polygon.io
 *
 * This implementation follows Polygon.io WebSocket API specification:
 * 1. Connect to wss://socket.polygon.io/crypto
 * 2. Authenticate using API key
 * 3. Subscribe to real-time data feeds upon auth_success message
 * 4. Process incoming messages and update database with price changes
 *
 * @param {Array} cryptoAssets - Array of cryptocurrency assets from database
 */
async function initializePolygonCryptoWebSocket(cryptoAssets) {
  try {
    // Enhanced debug logging
    console.log("===== CRYPTO WEBSOCKET DEBUG =====");
    console.log(
      `DEBUG: Environment mode: ${process.env.NODE_ENV || "production"}`,
    );
    console.log(
      `DEBUG: Polygon API key available: ${POLYGON_API_KEY ? "Yes" : "No"}`,
    );
    console.log(
      `DEBUG: Polygon WebSocket API key available: ${POLYGON_WS_API_KEY ? "Yes" : "No"}`,
    );

    if (!POLYGON_WS_API_KEY) {
      console.error(
        "Polygon WebSocket API key is not configured. WebSocket connection cannot be established.",
      );
      return;
    }

    // Close existing connection if it exists
    if (polygonCryptoWs) {
      console.log("Cleaning up crypto WebSocket connection");

      // Remove all event listeners to prevent callbacks after cleanup
      if (typeof polygonCryptoWs.removeAllListeners === "function") {
        polygonCryptoWs.removeAllListeners();
      }

      // Check if the connection is actually established before closing
      if (polygonCryptoWs.readyState === WebSocket.OPEN) {
        console.log("Closing established crypto WebSocket connection");
        // Use close instead of terminate for established connections
        polygonCryptoWs.close();
      } else if (polygonCryptoWs.readyState === WebSocket.CONNECTING) {
        console.log("Canceling connecting crypto WebSocket");
        // For connecting state, we need to set up the close handler and wait
        polygonCryptoWs.onopen = () => {
          polygonCryptoWs.close();
        };
        // Set a timeout to ensure we don't hang
        setTimeout(() => {
          if (polygonCryptoWs) {
            console.log("Timeout reached, forcing crypto WebSocket cleanup");
            polygonCryptoWs = null;
          }
        }, 1000);
      } else {
        console.log("Crypto WebSocket already closing or closed");
      }

      // Reset the reference, but with a delay if needed
      if (polygonCryptoWs.readyState !== WebSocket.CONNECTING) {
        polygonCryptoWs = null;
      }
    }

    // Connect to Polygon Crypto WebSocket using the proper URL from config
    console.log(
      `Connecting to Polygon Crypto WebSocket at ${POLYGON_CRYPTO_WS_URL}`,
    );
    polygonCryptoWs = new WebSocket(POLYGON_CRYPTO_WS_URL);

    // عند الاتصال - On connection
    polygonCryptoWs.on("open", async () => {
      console.log(
        "Polygon Crypto WebSocket connection established successfully",
      );
      reconnectAttempt = 0; // Reset reconnection attempts on success

      // Authenticate with WebSocket API key (different from REST API key)
      const authMessage = {
        action: "auth",
        params: POLYGON_WS_API_KEY, // Using the dedicated WebSocket API key
      };

      console.log("Sending authentication message to Polygon Crypto WebSocket");
      polygonCryptoWs.send(JSON.stringify(authMessage));

      // We'll subscribe to channels after receiving auth_success message
      // See the message handler below
    });

    // On message received from Polygon WebSocket
    polygonCryptoWs.on("message", async (message) => {
      try {
        // Parse the message based on its format
        let messageData;
        if (Buffer.isBuffer(message)) {
          messageData = JSON.parse(message.toString());
        } else if (typeof message === "string") {
          messageData = JSON.parse(message);
        } else {
          console.error(
            "Unexpected message format from Polygon Crypto WebSocket",
          );
          return;
        }

        // Log first few messages for debugging
        console.log(
          `Received message from Polygon Crypto WebSocket: ${JSON.stringify(messageData).substring(0, 200)}...`,
        );

        // Handle auth success and subscribe to crypto channels
        if (
          messageData[0] &&
          messageData[0].ev === "status" &&
          messageData[0].status === "auth_success"
        ) {
          console.log("Polygon Crypto WebSocket authentication successful!");
          await subscribeToChannelsAfterAuth(
            polygonCryptoWs,
            cryptoAssets,
            "crypto",
          );
          return;
        }

        // Process price updates for crypto assets
        for (const update of messageData) {
          if (!update || !update.pair) continue;

          // Extract the symbol from the pair (e.g., "XA.BTCUSD" -> "BTCUSD" -> "BTC/USD")
          const parts = update.pair.split(".");
          const assetType = "crypto";
          let symbol = null;
          let originalSymbol = null;

          if (parts.length === 2) {
            // Get the asset without channel prefix
            const rawSymbol = parts[1];

            // First try to find the asset directly by its polygonSymbol
            const polygonSymbol = `X:${rawSymbol}`;
            const assetQuery = `
              SELECT symbol, type FROM assets WHERE "polygonSymbol" = $1
            `;
            const assetResult = await pool.query(assetQuery, [polygonSymbol]);

            if (assetResult.rows.length > 0) {
              const asset = assetResult.rows[0];
              symbol = asset.symbol;
              originalSymbol = update.pair;

              console.log(
                `SUCCESS: Found crypto asset ${symbol} for Polygon symbol ${polygonSymbol}`,
              );
            } else {
              // If not found by polygon_symbol, try to infer the symbol from update.pair
              if (update.pair.startsWith("X")) {
                // Crypto - Format: XA.BTCUSD -> BTC/USD
                const currencyPair = parts[1];
                // Try to split into base/quote by common quote currencies
                const quotes = ["USD", "USDT", "USDC", "BTC", "ETH"];
                let baseSymbol = currencyPair;
                let quoteSymbol = "";

                for (const quote of quotes) {
                  if (currencyPair.endsWith(quote)) {
                    baseSymbol = currencyPair.substring(
                      0,
                      currencyPair.length - quote.length,
                    );
                    quoteSymbol = quote;
                    break;
                  }
                }

                symbol = baseSymbol.toUpperCase();
                originalSymbol = update.pair;

                // Now try to find it in the database with the inferred symbol
                const cryptoQuery = `
                  SELECT symbol, type FROM assets WHERE symbol = $1
                `;
                const cryptoResult = await pool.query(cryptoQuery, [symbol]);

                if (cryptoResult.rows.length > 0) {
                  const asset = cryptoResult.rows[0];
                  symbol = asset.symbol;
                  console.log(
                    `SUCCESS: Found crypto asset by inferred symbol ${symbol}`,
                  );
                } else {
                  console.log(
                    `WARNING: Crypto asset with symbol ${symbol} not found in database`,
                  );
                }
              }
            }

            // If we have a symbol, update the price
            if (symbol) {
              // Get the previous price for comparison
              const previousPrice = currentPrices[symbol] || null;
              const newPrice =
                update.p || update.bp || update.o || update.c || update.vw || 0;

              // Calculate change based on previous price
              let change, changePercent;

              if (previousPrice !== null) {
                change = newPrice - previousPrice;
                changePercent =
                  previousPrice > 0 ? (change / previousPrice) * 100 : 0;
              } else {
                // إذا لم يكن هناك سعر سابق، استخدم القيم الواردة من التحديث
                change = 0;
                changePercent = 0;
              }

              // تخزين السعر الحالي كسعر سابق للمقارنة في التحديثات المستقبلية
              currentPrices[symbol] = newPrice;

              console.log(
                `Updating ${symbol} price from ${previousPrice || "unknown"} to ${newPrice} (change: ${change}, ${changePercent}%)`,
              );

              // تحديث قاعدة البيانات - احتفظ بالسعر السابق (last_price) قبل التحديث
              try {
                // أولاً احصل على السعر الحالي لتخزينه كـ last_price
                const currentPriceQuery = `
                  SELECT price as current_price 
                  FROM assets 
                  WHERE symbol = $1
                `;
                const currentPriceResult = await pool.query(currentPriceQuery, [
                  symbol,
                ]);
                let lastPrice = null;

                if (currentPriceResult.rows.length > 0) {
                  lastPrice = currentPriceResult.rows[0].current_price;
                }

                // الآن تحديث السعر مع الاحتفاظ بالسعر السابق
                await updateAssetInDatabase(symbol, {
                  price: newPrice.toFixed(assetType === "forex" ? 4 : 2),
                  lastPrice: lastPrice,
                  change: change.toFixed(assetType === "forex" ? 4 : 2),
                  changePercent: changePercent.toFixed(2),
                  volume: update.s || 0,
                  assetType,
                  high24h: update.h
                    ? update.h.toFixed(assetType === "forex" ? 4 : 2)
                    : null,
                  low24h: update.l
                    ? update.l.toFixed(assetType === "forex" ? 4 : 2)
                    : null,
                });
              } catch (dbError) {
                console.error(
                  `Error updating database for ${symbol}:`,
                  dbError,
                );
              }
            } else {
              console.log(`Received update for unknown symbol: ${update.pair}`);
            }
          }
        }
      } catch (error) {
        console.error("Error processing Polygon WebSocket message:", error);
      }
    });

    // معالجة الأخطاء وإعادة الاتصال مع تأخير متزايد
    polygonCryptoWs.on("error", (error) => {
      console.error("Polygon Crypto WebSocket error:", error);
      scheduleReconnect();
    });

    polygonCryptoWs.on("close", () => {
      console.log("Polygon Crypto WebSocket connection closed");
      scheduleReconnect();
    });
  } catch (error) {
    console.error("Error initializing Polygon WebSocket:", error);
    scheduleReconnect();
  }
}

/**
 * Initialize and manage WebSocket connection for forex data from Polygon.io
 *
 * This implementation follows Polygon.io WebSocket API specification:
 * 1. Connect to wss://socket.polygon.io/forex
 * 2. Authenticate using API key
 * 3. Subscribe to real-time data feeds upon auth_success message
 * 4. Process incoming messages and update database with price changes
 *
 * @param {Array} forexAssets - Array of forex assets from database
 */
async function initializePolygonForexWebSocket(forexAssets) {
  try {
    // Enhanced debug logging
    console.log("===== FOREX WEBSOCKET DEBUG =====");
    console.log(
      `DEBUG: Environment mode: ${process.env.NODE_ENV || "production"}`,
    );
    console.log(
      `DEBUG: Polygon API key available: ${POLYGON_API_KEY ? "Yes" : "No"}`,
    );
    console.log(
      `DEBUG: Polygon WebSocket API key available: ${POLYGON_WS_API_KEY ? "Yes" : "No"}`,
    );
    console.log(
      `DEBUG: Market status: ${areMarketsOpen("forex") ? "Open" : "Closed"}`,
    );

    if (!POLYGON_WS_API_KEY) {
      console.error(
        "Polygon WebSocket API key is not configured. WebSocket connection cannot be established.",
      );
      return;
    }

    // Check if markets are open - for forex this depends on day/time
    if (!areMarketsOpen("forex")) {
      console.log("سوق الفوركس مغلق (الأحد). تم تخطي اتصال WebSocket");
      console.log(
        "Forex market is closed (Sunday). Skipping WebSocket connection",
      );
      return;
    }

    // Close existing connection if it exists
    if (polygonForexWs) {
      console.log("Cleaning up forex WebSocket connection");

      // Remove all event listeners to prevent callbacks after cleanup
      if (typeof polygonForexWs.removeAllListeners === "function") {
        polygonForexWs.removeAllListeners();
      }

      // Check if the connection is actually established before closing
      if (polygonForexWs.readyState === WebSocket.OPEN) {
        console.log("Closing established forex WebSocket connection");
        // Use close instead of terminate for established connections
        polygonForexWs.close();
      } else if (polygonForexWs.readyState === WebSocket.CONNECTING) {
        console.log("Canceling connecting forex WebSocket");
        // For connecting state, we need to set up the close handler and wait
        polygonForexWs.onopen = () => {
          polygonForexWs.close();
        };
        // Set a timeout to ensure we don't hang
        setTimeout(() => {
          if (polygonForexWs) {
            console.log("Timeout reached, forcing forex WebSocket cleanup");
            polygonForexWs = null;
          }
        }, 1000);
      } else {
        console.log("Forex WebSocket already closing or closed");
      }

      // Reset the reference, but with a delay if needed
      if (polygonForexWs.readyState !== WebSocket.CONNECTING) {
        polygonForexWs = null;
      }
    }

    // Connect to Polygon Forex WebSocket
    console.log(
      `Connecting to Polygon Forex WebSocket at ${POLYGON_FOREX_WS_URL}`,
    );
    polygonForexWs = new WebSocket(POLYGON_FOREX_WS_URL);

    // عند الاتصال - On connection
    polygonForexWs.on("open", async () => {
      console.log(
        "Polygon Forex WebSocket connection established successfully",
      );
      reconnectAttempt = 0; // Reset reconnection attempts on success

      // Authenticate with WebSocket API key (different from REST API key)
      const authMessage = {
        action: "auth",
        params: POLYGON_WS_API_KEY, // Using the dedicated WebSocket API key
      };

      console.log("Sending authentication message to Polygon Forex WebSocket");
      polygonForexWs.send(JSON.stringify(authMessage));

      // Wait for auth_success message before subscribing to channels
      // See message handler below
    });

    // On message received from Polygon Forex WebSocket
    polygonForexWs.on("message", async (message) => {
      try {
        // Parse the message based on its format
        let messageData;
        if (Buffer.isBuffer(message)) {
          messageData = JSON.parse(message.toString());
        } else if (typeof message === "string") {
          messageData = JSON.parse(message);
        } else {
          console.error(
            "Unexpected message format from Polygon Forex WebSocket",
          );
          return;
        }

        // Log first few messages for debugging
        console.log(
          `Received message from Polygon Forex WebSocket: ${JSON.stringify(messageData).substring(0, 200)}...`,
        );

        // Handle auth success and subscribe to forex channels
        if (
          messageData[0] &&
          messageData[0].ev === "status" &&
          messageData[0].status === "auth_success"
        ) {
          console.log("Polygon Forex WebSocket authentication successful!");
          await subscribeToChannelsAfterAuth(
            polygonForexWs,
            forexAssets,
            "forex",
          );
          return;
        }

        // Process price updates for forex pairs
        for (const update of messageData) {
          if (!update || !update.p) continue; // Skip if missing pair info

          // Extract the symbol from the pair (e.g., "C.EURUSD" -> "EURUSD" -> "EUR/USD")
          const parts = update.p.split(".");
          const assetType = "forex";
          let symbol = null;
          let originalSymbol = null;

          if (parts.length === 2) {
            // Get the asset without channel prefix
            const rawSymbol = parts[1];

            // First try to find the asset directly by its polygon_symbol
            const polygonSymbol = `C:${rawSymbol}`;
            const assetQuery = `
              SELECT symbol, type FROM assets WHERE "polygonSymbol" = $1
            `;
            const assetResult = await pool.query(assetQuery, [polygonSymbol]);

            if (assetResult.rows.length > 0) {
              const asset = assetResult.rows[0];
              symbol = asset.symbol;
              assetType = asset.type;
              originalSymbol = update.p;

              console.log(
                `SUCCESS: Found forex asset ${symbol} (${assetType}) for Polygon symbol ${polygonSymbol}`,
              );
            } else {
              // إذا فشل البحث بواسطة polygon_symbol، نحاول استقراء الرمز من update.p
              if (update.p.startsWith("C.")) {
                // فوركس - مثال: C.EURUSD
                symbol = update.p
                  .substring(2)
                  .replace(/([A-Z]{3})([A-Z]{3})/, "$1/$2");
                console.log(`Inferred forex symbol: ${update.p} -> ${symbol}`);
                assetType = "forex";
                originalSymbol = update.p;

                // محاولة البحث مرة أخرى باستخدام الرمز المستنتج
                const forexQuery = `
                  SELECT symbol, type FROM assets WHERE symbol = $1
                `;
                const forexResult = await pool.query(forexQuery, [symbol]);

                if (forexResult.rows.length > 0) {
                  const asset = forexResult.rows[0];
                  symbol = asset.symbol;
                  assetType = asset.type;
                  console.log(
                    `SUCCESS: Found forex asset by inferred symbol ${symbol}`,
                  );
                } else {
                  console.log(
                    `WARNING: Forex asset with symbol ${symbol} not found in database`,
                  );
                }
              }
            }

            // إذا تم التعرف على الرمز، تحديث السعر
            if (symbol) {
              // البحث عن السعر السابق للمقارنة
              const previousPrice = currentPrices[symbol] || null;
              const newPrice = update.bp; // استخدام سعر العرض للفوركس

              // حساب التغيير بناءً على السعر السابق
              let change, changePercent;

              if (previousPrice !== null) {
                change = newPrice - previousPrice;
                changePercent =
                  previousPrice > 0 ? (change / previousPrice) * 100 : 0;
              } else {
                // إذا لم يكن هناك سعر سابق، استخدم 0
                change = 0;
                changePercent = 0;
              }

              // تخزين السعر الحالي للمقارنة المستقبلية
              currentPrices[symbol] = newPrice;

              console.log(
                `تحديث سعر ${symbol} من ${previousPrice || "غير معروف"} إلى ${newPrice} (التغيير: ${change}, ${changePercent}%)`,
              );

              // تحديث قاعدة البيانات
              try {
                // أولاً احصل على السعر الحالي لتخزينه كـ last_price
                const currentPriceQuery = `
                  SELECT price as current_price 
                  FROM assets 
                  WHERE symbol = $1
                `;
                const currentPriceResult = await pool.query(currentPriceQuery, [
                  symbol,
                ]);
                let lastPrice = null;

                if (currentPriceResult.rows.length > 0) {
                  lastPrice = currentPriceResult.rows[0].current_price;
                }

                // الآن تحديث السعر مع الاحتفاظ بالسعر السابق
                await updateAssetInDatabase(symbol, {
                  price: newPrice.toFixed(4), // استخدام 4 أرقام عشرية للفوركس
                  lastPrice: lastPrice,
                  change: change.toFixed(4),
                  changePercent: changePercent.toFixed(2),
                  volume: "0", // الفوركس عادة لا يوفر حجم التداول
                  assetType,
                  high24h: (update.h || newPrice * 1.001).toFixed(4),
                  low24h: (update.l || newPrice * 0.999).toFixed(4),
                });
              } catch (dbError) {
                console.error(
                  `Error updating database for ${symbol}:`,
                  dbError,
                );
              }
            } else {
              console.log(
                `Received forex update without symbol: ${JSON.stringify(update)}`,
              );
            }
          }
        }
      } catch (error) {
        console.error(
          "Error processing Polygon Forex WebSocket message:",
          error,
        );
      }
    });

    // معالجة الأخطاء وإعادة الاتصال مع تأخير متزايد
    polygonForexWs.on("error", (error) => {
      console.error("Polygon Forex WebSocket error:", error);
      scheduleReconnect();
    });

    polygonForexWs.on("close", () => {
      console.log("Polygon Forex WebSocket connection closed");
      scheduleReconnect();
    });
  } catch (error) {
    console.error("Error initializing Polygon Forex WebSocket:", error);
    scheduleReconnect();
  }
}

// Function to subscribe to channels after successful authentication
async function subscribeToChannelsAfterAuth(wsConnection, assets, assetType) {
  if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
    console.error(
      `Cannot subscribe: WebSocket is not open (assetType: ${assetType})`,
    );
    return;
  }

  try {
    console.log(
      `Preparing to subscribe to ${assetType} channels for ${assets.length} assets`,
    );

    // Determine channels and prepare subscription lists based on asset type
    const channels = assetType === "crypto" ? CRYPTO_CHANNELS : FOREX_CHANNELS;

    // Split subscriptions into batches to avoid message size limits
    for (let i = 0; i < assets.length; i += BATCH_SIZE) {
      const batchAssets = assets.slice(i, i + BATCH_SIZE);

      // For each channel, create a batch subscription
      for (const channel of channels) {
        // Format subscription parameters based on asset type
        const subscriptionParams = batchAssets
          .map((asset) => {
            if (assetType === "crypto") {
              // Format for crypto: XT.BTCUSD, XA.BTCUSD, etc.
              return `${channel}.${asset.symbol.replace("/", "")}`;
            } else if (assetType === "forex") {
              // Format for forex: C.EURUSD, CA.EURUSD, etc.
              return `${channel}.${asset.symbol.replace("/", "")}`;
            }
            return null;
          })
          .filter((param) => param !== null);

        if (subscriptionParams.length > 0) {
          // Create subscription message
          const subscribeMessage = {
            action: "subscribe",
            params: subscriptionParams.join(","),
          };

          console.log(
            `Subscribing to ${subscriptionParams.length} ${assetType} symbols on channel ${channel}`,
          );

          try {
            // Send the subscription message
            wsConnection.send(JSON.stringify(subscribeMessage));

            // Small delay between batches to prevent rate limiting
            if (
              i + BATCH_SIZE < assets.length ||
              channels.indexOf(channel) < channels.length - 1
            ) {
              await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
            }
          } catch (sendError) {
            console.error(
              `Error sending subscription for ${channel}:`,
              sendError,
            );
          }
        }
      }
    }

    console.log(`Successfully subscribed to all ${assetType} channels`);
  } catch (error) {
    console.error(`Error subscribing to ${assetType} channels:`, error);
  }
}

// وظيفة لجدولة إعادة الاتصال مع تأخير متزايد
function scheduleReconnect() {
  reconnectAttempt++;

  // حساب التأخير مع تراجع أسي (مع حد أقصى)
  const delay = Math.min(
    1000 * Math.pow(1.5, reconnectAttempt),
    MAX_RECONNECT_DELAY,
  );

  console.log(
    `Scheduling WebSocket reconnect attempt ${reconnectAttempt} in ${delay}ms`,
  );

  // Call the initialize function after delay
  setTimeout(async () => {
    try {
      // Reinitialize both WebSocket connections
      const { cryptoAssets, forexAssets } = await getCryptoAndForexAssets();
      await initializePolygonCryptoWebSocket(cryptoAssets);
      await initializePolygonForexWebSocket(forexAssets);
    } catch (error) {
      console.error("Error during reconnection:", error);
    }
  }, delay);
}

// This import is moved to the top of the file

// تحديث العملات الرقمية والفوركس (التحديث المباشر)
async function updateRealtimeAssets() {
  if (!POLYGON_API_KEY) {
    // استخدام محاكاة الأسعار إذا لم يتوفر مفتاح API
    updateRealtimeAssetsSimulated();
    return;
  }

  try {
    // تحديث العملات الرقمية (دائماً مفتوحة)
    for (const asset of assetsByType.crypto) {
      // Use our enhanced crypto data fetching with multiple fallback strategies
      const data = await fetchCryptoData(
        asset.symbol,
        POLYGON_API_KEY,
        currentPrices,
      );

      if (data) {
        // تحديث السعر الحالي
        currentPrices[asset.symbol] = parseFloat(data.price);

        // تحديث قاعدة البيانات
        await updateAssetInDatabase(asset.symbol, data);
        console.log(
          `[DB] Updated ${asset.symbol} price: ${data.price}, change: ${data.change}, volume: ${data.volume}`,
        );
      } else {
        // استخدام البيانات المقدرة إذا فشل الاتصال بـ Polygon
        const simData = simulatePriceChange(
          currentPrices[asset.symbol] || asset.basePrice,
          asset.volatility || 1,
        );

        currentPrices[asset.symbol] = parseFloat(simData.price);

        await updateAssetInDatabase(asset.symbol, {
          ...simData,
          assetType: "crypto",
        });
      }
    }

    // تحديث الفوركس (التحقق إذا كان السوق مفتوح)
    if (areMarketsOpen("forex")) {
      for (const asset of assetsByType.forex) {
        const data = await fetchPolygonPrice(asset.symbol, "forex");

        if (data) {
          // تحديث السعر الحالي
          currentPrices[asset.symbol] = parseFloat(data.price);

          // تحديث قاعدة البيانات
          await updateAssetInDatabase(asset.symbol, data);
        } else {
          // استخدام البيانات المقدرة إذا فشل الاتصال بـ Polygon
          const simData = simulatePriceChange(
            currentPrices[asset.symbol] || asset.basePrice,
            asset.volatility || 1,
          );

          currentPrices[asset.symbol] = parseFloat(simData.price);

          await updateAssetInDatabase(asset.symbol, {
            ...simData,
            assetType: "forex",
          });
        }
      }
    } else {
      console.log("سوق الفوركس مغلق (الأحد). تم تخطي التحديثات.");
    }
  } catch (error) {
    console.error("خطأ في تحديث الأصول المباشرة:", error);
    // في حالة فشل البيانات الحقيقية، استخدم البيانات المقدّرة
    updateRealtimeAssetsSimulated();
  }
}

// تحديث محاكاة للعملات الرقمية والفوركس (تُستخدم كخطة طوارئ)
async function updateRealtimeAssetsSimulated() {
  console.log("استخدام الأسعار المقدرة لتحديث العملات الرقمية والفوركس");

  // تحديث العملات الرقمية (دائماً مفتوحة)
  for (const asset of assetsByType.crypto) {
    const simData = simulatePriceChange(
      currentPrices[asset.symbol] || asset.basePrice,
      asset.volatility || 1,
    );

    // تحديث السعر الحالي
    currentPrices[asset.symbol] = parseFloat(simData.price);

    // تحديث قاعدة البيانات
    await updateAssetInDatabase(asset.symbol, {
      ...simData,
      assetType: "crypto",
    });
  }

  // تحديث الفوركس (التحقق إذا كان السوق مفتوح)
  if (areMarketsOpen("forex")) {
    for (const asset of assetsByType.forex) {
      const simData = simulatePriceChange(
        currentPrices[asset.symbol] || asset.basePrice,
        asset.volatility || 1,
      );

      // تحديث السعر الحالي
      currentPrices[asset.symbol] = parseFloat(simData.price);

      // تحديث قاعدة البيانات
      await updateAssetInDatabase(asset.symbol, {
        ...simData,
        assetType: "forex",
      });
    }
  } else {
    console.log("سوق الفوركس مغلق (الأحد). تم تخطي التحديثات.");
  }
}

// تحديث الأصول التقليدية (الأسهم والمؤشرات) عبر REST API
async function updateTraditionalAssets() {
  // التحقق إذا كانت الأسواق التقليدية مفتوحة
  if (!areMarketsOpen("stock")) {
    console.log("الأسواق التقليدية مغلقة (الأحد). تم تخطي التحديثات.");
    return;
  }

  if (!POLYGON_API_KEY) {
    // استخدام محاكاة الأسعار إذا لم يتوفر مفتاح API
    updateTraditionalAssetsSimulated();
    return;
  }

  try {
    // تحديث الأسهم
    for (const asset of assetsByType.stock) {
      const data = await fetchPolygonPrice(asset.symbol, "stock");

      if (data) {
        // تحديث السعر الحالي
        currentPrices[asset.symbol] = parseFloat(data.price);

        // تحديث قاعدة البيانات
        await updateAssetInDatabase(asset.symbol, data);
      } else {
        // استخدام البيانات المقدرة إذا فشل الاتصال بـ Polygon
        const simData = simulatePriceChange(
          currentPrices[asset.symbol] || asset.basePrice,
        );

        currentPrices[asset.symbol] = parseFloat(simData.price);

        await updateAssetInDatabase(asset.symbol, {
          ...simData,
          assetType: "stock",
        });
      }
    }

    // تحديث المؤشرات
    for (const asset of assetsByType.index) {
      const data = await fetchPolygonPrice(asset.symbol, "index");

      if (data) {
        // تحديث السعر الحالي
        currentPrices[asset.symbol] = parseFloat(data.price);

        // تحديث قاعدة البيانات
        await updateAssetInDatabase(asset.symbol, data);
      } else {
        // استخدام البيانات المقدرة إذا فشل الاتصال بـ Polygon
        const simData = simulatePriceChange(
          currentPrices[asset.symbol] || asset.basePrice,
        );

        currentPrices[asset.symbol] = parseFloat(simData.price);

        await updateAssetInDatabase(asset.symbol, {
          ...simData,
          assetType: "index",
        });
      }
    }
  } catch (error) {
    console.error("خطأ في تحديث الأصول التقليدية:", error);
    // في حالة فشل البيانات الحقيقية، استخدم البيانات المقدّرة
    updateTraditionalAssetsSimulated();
  }
}

// تحديث محاكاة للأصول التقليدية (تُستخدم كخطة طوارئ)
async function updateTraditionalAssetsSimulated() {
  console.log("استخدام الأسعار المقدرة لتحديث الأسهم والمؤشرات");

  // تحديث الأسهم
  for (const asset of assetsByType.stock) {
    const simData = simulatePriceChange(
      currentPrices[asset.symbol] || asset.basePrice,
    );

    // تحديث السعر الحالي
    currentPrices[asset.symbol] = parseFloat(simData.price);

    // تحديث قاعدة البيانات
    await updateAssetInDatabase(asset.symbol, {
      ...simData,
      assetType: "stock",
    });
  }

  // تحديث المؤشرات
  for (const asset of assetsByType.index) {
    const simData = simulatePriceChange(
      currentPrices[asset.symbol] || asset.basePrice,
    );

    // تحديث السعر الحالي
    currentPrices[asset.symbol] = parseFloat(simData.price);

    // تحديث قاعدة البيانات
    await updateAssetInDatabase(asset.symbol, {
      ...simData,
      assetType: "index",
    });
  }
}

// وظيفة مساعدة للتأكد من تحديث حقل polygonSymbol بشكل صحيح لجميع الأصول
async function ensurePolygonSymbols() {
  try {
    console.log("تحديث رموز polygonSymbol لجميع الأصول النشطة...");

    // 1. جلب جميع الأصول النشطة
    const assetsQuery = `
      SELECT id, symbol, type, "polygon_symbol" as "polygonSymbol" 
      FROM assets 
      WHERE is_active = true
    `;
    const assetsResult = await pool.query(assetsQuery);
    const assets = assetsResult.rows;
    console.log(`وجدت ${assets.length} أصل نشط للتحديث`);

    let updatedCount = 0;

    // 2. التحقق من كل أصل وتحديث polygonSymbol إذا لزم الأمر
    for (const asset of assets) {
      let polygonSymbol = null;

      if (asset.type === "crypto") {
        // العملات الرقمية: X:BTCUSD
        const baseCurrency = asset.symbol.split("/")[0];
        const quoteCurrency = asset.symbol.split("/")[1] || "USD";
        polygonSymbol = `X:${baseCurrency}${quoteCurrency}`;
      } else if (asset.type === "forex") {
        // الفوركس: C:EURUSD
        polygonSymbol = `C:${asset.symbol.replace("/", "")}`;
      } else if (asset.type === "stock") {
        // الأسهم: تستخدم الرمز كما هو
        polygonSymbol = asset.symbol;
      } else if (asset.type === "index") {
        // المؤشرات: تستخدم الرمز كما هو
        polygonSymbol = asset.symbol;
      }

      // تحديث في قاعدة البيانات فقط إذا كانت قيمة polygonSymbol غير موجودة أو مختلفة
      if (
        polygonSymbol &&
        (!asset.polygonSymbol || asset.polygonSymbol !== polygonSymbol)
      ) {
        const updateQuery = `
          UPDATE assets 
          SET "polygon_symbol" = $1 
          WHERE id = $2
          RETURNING symbol, "polygon_symbol" as "polygonSymbol"
        `;
        const updateResult = await pool.query(updateQuery, [
          polygonSymbol,
          asset.id,
        ]);

        if (updateResult.rows.length > 0) {
          updatedCount++;
          console.log(
            `تم تحديث الأصل ${asset.symbol} مع polygonSymbol = ${polygonSymbol}`,
          );
        }
      }
    }

    console.log(
      `تم تحديث ${updatedCount} أصل بنجاح مع رموز polygonSymbol المناسبة`,
    );

    return true;
  } catch (error) {
    console.error("خطأ في تحديث رموز polygonSymbol:", error);
    return false;
  }
}

// Helper function to get crypto and forex assets
async function getCryptoAndForexAssets() {
  try {
    // Get crypto assets
    const cryptoAssetsQuery = `
      SELECT * FROM assets 
      WHERE type = 'crypto' AND is_active = true
    `;
    const cryptoResult = await pool.query(cryptoAssetsQuery);
    const cryptoAssets = cryptoResult.rows;

    // Get forex assets
    const forexAssetsQuery = `
      SELECT * FROM assets 
      WHERE type = 'forex' AND is_active = true
    `;
    const forexResult = await pool.query(forexAssetsQuery);
    const forexAssets = forexResult.rows;

    return { cryptoAssets, forexAssets };
  } catch (error) {
    console.error("Error fetching assets for WebSocket connection:", error);
    return { cryptoAssets: [], forexAssets: [] };
  }
}

// تأكد من تحديث رموز polygonSymbol أولاً، ثم قم بتهيئة اتصال WebSocket
async function initialize() {
  // 1. تحديث رموز polygonSymbol في قاعدة البيانات
  await ensurePolygonSymbols();

  // 2. تهيئة Polygon WebSocket لجلب بيانات حية للعملات الرقمية والفوركس
  if (POLYGON_API_KEY) {
    try {
      // Get crypto and forex assets
      const { cryptoAssets, forexAssets } = await getCryptoAndForexAssets();

      // Initialize WebSocket connections for both crypto and forex
      await initializePolygonCryptoWebSocket(cryptoAssets);
      await initializePolygonForexWebSocket(forexAssets);

      console.log(
        `WebSocket initialization complete - Crypto: ${cryptoAssets.length} assets, Forex: ${forexAssets.length} assets`,
      );
    } catch (error) {
      console.error("خطأ في تهيئة Polygon WebSocket:", error);
    }
  }

  // 3. بدء تحديث الأصول فوراً
  console.log("بدء تحديث أسعار الأصول...");
  updateRealtimeAssets();
  updateTraditionalAssets();
}

// Export functions for other modules to use
export {
  updateAssetInDatabase,
  initializeWebSocket,
  ensurePolygonSymbols,
  initializePolygonCryptoWebSocket,
  initializePolygonForexWebSocket,
  areMarketsOpen,
};

// بدء عملية التهيئة
initialize();

// جدولة التحديثات المنتظمة
console.log(`جدولة التحديثات بالفواصل الزمنية التالية:
- العملات الرقمية والفوركس: ${FOREX_CRYPTO_UPDATE_INTERVAL / 1000} ثوانٍ
- الأسهم والمؤشرات: ${OTHER_ASSETS_UPDATE_INTERVAL / 1000} ثوانٍ (${OTHER_ASSETS_UPDATE_INTERVAL / 60000} دقائق)
- تداول الأحد: العملات الرقمية فقط (الأسواق الأخرى مغلقة)`);

// بدء جدولة التحديثات المنتظمة
setInterval(updateRealtimeAssets, FOREX_CRYPTO_UPDATE_INTERVAL);
setInterval(updateTraditionalAssets, OTHER_ASSETS_UPDATE_INTERVAL);
