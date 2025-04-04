import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import WebSocket from "ws";
import { setupTestDatabase, cleanupTestDatabase } from "../helpers/db-utils";
import { startMockServer, stopMockServer } from "../helpers/server-utils";

describe("WebSocket Tests", () => {
  let ws;
  let server;

  beforeEach(async () => {
    await setupTestDatabase();
    server = await startMockServer();
  });

  afterEach(async () => {
    if (ws) {
      ws.close();
    }
    if (server) {
      await stopMockServer(server);
    }
    await cleanupTestDatabase();
  });

  describe("Basic Functionality", () => {
    it("should connect to the WebSocket server", (done) => {
      ws = new WebSocket("ws://localhost:8080");
      ws.on("open", () => {
        expect(ws.readyState).to.equal(WebSocket.OPEN);
        done();
      });
    });

    it("should receive heartbeat messages", (done) => {
      ws = new WebSocket("ws://localhost:8080");
      ws.on("message", (data) => {
        const message = JSON.parse(data);
        if (message.type === "heartbeat") {
          expect(message).to.have.property("timestamp");
          done();
        }
      });
    });
  });

  describe("Database Integration", () => {
    it("should store market data in the database", async () => {
      ws = new WebSocket("ws://localhost:8080");

      const marketData = {
        type: "market_data",
        symbol: "AAPL",
        price: 150.5,
        timestamp: Date.now(),
      };

      await new Promise((resolve) => {
        ws.on("open", () => {
          ws.send(JSON.stringify(marketData));
          resolve();
        });
      });

      // Wait for data to be stored
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify data in database
      const storedData = await db.marketData.findFirst({
        where: { symbol: "AAPL" },
      });

      expect(storedData).to.not.be.null;
      expect(storedData.price).to.equal(150.5);
    });
  });

  describe("Polygon Integration", () => {
    it("should handle Polygon WebSocket messages", (done) => {
      ws = new WebSocket("ws://localhost:8080/polygon");

      const polygonData = {
        ev: "T",
        sym: "AAPL",
        p: 150.5,
        s: 100,
        t: Date.now(),
      };

      ws.on("open", () => {
        ws.send(JSON.stringify(polygonData));
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data);
        if (message.type === "trade") {
          expect(message.symbol).to.equal("AAPL");
          expect(message.price).to.equal(150.5);
          expect(message.size).to.equal(100);
          done();
        }
      });
    });
  });
});
