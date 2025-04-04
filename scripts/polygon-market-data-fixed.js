/**
 * Polygon.io Market Data Integration - Fixed WebSocket Implementation
 *
 * This file implements real-time market data updates via Polygon.io WebSockets
 * with proper error handling, reconnection logic, and synchronization between
 * market_data and assets tables.
 *
 * It features:
 * - Proper WebSocket connection management with clean teardown
 * - Separate WebSocket connections for crypto and forex assets
 * - REST API fallback for closed markets and connection issues
 * - Circuit-breaker pattern to prevent excessive reconnect attempts
 * - Automatic synchronization of price updates between assets and market_data tables
 */

import WebSocket from "ws";
import fetch from "node-fetch";
import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// WebSocket connection references
let cryptoWs = null;
let forexWs = null;

// API endpoints and configuration
const CRYPTO_WS_URL = "wss://socket.polygon.io/crypto";
const FOREX_WS_URL = "wss://socket.polygon.io/forex";
const CRYPTO_REST_URL =
  "https://api.polygon.io/v2/snapshot/locale/global/markets/crypto/tickers";
const FOREX_REST_URL =
  "https://api.polygon.io/v2/snapshot/locale/global/markets/forex/tickers";

// Use environment API key instead of hardcoded key to avoid connection limits
const POLYGON_WS_API_KEY =
  process.env.POLYGON_API_KEY || process.env.POLYGON_WS_API_KEY; // Use environment variable
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || POLYGON_WS_API_KEY; // Fallback for REST API

// Database configuration
const DB_CONFIG = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
};
const pool = new Pool(DB_CONFIG);
const MARKET_DATA_TABLE = "market_data";

// Circuit breaker configuration
let consecutiveFailures = 0;
const MAX_FAILURES = 5;
const INITIAL_RECONNECT_DELAY = 5000; // 5 seconds initially to be less aggressive
const MAX_RECONNECT_DELAY = 600000; // 10 minutes
let reconnectDelay = INITIAL_RECONNECT_DELAY;

// Ensure we don't have too many simultaneous connections
let activeConnectionCount = 0;
const MAX_ACTIVE_CONNECTIONS = 2; // Maximum 2 active connections at once to avoid hitting Polygon limits

// Internal WebSocket server for broadcasting updates to frontend
// We don't create a new one, but use the existing one from the application
// through the emitPriceUpdate function

/**
 * Check if a given market is open
 * @param {string} marketType - 'forex' or 'crypto'
 * @returns {boolean} - True if market is open
 */
function isMarketOpen(marketType) {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 is Sunday, 6 is Saturday in UTC

  if (marketType === "crypto") {
    // Crypto markets are always open
    return true;
  } else if (marketType === "forex") {
    // Forex markets are closed on weekends in UTC time
    // Closed on Saturday and Sunday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Check for specific forex trading hours if needed
    // This is a simplified version - real forex markets have more complex hours
    return true;
  }

  return false;
}

/**
 * Initialize market data connections
 */
export async function initialize() {
  try {
    console.log("Starting Polygon.io market data integration...");

    // Get assets grouped by type from database
    const { crypto, forex } = await getAssetsByTypes(["crypto", "forex"]);

    // Reset active connection count
    activeConnectionCount = 0;

    // Configure DEBUG environment information
    console.log("===== POLYGON WEBSOCKET DEBUG =====");
    console.log(
      `DEBUG: Environment mode: ${process.env.NODE_ENV || "development"}`,
    );
    console.log(
      `DEBUG: Polygon API key available: ${POLYGON_API_KEY ? "Yes" : "No"}`,
    );
    console.log(
      `DEBUG: Polygon WebSocket API key available: ${POLYGON_WS_API_KEY ? "Yes" : "No"}`,
    );

    // Initialize WebSocket connections for open markets if we don't exceed connection limits
    if (
      isMarketOpen("crypto") &&
      crypto.length > 0 &&
      activeConnectionCount < MAX_ACTIVE_CONNECTIONS
    ) {
      console.log("Initializing crypto WebSocket connection");
      await initializeCryptoWebSocket(crypto);
    } else if (crypto.length > 0) {
      console.log(
        "Crypto market is closed, connections at limit, or no assets found, using REST API instead",
      );
      updateCryptoViaREST(crypto);
    }

    // Only connect to forex if we have room for more connections
    if (
      isMarketOpen("forex") &&
      forex.length > 0 &&
      activeConnectionCount < MAX_ACTIVE_CONNECTIONS
    ) {
      console.log("Initializing forex WebSocket connection");
      await initializeForexWebSocket(forex);
    } else if (forex.length > 0) {
      console.log(
        "Forex market is closed, connections at limit, or no assets found, using REST API instead",
      );
      updateForexViaREST(forex);
    }

    // Set up REST fallback for all assets to ensure we have data even if WebSockets fail
    setupRESTFallback([...crypto, ...forex]);

    console.log(
      "Market data integration initialized with WebSockets and REST fallbacks",
    );
    console.log(
      `Active connection count: ${activeConnectionCount}/${MAX_ACTIVE_CONNECTIONS}`,
    );
  } catch (error) {
    console.error("Failed to initialize market data integration:", error);
  }
}

