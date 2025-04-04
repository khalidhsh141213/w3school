/**
 * Test Polygon WebSocket API directly
 *
 * This script tests the direct connection to Polygon.io WebSocket API
 * to verify real-time data delivery for forex and crypto.
 */

import WebSocket from "ws";

// Get API key from environment variable
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

if (!POLYGON_API_KEY) {
  console.error("Error: POLYGON_API_KEY environment variable not set.");
  process.exit(1);
}

// Create WebSocket connection to Polygon
async function connectToPolygonWebSocket() {
  console.log("Connecting to Polygon WebSocket API...");

  // Create WebSocket connection for crypto
  const wsCrypto = new WebSocket(`wss://socket.polygon.io/crypto`);

  wsCrypto.on("open", () => {
    console.log("Connected to Polygon Crypto WebSocket");

    // Authenticate with API key
    wsCrypto.send(JSON.stringify({ action: "auth", params: POLYGON_API_KEY }));

    // Subscribe to BTC-USD and ETH-USD
    const subscribeMsg = JSON.stringify({
      action: "subscribe",
      params: "XT.BTC-USD,XT.ETH-USD",
    });

    console.log("Subscribing to crypto channels:", subscribeMsg);
    wsCrypto.send(subscribeMsg);
  });

  wsCrypto.on("message", (data) => {
    try {
      const message = JSON.parse(data);
      console.log(
        "Crypto WebSocket Message:",
        JSON.stringify(message, null, 2),
      );

      // Check for authentication status
      if (message[0] && message[0].ev === "status") {
        console.log(`Crypto WebSocket Status: ${message[0].status}`);

        if (message[0].status === "auth_success") {
          console.log(
            "Successfully authenticated with Polygon Crypto WebSocket",
          );
        }
      }
    } catch (error) {
      console.error("Error parsing crypto WebSocket message:", error);
    }
  });

  wsCrypto.on("error", (error) => {
    console.error("Crypto WebSocket error:", error);
  });

  wsCrypto.on("close", () => {
    console.log("Crypto WebSocket connection closed");
  });

  // Create WebSocket connection for forex
  const wsForex = new WebSocket(`wss://socket.polygon.io/forex`);

  wsForex.on("open", () => {
    console.log("Connected to Polygon Forex WebSocket");

    // Authenticate with API key
    wsForex.send(JSON.stringify({ action: "auth", params: POLYGON_API_KEY }));

    // Subscribe to EUR/USD
    const subscribeMsg = JSON.stringify({
      action: "subscribe",
      params: "C.EUR/USD",
    });

    console.log("Subscribing to forex channels:", subscribeMsg);
    wsForex.send(subscribeMsg);
  });

  wsForex.on("message", (data) => {
    try {
      const message = JSON.parse(data);
      console.log("Forex WebSocket Message:", JSON.stringify(message, null, 2));

      // Check for authentication status
      if (message[0] && message[0].ev === "status") {
        console.log(`Forex WebSocket Status: ${message[0].status}`);

        if (message[0].status === "auth_success") {
          console.log(
            "Successfully authenticated with Polygon Forex WebSocket",
          );
        }
      }
    } catch (error) {
      console.error("Error parsing forex WebSocket message:", error);
    }
  });

  wsForex.on("error", (error) => {
    console.error("Forex WebSocket error:", error);
  });

  wsForex.on("close", () => {
    console.log("Forex WebSocket connection closed");
  });
}

// Run the test
connectToPolygonWebSocket().catch((error) => {
  console.error("Failed to connect to Polygon WebSocket:", error);
});

// Keep the process running
process.stdin.resume();

// Handle cleanup
process.on("SIGINT", () => {
  console.log("Closing WebSocket connections...");
  process.exit();
});
