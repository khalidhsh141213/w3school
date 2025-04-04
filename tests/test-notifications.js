import WebSocket from "ws";

// Connect to the WebSocket server
const ws = new WebSocket("ws://0.0.0.0:5000/ws");

// Connection opened
ws.on("open", function () {
  console.log("Connected to WebSocket server");

  // Register for notifications with a userId
  ws.send(
    JSON.stringify({
      type: "notifications_register",
      userId: 1, // Admin user
      notificationTypes: ["economic_event", "price_alert", "system"],
    }),
  );
});

// Listen for messages
ws.on("message", function (data) {
  const message = JSON.parse(data.toString());
  console.log("Received message type:", message.type);

  // Pretty print notifications
  if (message.type === "notification" || message.type === "notifications") {
    const notifications =
      message.type === "notifications" ? message.data : [message.data];
    console.log("Notifications:");
    notifications.forEach((notification) => {
      console.log(
        `- [${notification.importance}] ${notification.title}: ${notification.message}`,
      );
    });
  } else {
    console.log("Message data:", message);
  }
});

// Listen for errors
ws.on("error", function (error) {
  console.error("WebSocket error:", error);
});

// Listen for close events
ws.on("close", function () {
  console.log("Disconnected from WebSocket server");
});

// Close the connection after 30 seconds
setTimeout(() => {
  ws.close();
  console.log("WebSocket connection closed by client");
}, 30000);