/**
 * Set up REST fallback for all asset types
 * @param {Array} assets - Combined assets to update
 */
function setupRESTFallback(assets) {
  // Schedule REST updates at different intervals
  const restUpdateInterval = 60000; // 1 minute for REST updates as fallback

  // Schedule regular updates using REST API as a fallback
  setInterval(() => {
    updateAllAssetsViaREST(assets);
  }, restUpdateInterval);
}

/**
 * Update all assets via REST API
 * @param {Array} assets - Assets to update
 */
async function updateAllAssetsViaREST(assets) {
  try {
    const cryptoAssets = assets.filter((asset) => asset.type === "crypto");
    const forexAssets = assets.filter((asset) => asset.type === "forex");

    // Check if WebSockets are working, if not, use REST
    if (
      cryptoAssets.length > 0 &&
      (!cryptoWs || cryptoWs.readyState !== WebSocket.OPEN)
    ) {
      console.log("Crypto WebSocket not connected, using REST fallback");
      await updateCryptoViaREST(cryptoAssets);
    }

    if (
      forexAssets.length > 0 &&
      (!forexWs || forexWs.readyState !== WebSocket.OPEN)
    ) {
      console.log("Forex WebSocket not connected, using REST fallback");
      await updateForexViaREST(forexAssets);
    }
  } catch (error) {
    console.error("Error in REST fallback update:", error);
  }
}

/**
 * Get assets by type from database
 * @param {string[]} types - Asset types to retrieve
 * @returns {Object} - Object with assets grouped by type
 */
async function getAssetsByTypes(types) {
  const result = {};

  try {
    for (const type of types) {
      const query = `
        SELECT id, symbol, type, "polygon_symbol" as "polygonSymbol", name, currency
        FROM assets 
        WHERE type = $1 AND is_active = true
      `;
      const { rows } = await pool.query(query, [type]);
      result[type] = rows;
    }
  } catch (error) {
    console.error("Error fetching assets by type:", error);
    // Return empty arrays for each type if there's an error
    types.forEach((type) => {
      result[type] = [];
    });
  }

  return result;
}

/**
 * Initialize WebSocket connection for crypto assets
 * @param {Array} assets - Array of crypto assets
 */
