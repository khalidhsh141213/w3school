/**
 * Simple Polygon WebSocket Test Script
 *
 * Tests WebSocket connection and authentication with Polygon.io
 */
import dotenv from "dotenv";
import WebSocket from "ws";

// Load environment variables
dotenv.config({ path: ".env.development" });

// WebSocket URLs
const POLYGON_CRYPTO_WS_URL = "wss://socket.polygon.io/crypto";

// Check API keys
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
// Use the direct hard-coded WebSocket API key
const POLYGON_WS_API_KEY = "l5FtOG5QR83LKxj0lZHoKuMxu9bnvalv";

console.log("===== POLYGON WEBSOCKET CONNECTION TEST =====");
console.log(
  `Polygon REST API Key available: ${POLYGON_API_KEY ? "Yes" : "No"}`,
);
console.log(
  `Polygon WebSocket API Key available: ${POLYGON_WS_API_KEY ? "Yes" : "No"}`,
);

// Try connecting with both API keys to see which one works
testConnection("WebSocket API Key", POLYGON_WS_API_KEY);
setTimeout(() => {
  testConnection("REST API Key", POLYGON_API_KEY);
}, 3000);

function testConnection(keyType, apiKey) {
  console.log(`\nTesting connection with ${keyType}...`);

  const ws = new WebSocket(POLYGON_CRYPTO_WS_URL);

  ws.on("open", () => {
    console.log(`Connection established using ${keyType}`);

    // Send authentication message - the key needs to be passed as a string parameter
    const authMessage = {
      action: "auth",
      params: apiKey,
    };

    console.log(`Sending authentication request with ${keyType}`);
    ws.send(JSON.stringify(authMessage));
  });

  ws.on("message", (data) => {
    const message = JSON.parse(data);
    console.log(`Received message using ${keyType}:`, JSON.stringify(message));

    // Check for auth success
    if (
      message[0] &&
      message[0].ev === "status" &&
      message[0].status === "auth_success"
    ) {
      console.log(`✅ Authentication SUCCESSFUL using ${keyType}`);

      // Subscribe to a test symbol
      const subscribeMessage = {
        action: "subscribe",
        params: "XT.BTC-USD",
      };

      ws.send(JSON.stringify(subscribeMessage));
      console.log(`Subscribed to test symbol using ${keyType}`);

      // Close after 5 seconds
      setTimeout(() => {
        console.log(`Test complete for ${keyType}, closing connection`);
        ws.close();
      }, 5000);
    }

    if (
      message[0] &&
      message[0].ev === "status" &&
      message[0].status === "auth_failed"
    ) {
      console.log(`❌ Authentication FAILED using ${keyType}`);
      ws.close();
    }
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error using ${keyType}:`, error);
  });

  ws.on("close", () => {
    console.log(`Connection closed for ${keyType}`);
  });
}
