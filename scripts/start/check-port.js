console.log("Creating port checker script...");
const net = require("net");
const port = parseInt(process.argv[2] || "0", 10);
const server = net.createServer();
server.once("error", (err) => {
  process.stdout.write(err.code === "EADDRINUSE" ? "PORT_IN_USE" : "ERROR");
  process.exit(0);
});
server.once("listening", () => {
  server.close();
  process.stdout.write("PORT_FREE");
  process.exit(0);
});
server.listen(port, "0.0.0.0");