async function initializeCryptoWebSocket(assets) {
  try {
    // Check if we have too many active connections
    if (activeConnectionCount >= MAX_ACTIVE_CONNECTIONS) {
      console.log(
        "Maximum active connections reached, cannot initialize Crypto WebSocket",
      );
      return;
    }

    // Clean up existing connection if any
    cleanupWebSocket("crypto");

    // Create new WebSocket connection
    cryptoWs = new WebSocket(CRYPTO_WS_URL);
    activeConnectionCount++; // Increase active connection count
    console.log(
      `Active connections after crypto init: ${activeConnectionCount}`,
    );

    cryptoWs.on("open", () => {
      console.log("Crypto WebSocket connected");
      consecutiveFailures = 0;
      reconnectDelay = INITIAL_RECONNECT_DELAY;

      // Send authentication message with WebSocket-specific key
      const authMsg = { action: "auth", params: POLYGON_WS_API_KEY };
      cryptoWs.send(JSON.stringify(authMsg));
    });

    cryptoWs.on("message", async (data) => {
      try {
        const messages = JSON.parse(data);

        for (const msg of messages) {
          if (msg.ev === "status" && msg.status === "auth_success") {
            console.log("Polygon.io authentication successful for crypto");
            // After successful auth, subscribe to crypto channels
            subscribeToCryptoChannels(assets);
          } else if (msg.ev === "XA" || msg.ev === "XT") {
            // Process crypto price update
            await processPolygonCryptoMessage(msg);
          }
        }
      } catch (error) {
        console.error("Error processing crypto WebSocket message:", error);
      }
    });

    cryptoWs.on("close", () => {
      console.log("Crypto WebSocket connection closed");
      if (cryptoWs) {
        activeConnectionCount--; // Decrease active connection count
        console.log(
          `Active connections after crypto close: ${activeConnectionCount}`,
        );
        cryptoWs = null;
      }
      scheduleReconnect("crypto");
    });

    cryptoWs.on("error", (error) => {
      console.error("Crypto WebSocket error:", error.message);
      // No need to call scheduleReconnect here as the 'close' event will be triggered after an error
      consecutiveFailures++;
    });
  } catch (error) {
    console.error("Failed to initialize crypto WebSocket:", error);
    scheduleReconnect("crypto");
  }
}

/**
 * Clean up a WebSocket connection
 * @param {string} type - 'crypto' or 'forex'
 */
function cleanupWebSocket(type) {
  if (type === "crypto" && cryptoWs) {
    try {
      console.log("Cleaning up crypto WebSocket connection");

      // Decrement connection count only if we're actually closing an active connection
      if (
        cryptoWs.readyState === WebSocket.OPEN ||
        cryptoWs.readyState === WebSocket.CONNECTING
      ) {
        activeConnectionCount = Math.max(0, activeConnectionCount - 1);
        console.log(
          `Active connections after crypto cleanup: ${activeConnectionCount}`,
        );
      }

      // Remove all event listeners to prevent callbacks after cleanup
      if (typeof cryptoWs.removeAllListeners === "function") {
        cryptoWs.removeAllListeners();
      }

      // Check if the connection is actually established before closing
      if (cryptoWs.readyState === WebSocket.OPEN) {
        console.log("Closing established crypto WebSocket connection");
        // Use close instead of terminate for established connections
        cryptoWs.close();
      } else if (cryptoWs.readyState === WebSocket.CONNECTING) {
        console.log("Canceling connecting crypto WebSocket");
        // For connecting state, we need to set up the close handler and wait
        cryptoWs.onopen = () => {
          cryptoWs.close();
        };
        // Set a timeout to ensure we don't hang
        setTimeout(() => {
          if (cryptoWs) {
            console.log("Timeout reached, forcing crypto WebSocket cleanup");
            cryptoWs = null;
          }
        }, 1000);
      } else {
        console.log("Crypto WebSocket already closing or closed");
      }

      // Reset the reference, but with a delay if needed
      if (cryptoWs.readyState !== WebSocket.CONNECTING) {
        cryptoWs = null;
      }
    } catch (error) {
      console.error("Error cleaning up crypto WebSocket:", error);
      // Ensure reference is cleared even on error
      cryptoWs = null;
      // Make sure we decrement the count even on error
      activeConnectionCount = Math.max(0, activeConnectionCount - 1);
    }
  } else if (type === "forex" && forexWs) {
    try {
      console.log("Cleaning up forex WebSocket connection");

      // Decrement connection count only if we're actually closing an active connection
      if (
        forexWs.readyState === WebSocket.OPEN ||
        forexWs.readyState === WebSocket.CONNECTING
      ) {
        activeConnectionCount = Math.max(0, activeConnectionCount - 1);
        console.log(
          `Active connections after forex cleanup: ${activeConnectionCount}`,
        );
      }

      // Remove all event listeners to prevent callbacks after cleanup
      if (typeof forexWs.removeAllListeners === "function") {
        forexWs.removeAllListeners();
      }

      // Check if the connection is actually established before closing
      if (forexWs.readyState === WebSocket.OPEN) {
        console.log("Closing established forex WebSocket connection");
        // Use close instead of terminate for established connections
        forexWs.close();
      } else if (forexWs.readyState === WebSocket.CONNECTING) {
        console.log("Canceling connecting forex WebSocket");
        // For connecting state, we need to set up the close handler and wait
        forexWs.onopen = () => {
          forexWs.close();
        };
        // Set a timeout to ensure we don't hang
        setTimeout(() => {
          if (forexWs) {
            console.log("Timeout reached, forcing forex WebSocket cleanup");
            forexWs = null;
          }
        }, 1000);
      } else {
        console.log("Forex WebSocket already closing or closed");
      }

      // Reset the reference, but with a delay if needed
      if (forexWs.readyState !== WebSocket.CONNECTING) {
        forexWs = null;
      }
    } catch (error) {
      console.error("Error cleaning up forex WebSocket:", error);
      // Ensure reference is cleared even on error
      forexWs = null;
      // Make sure we decrement the count even on error
      activeConnectionCount = Math.max(0, activeConnectionCount - 1);
    }
  }
}

