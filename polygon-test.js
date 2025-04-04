import WebSocket from "ws";

// Get API key from environment
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

console.log("Starting polygon-test.js");
console.log(
  `API Key length: ${POLYGON_API_KEY ? POLYGON_API_KEY.length : "none"}`,
);
console.log(`API Key exact value: ${POLYGON_API_KEY || "not found"}`);

// Verify requirements for connection
if (!POLYGON_API_KEY) {
  console.error("ERROR: Missing POLYGON_API_KEY environment variable");
  process.exit(1);
}

try {
  // Create WebSocket connection with extra options
  console.log(
    "Creating WebSocket connection to wss://socket.polygon.io/crypto",
  );
  const ws = new WebSocket("wss://socket.polygon.io/crypto", {
    headers: {
      "User-Agent": "polygon-test/1.0.0",
    },
    handshakeTimeout: 10000,
  });

  // Connection opened
  ws.on("open", function () {
    console.log("WebSocket connection opened successfully");

    // Authenticate with API key
    try {
      const authMsg = JSON.stringify({
        action: "auth",
        params: POLYGON_API_KEY,
      });
      console.log("Sending auth message");
      ws.send(authMsg);
    } catch (err) {
      console.error("Error sending auth message:", err);
    }
  });

  // Listen for messages
  ws.on("message", function (data) {
    try {
      // Parse response
      const dataStr = data.toString();
      console.log("Message received: " + dataStr);
      const msg = JSON.parse(dataStr);

      // Check auth response
      if (
        msg.status === "connected" ||
        (Array.isArray(msg) &&
          msg.some(
            (m) => m.status === "auth_success" || m.status === "connected",
          ))
      ) {
        console.log("Authentication successful");

        // Subscribe to Bitcoin data after auth success
        const subMsg = JSON.stringify({
          action: "subscribe",
          params: "XT.X:BTCUSD",
        });
        console.log("Sending subscription message");
        ws.send(subMsg);
      } else {
        console.log("Authentication failed or other message received");
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });

  // Handle errors
  ws.on("error", function (error) {
    console.error("WebSocket error: " + error.message);
  });

  // Connection closed
  ws.on("close", function (code, reason) {
    console.log(`WebSocket connection closed with code ${code}: ${reason}`);
  });

  // Keep running for 30 seconds then exit
  setTimeout(() => {
    console.log("Test complete, closing connection");
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    } catch (err) {
      console.error("Error closing WebSocket:", err);
    }
    process.exit(0);
  }, 30000);

  // Set up debug logging for connection status
  setInterval(() => {
    if (ws) {
      console.log(`WebSocket readyState: ${ws.readyState}`);
    }
  }, 5000);
} catch (err) {
  console.error("Critical error in test script:", err);
}
