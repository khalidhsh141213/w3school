const express = require("express");
const app = express();
const PORT = 5001;

console.log("Starting test express server...");

app.get("/", (req, res) => {
  console.log("Root endpoint hit");
  res.send("Hello World!");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Test server running on http://0.0.0.0:${PORT}`);
});