/**
 * Subscribe to crypto channels
 * @param {Array} assets - Crypto assets
 */
function subscribeToCryptoChannels(assets) {
  if (!cryptoWs || cryptoWs.readyState !== WebSocket.OPEN) {
    console.error("Cannot subscribe to crypto channels: WebSocket not open");
    return;
  }

  const channels = [];

  // Add proper formatted crypto channels - XA is for quotes, XT is for trades
  assets.forEach((asset) => {
    if (asset.polygonSymbol) {
      // Use proper format for subscription: XT.BTCUSD, XA.ETHUSD, etc.
      const ticker = asset.polygonSymbol.split(":")[1];
      if (ticker) {
        channels.push(`XT.${ticker}`); // Subscribe to trades
        channels.push(`XA.${ticker}`); // Subscribe to quotes
      }
    }
  });

  if (channels.length > 0) {
    // Send subscription message in batches to avoid overloading
    const batchSize = 20;
    for (let i = 0; i < channels.length; i += batchSize) {
      const batchChannels = channels.slice(i, i + batchSize);
      const subscribeMsg = {
        action: "subscribe",
        params: batchChannels.join(","),
      };

      console.log(
        `Subscribing to crypto channels: ${batchChannels.join(", ")}`,
      );
      cryptoWs.send(JSON.stringify(subscribeMsg));
    }
  } else {
    console.warn("No valid crypto channels to subscribe to");
  }
}

/**
 * Process a crypto message from Polygon
 * @param {Object} msg - The message from Polygon
 */
async function processPolygonCryptoMessage(msg) {
  try {
    if (msg.ev === "XA" || msg.ev === "XT") {
      // Extract ticker and normalize it
      const ticker = msg.pair; // e.g., BTCUSD

      // Find the matching asset by polygon_symbol
      const query = `SELECT id, symbol FROM assets WHERE "polygon_symbol" = $1`;
      const { rows } = await pool.query(query, [`X:${ticker}`]);

      if (rows.length === 0) {
        return; // No matching asset found
      }

      const asset = rows[0];

      // Process quote data (XA) or trade data (XT)
      const priceData = {
        symbol: asset.symbol,
        price: msg.p || (msg.bp + msg.ap) / 2, // Use price or mid-price from bid/ask
        dailyChange: msg.c || 0,
        dailyChangePercent: msg.cp ? msg.cp.toString() : "0",
        volume: msg.v ? msg.v.toString() : "0",
        high24h: msg.h ? msg.h.toString() : null,
        low24h: msg.l ? msg.l.toString() : null,
      };

      // Update the asset in database
      await updateAssetPrice(priceData);
    }
  } catch (error) {
    console.error("Error processing crypto message:", error);
  }
}

/**
 * Initialize WebSocket connection for forex assets
 * @param {Array} assets - Array of forex assets
 */
async function initializeForexWebSocket(assets) {
  try {
    // Check if we have too many active connections
    if (activeConnectionCount >= MAX_ACTIVE_CONNECTIONS) {
      console.log(
        "Maximum active connections reached, cannot initialize Forex WebSocket",
      );
      return;
    }

    // Clean up existing connection if any
    cleanupWebSocket("forex");

    // Create new WebSocket connection
    forexWs = new WebSocket(FOREX_WS_URL);
    activeConnectionCount++; // Increase active connection count
    console.log(
      `Active connections after forex init: ${activeConnectionCount}`,
    );

    forexWs.on("open", () => {
      console.log("Forex WebSocket connected");
      consecutiveFailures = 0;
      reconnectDelay = INITIAL_RECONNECT_DELAY;

      // Send authentication message with WebSocket-specific key
      const authMsg = { action: "auth", params: POLYGON_WS_API_KEY };
      forexWs.send(JSON.stringify(authMsg));
    });

    forexWs.on("message", async (data) => {
      try {
        const messages = JSON.parse(data);

        for (const msg of messages) {
          if (msg.ev === "status" && msg.status === "auth_success") {
            console.log("Polygon.io authentication successful for forex");
            // After successful auth, subscribe to forex channels
            subscribeToForexChannels(assets);
          } else if (msg.ev === "C") {
            // Process forex price update
            await processPolygonForexMessage(msg);
          }
        }
      } catch (error) {
        console.error("Error processing forex WebSocket message:", error);
      }
    });

    forexWs.on("close", () => {
      console.log("Forex WebSocket connection closed");
      if (forexWs) {
        activeConnectionCount--; // Decrease active connection count
        console.log(
          `Active connections after forex close: ${activeConnectionCount}`,
        );
        forexWs = null;
      }
      scheduleReconnect("forex");
    });

    forexWs.on("error", (error) => {
      console.error("Forex WebSocket error:", error.message);
      // No need to call scheduleReconnect here as the 'close' event will be triggered after an error
      consecutiveFailures++;
    });
  } catch (error) {
    console.error("Failed to initialize forex WebSocket:", error);
    scheduleReconnect("forex");
  }
}

/**
 * Subscribe to forex channels
 * @param {Array} assets - Forex assets
 */
function subscribeToForexChannels(assets) {
  if (!forexWs || forexWs.readyState !== WebSocket.OPEN) {
    console.error("Cannot subscribe to forex channels: WebSocket not open");
    return;
  }

  const channels = [];

  // Add proper formatted forex channels - C is for forex
  assets.forEach((asset) => {
    if (asset.polygonSymbol) {
      // Use proper format for subscription: C.EURUSD, C.USDJPY, etc.
      const ticker = asset.polygonSymbol.split(":")[1];
      if (ticker) {
        channels.push(`C.${ticker}`);
      }
    }
  });

  if (channels.length > 0) {
    // Send subscription message in batches to avoid overloading
    const batchSize = 20;
    for (let i = 0; i < channels.length; i += batchSize) {
      const batchChannels = channels.slice(i, i + batchSize);
      const subscribeMsg = {
        action: "subscribe",
        params: batchChannels.join(","),
      };

      console.log(`Subscribing to forex channels: ${batchChannels.join(", ")}`);
      forexWs.send(JSON.stringify(subscribeMsg));
    }
  } else {
    console.warn("No valid forex channels to subscribe to");
  }
}

/**
 * Process a forex message from Polygon
 * @param {Object} msg - The message from Polygon
 */
async function processPolygonForexMessage(msg) {
  try {
    if (msg.ev === "C") {
      // Extract ticker and normalize it
      const ticker = msg.p; // e.g., EURUSD

      // Find the matching asset by polygon_symbol
      const query = `SELECT id, symbol FROM assets WHERE "polygon_symbol" = $1`;
      const { rows } = await pool.query(query, [`C:${ticker}`]);

      if (rows.length === 0) {
        return; // No matching asset found
      }

      const asset = rows[0];

      // Process forex data
      const priceData = {
        symbol: asset.symbol,
        price: msg.a || msg.b, // Use ask or bid price
        dailyChange: msg.c || 0,
        dailyChangePercent: msg.cp ? msg.cp.toString() : "0",
        volume: msg.v ? msg.v.toString() : "0",
        high24h: msg.h ? msg.h.toString() : null,
        low24h: msg.l ? msg.l.toString() : null,
      };

      // Update the asset in database
      await updateAssetPrice(priceData);
    }
  } catch (error) {
    console.error("Error processing forex message:", error);
  }
}

/**
 * Update crypto data via REST API
 * @param {Array} assets - Crypto assets to update
 */
async function updateCryptoViaREST(assets) {
  try {
    if (!assets || assets.length === 0) {
      return;
    }

    console.log(`Updating ${assets.length} crypto assets via REST API...`);

    // Get list of ticker symbols for API request
    const tickerSymbols = assets
      .filter((asset) => asset.polygonSymbol)
      .map((asset) => asset.polygonSymbol.split(":")[1])
      .join(",");

    if (!tickerSymbols) {
      console.log("No valid ticker symbols for crypto REST update");
      return;
    }

    // Make API request to Polygon using WebSocket-specific key for consistency
    const url = `${CRYPTO_REST_URL}?tickers=${tickerSymbols}&apiKey=${POLYGON_WS_API_KEY}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(
        `Crypto REST API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    if (!data.tickers || data.tickers.length === 0) {
      console.warn("No crypto ticker data returned from REST API");
      return;
    }

    // Process each ticker and update database
    for (const ticker of data.tickers) {
      const assetSymbol = ticker.ticker.substring(1); // Remove 'X:' prefix

      // Find the matching asset
      const asset = assets.find(
        (a) => a.polygonSymbol && a.polygonSymbol.includes(assetSymbol),
      );
      if (!asset) continue;

      // Create price update object
      const priceData = {
        symbol: asset.symbol,
        price: ticker.lastTrade?.p || ticker.lastQuote?.p || 0,
        dailyChange: ticker.todaysChange || 0,
        dailyChangePercent: ticker.todaysChangePerc?.toString() || "0",
        volume: ticker.day?.v?.toString() || "0",
        high24h: ticker.day?.h?.toString() || null,
        low24h: ticker.day?.l?.toString() || null,
      };

      // Update database
      await updateAssetPrice(priceData);
    }

    console.log(`Updated ${data.tickers.length} crypto assets via REST API`);
  } catch (error) {
    console.error("Error updating crypto assets via REST:", error);
  }
}

/**
 * Update forex data via REST API (when market is closed)
 * @param {Array} assets - Forex assets to update
 */
async function updateForexViaREST(assets) {
  try {
    if (!assets || assets.length === 0) {
      return;
    }

    console.log(`Updating ${assets.length} forex assets via REST API...`);

    // Get list of ticker symbols for API request
    const tickerSymbols = assets
      .filter((asset) => asset.polygonSymbol)
      .map((asset) => asset.polygonSymbol.split(":")[1])
      .join(",");

    if (!tickerSymbols) {
      console.log("No valid ticker symbols for forex REST update");
      return;
    }

    // Make API request to Polygon using WebSocket-specific key for consistency
    const url = `${FOREX_REST_URL}?tickers=${tickerSymbols}&apiKey=${POLYGON_WS_API_KEY}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(
        `Forex REST API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    if (!data.tickers || data.tickers.length === 0) {
      console.warn("No forex ticker data returned from REST API");
      return;
    }

    // Process each ticker and update database
    for (const ticker of data.tickers) {
      const assetSymbol = ticker.ticker.substring(2); // Remove 'C:' prefix

      // Find the matching asset
      const asset = assets.find(
        (a) => a.polygonSymbol && a.polygonSymbol.includes(assetSymbol),
      );
      if (!asset) continue;

      // Create price update object
      const priceData = {
        symbol: asset.symbol,
        price: ticker.lastQuote?.a || ticker.lastQuote?.b || 0,
        dailyChange: ticker.todaysChange || 0,
        dailyChangePercent: ticker.todaysChangePerc?.toString() || "0",
        volume: ticker.day?.v?.toString() || "0",
        high24h: ticker.day?.h?.toString() || null,
        low24h: ticker.day?.l?.toString() || null,
      };

      // Update database
      await updateAssetPrice(priceData);
    }

    console.log(`Updated ${data.tickers.length} forex assets via REST API`);
  } catch (error) {
    console.error("Error updating forex assets via REST:", error);
  }
}

/**
 * Update asset price in database
 * @param {Object} data - Price data to update
 */
async function updateAssetPrice(data) {
  try {
    if (!data || !data.symbol) {
      console.error("Invalid data object for asset price update");
      return;
    }

    // Get current time for updating the record
    const now = new Date();

    // Check if market data exists for this asset
    let assetDataExists = false;
    try {
      const checkQuery = `SELECT id FROM ${MARKET_DATA_TABLE} WHERE symbol = $1`;
      const checkResult = await pool.query(checkQuery, [data.symbol]);
      assetDataExists = checkResult.rows.length > 0;
    } catch (error) {
      console.error(
        `Error checking market data existence for ${data.symbol}:`,
        error,
      );
    }

    try {
      if (assetDataExists) {
        // Update existing record with direct SQL
        await pool.query(
          `
          UPDATE ${MARKET_DATA_TABLE}
          SET price = $1, 
              "dailyChange" = $2, 
              "dailyChangePercent" = $3, 
              volume = $4, 
              high24h = $5, 
              low24h = $6, 
              "updatedAt" = $7
          WHERE symbol = $8
        `,
          [
            data.price,
            data.dailyChange,
            data.dailyChangePercent,
            data.volume,
            data.high24h,
            data.low24h,
            now,
            data.symbol,
          ],
        );
      } else {
        // Insert new record with direct SQL
        await pool.query(
          `
          INSERT INTO ${MARKET_DATA_TABLE}
          (symbol, price, "dailyChange", "dailyChangePercent", volume, high24h, low24h, "intradayChange", "intradayChangePercent", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
          [
            data.symbol,
            data.price,
            data.dailyChange,
            data.dailyChangePercent,
            data.volume,
            data.high24h,
            data.low24h,
            null, // intradayChange
            null, // intradayChangePercent
            now, // updatedAt
          ],
        );
      }

      // Also update the assets table with the latest price to maintain synchronization
      try {
        // First check if the price actually changed to avoid unnecessary updates
        const checkAssetQuery = `
          SELECT price, "priceChange", "priceChangePercentage" 
          FROM assets 
          WHERE symbol = $1
        `;
        const assetResult = await pool.query(checkAssetQuery, [data.symbol]);

        // Only update if asset exists and price has changed
        if (assetResult.rows.length > 0) {
          const asset = assetResult.rows[0];

          // Check if the price or price change data has been modified
          if (
            asset.price !== data.price.toString() ||
            asset.priceChange !== data.dailyChange.toString() ||
            asset.priceChangePercentage !== data.dailyChangePercent.toString()
          ) {
            // Update the asset record with the new data
            const updateAssetQuery = `
              UPDATE assets 
              SET price = $1, 
                  "priceChange" = $2, 
                  "priceChangePercentage" = $3,
                  "high24h" = $4,
                  "low24h" = $5,
                  "dailyVolume" = $6,
                  "lastUpdatedAt" = $7
              WHERE symbol = $8
            `;

            await pool.query(updateAssetQuery, [
              data.price,
              data.dailyChange,
              data.dailyChangePercent,
              data.high24h,
              data.low24h,
              data.volume,
              now,
              data.symbol,
            ]);

            console.log(
              `Updated asset price for ${data.symbol}: $${data.price} (${data.dailyChangePercent}%)`,
            );
          } else {
            // If no change in price, just update the timestamp
            const updateTimestampQuery = `
              UPDATE assets SET "lastUpdatedAt" = $1 WHERE symbol = $2
            `;
            await pool.query(updateTimestampQuery, [now, data.symbol]);
          }
        }
      } catch (error) {
        console.error(`Error updating asset price for ${data.symbol}:`, error);
      }

      // Emit the update to all connected clients
      emitPriceUpdate(data.symbol, data);

      return true;
    } catch (error) {
      console.error(`Error updating market data for ${data.symbol}:`, error);
      return false;
    }
  } catch (error) {
    console.error("Error in updateAssetPrice:", error);
    return false;
  }
}

/**
 * Emit a price update event via internal WebSocket system
 * @param {string} symbol - Asset symbol
 * @param {Object} data - Price data
 */
function emitPriceUpdate(symbol, data) {
  try {
    // We assume there's a WebSocket server in the app to emit updates
    // This is typically managed by the internal WebSocketService

    // For now we log the action as a placeholder for an actual implementation
    // The actual implementation will be connected to the app's WebSocket server
    console.log(
      `[WebSocket] Emitted price update for ${symbol}: $${parseFloat(data.price).toFixed(4)}`,
    );

    // In a real implementation, you would emit through your WebSocket server
    // Example:
    // global.wss.clients.forEach(client => {
    //   if (client.readyState === WebSocket.OPEN) {
    //     client.send(JSON.stringify({
    //       type: 'marketUpdate',
    //       symbol: symbol,
    //       data: data
    //     }));
    //   }
    // });

    // The main application should have its WebSocket server available
    // Either globally or through an imported module
    if (global.wss) {
      const message = JSON.stringify({
        type: "marketUpdate",
        symbol: symbol,
        data: data,
      });

      global.wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  } catch (error) {
    console.error("Error emitting price update:", error);
  }
}

/**
 * Schedule reconnection for WebSocket with enhanced error handling
 * @param {string} type - 'crypto' or 'forex'
 */
function scheduleReconnect(type) {
  try {
    // Check if we're at connection limit
    if (activeConnectionCount >= MAX_ACTIVE_CONNECTIONS) {
      console.warn(
        `Cannot schedule ${type} WebSocket reconnect - active connection limit reached (${activeConnectionCount}/${MAX_ACTIVE_CONNECTIONS})`,
      );
      console.warn(`Using REST API fallback for ${type} data updates instead`);

      // Initialize REST update for this asset type
      if (type === "crypto") {
        getAssetsByTypes(["crypto"]).then((result) => {
          if (result.crypto && result.crypto.length > 0) {
            updateCryptoViaREST(result.crypto);
          }
        });
      } else if (type === "forex") {
        getAssetsByTypes(["forex"]).then((result) => {
          if (result.forex && result.forex.length > 0) {
            updateForexViaREST(result.forex);
          }
        });
      }
      return;
    }

    // Implement circuit breaker pattern
    if (consecutiveFailures >= MAX_FAILURES) {
      console.warn(
        `Circuit breaker triggered for ${type} WebSocket after ${consecutiveFailures} consecutive failures`,
      );
      console.warn(`Using REST API fallback for ${type} data updates`);

      // Switch to REST API for updates instead of constantly trying to reconnect
      return;
    }

    // Exponential backoff with a minimum delay after max_connections error
    const actualDelay = Math.min(
      reconnectDelay * Math.pow(1.5, consecutiveFailures),
      MAX_RECONNECT_DELAY,
    );
    // Ensure a minimum delay of 30 seconds after connection limit errors
    const finalDelay = Math.max(actualDelay, 30000);
    console.log(
      `Scheduling ${type} WebSocket reconnect in ${finalDelay / 1000} seconds...`,
    );

    // Schedule reconnection
    setTimeout(() => {
      // Check connection limit again when the timer fires
      if (activeConnectionCount >= MAX_ACTIVE_CONNECTIONS) {
        console.warn(
          `Cannot reconnect ${type} WebSocket - connection limit reached after delay`,
        );
        return;
      }

      if (type === "crypto") {
        console.log("Attempting to reconnect crypto WebSocket...");
        getAssetsByTypes(["crypto"]).then((result) => {
          if (result.crypto && result.crypto.length > 0) {
            initializeCryptoWebSocket(result.crypto);
          }
        });
      } else if (type === "forex") {
        console.log("Attempting to reconnect forex WebSocket...");
        getAssetsByTypes(["forex"]).then((result) => {
          if (
            result.forex &&
            result.forex.length > 0 &&
            isMarketOpen("forex")
          ) {
            initializeForexWebSocket(result.forex);
          }
        });
      }
    }, finalDelay);

    // Increase the reconnect delay for next time
    reconnectDelay = actualDelay;
  } catch (error) {
    console.error(`Error scheduling reconnect for ${type} WebSocket:`, error);
  }
}

// Initialize the system
initialize();
