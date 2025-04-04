import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { DatabaseStorage } from "./storage.js";
import * as database from "./database.js";

// Create an instance of the storage class
const storage = new DatabaseStorage();
import { setupWebsocket, startWebSocketTest } from "./websocket.js";
import { WebSocket } from "ws"; // Add this import here
import {
  insertUserSchema,
  insertWatchlistSchema,
  insertTradeSchema,
  type Asset,
  type PriceHistory,
  type EconomicEvent,
  type User,
} from "../shared/schema.js";
import axios from "axios";
import { z } from "zod";
import { log } from "./vite.js";
import { checkRateLimit, createRateLimitedResponse } from "./validation.js";
import {
  analysisCache,
  marketDataCache,
  userCache,
  assetsCache,
  economicEventsCache,
} from "./cache.js";
import {
  initializeHealthMonitoring,
  runHealthChecks,
  cleanupHealthMonitoring,
  ServiceHealth,
} from "./health.js";
import {
  errorHandler,
  ErrorType,
  ErrorSeverity,
} from "./services/errorHandlingService.js";
import adminRouter from "./routes/admin/index.js";
import bonusRouter from "./routes/bonus.js";
import economicCalendarRouter from "./routes/economic-calendar.js";
import {
  runAllNotificationChecks,
  checkForEconomicEventNotifications,
  checkEconomicEventCorrelations,
  checkUpcomingVolatilityEvents,
} from "./services/notificationService.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Add a trace middleware to log all requests
  app.use((req, res, next) => {
    console.log(`TRACE: ${req.method} ${req.path}`);
    next();
  });

  const httpServer = createServer(app);

  // Setup WebSocket for real-time market data
  const wss = setupWebsocket(httpServer);

  // Register economic calendar routes
  app.use("/api", economicCalendarRouter);

  // تم إيقاف خدمة إرسال بيانات السوق التجريبية بناءً على طلب المستخدم
  // startWebSocketTest(wss);

  // API Routes
  // Initialize health monitoring system
  const healthMonitoring = initializeHealthMonitoring(60); // Check every 60 seconds
  log("Health monitoring system initialized", "health");

  // Comprehensive health check endpoint
  app.get("/api/health", async (req: Request, res: Response) => {
    try {
      // Run all health checks
      const health = await runHealthChecks();

      // Set appropriate status code based on health status
      if (health.status === ServiceHealth.DOWN) {
        res.status(503); // Service Unavailable
      } else if (health.status === ServiceHealth.DEGRADED) {
        res.status(200); // Still OK but with warnings
      } else {
        res.status(200); // All good
      }

      // Return detailed health information
      res.json(health);
    } catch (error) {
      log(`Error in health endpoint: ${error}`, "health");
      res.status(500).json({
        status: ServiceHealth.DEGRADED,
        message: "Health check failed to execute",
        timestamp: new Date(),
      });
    }
  });

  // AI Health check endpoint
  app.get("/api/ai/health", async (req: Request, res: Response) => {
    try {
      // Get only AI-related health information
      const fullHealth = await runHealthChecks();

      // Extract AI-specific services
      const aiHealth = {
        status: fullHealth.services.aiAnalysis?.status || ServiceHealth.UNKNOWN,
        message: fullHealth.services.aiAnalysis?.message || "AI service status unknown",
        timestamp: new Date(),
        services: {
          aiAnalysis: fullHealth.services.aiAnalysis || {
            status: ServiceHealth.UNKNOWN,
            message: "AI analysis service status unknown"
          }
        }
      };

      // Set status code based on AI health status
      if (aiHealth.status === ServiceHealth.DOWN) {
        res.status(503); // Service Unavailable
      } else {
        res.status(200); // OK or degraded
      }

      res.json(aiHealth);
    } catch (error) {
      log(`Error in AI health endpoint: ${error}`, "health");
      res.status(500).json({
        status: ServiceHealth.DEGRADED,
        message: "AI health check failed to execute",
        timestamp: new Date(),
      });
    }
  });

  // Simple health check for load balancers and monitoring tools
  app.get("/api/health/simple", (req: Request, res: Response) => {
    res.json({ status: "online" });
  });

  // Test endpoint for troubleshooting routes
  app.get("/api/test-routes", (req: Request, res: Response) => {
    console.log("=================== TEST ROUTES ENDPOINT HIT ===================");
    console.log(`Method: ${req.method}, URL: ${req.url}, Path: ${req.path}`);
    console.log("================================================================");
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ 
      message: "Routes test endpoint reached", 
      contentType: "application/json" 
    });
  });

  // Authentication routes are handled in auth.ts

  // User data route to get authenticated user's data
  // User data route to get authenticated user's data
  app.get("/api/user", async (req: Request, res: Response) => {
    console.log("GET /api/user - Request received");
    // Always set the Content-Type header to application/json
    res.setHeader("Content-Type", "application/json");

    try {
      if (!req.isAuthenticated()) {
        console.log("User not authenticated, returning 401");
        return res.status(401).json({ message: "Not authenticated" });
      }

      // If userId query parameter exists and user is admin, fetch that specific user
      if (req.query.userId && req.user.userRole === "admin") {
        const userId = parseInt(req.query.userId as string);
        console.log(`Admin requesting user ID: ${userId}`);

        const user = await storage.getUser(userId);

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Remove sensitive information
        const { password, ...userWithoutPassword } = user;

        // Format data for response
        const responseData = {
          ...userWithoutPassword,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt ? user.updatedAt.toISOString() : user.createdAt.toISOString()
        };

        return res.json(responseData);
      }

      // Otherwise just return the current authenticated user's data
      console.log("Sending authenticated user data");
      return res.json(req.user);
    } catch (error) {
      console.error("Error in /api/user endpoint:", error);
      return res.status(500).json({ message: "Failed to fetch user data" });
    }
  });

  // Middleware to set JSON content type for all API routes
  const jsonContentTypeMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
    }
    next();
  };

  // Apply the middleware to all routes
  app.use(jsonContentTypeMiddleware);

  // User data by ID with proper error handling
  app.get("/api/user/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = parseInt(req.params.id);

      // Check if user is requesting their own data or is an admin
      if (req.user.id !== userId && req.user.userRole !== "admin") {
        return res.status(403).json({ message: "Forbidden - You can only access your own data" });
      }

      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove sensitive information and format response
      const { password: _, ...userWithoutPassword } = user;
      const responseData = {
        ...userWithoutPassword,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt ? user.updatedAt.toISOString() : user.createdAt.toISOString()
      };

      return res.json(responseData);
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      return res.status(500).json({ message: "Failed to fetch user data" });
    }
  });

  // User settings routes
  // User settings endpoint with proper response structure
  app.get("/api/user-settings", async (req: Request, res: Response) => {
    console.log("GET /api/user-settings - Request received");
    console.log("Authentication state:", req.isAuthenticated() ? "Authenticated" : "Not authenticated");

    try {
      if (!req.isAuthenticated()) {
        console.log("User not authenticated, returning 401");
        return res.status(401).json({ message: "Not authenticated" });
      }

      console.log("User is authenticated, ID:", req.user.id);
      const userId = req.user.id;

      // Get user settings from the users table
      console.log("Retrieving user data for ID:", userId);
      const user = await storage.getUser(userId);

      if (!user) {
        console.log("User not found in database");
        return res.status(404).json({ message: "User not found" });
      }

      console.log("User found:", { id: user.id, username: user.username });
      console.log("User notification setting:", user.notificationPreference);

      // Format the settings object based on user data
      const userSettings = {
        id: user.id.toString(),
        userId: user.id.toString(),
        languagePreference: user.languagePreference || "en",
        currencyPreference: user.currencyPreference || "USD",
        themePreference: user.themePreference || "light",
        notificationPreferences:
          typeof user.notificationPreference === "object"
            ? user.notificationPreference
            : {
                email: true,
                browser: true,
                marketAlerts: true,
                tradingUpdates: true,
                securityAlerts: true,
              },
        privacySettings:
          typeof user.privacySettings === "object"
            ? user.privacySettings
            : {
                showProfileToOthers: true,
                shareTradeHistory: false,
                allowMarketingCommunications: true,
              },
        interfaceSettings:
          typeof user.interfaceSettings === "object"
            ? user.interfaceSettings
            : {
                colorScheme: "default",
                fontSize: "medium",
                brightness: "auto",
                fontFamily: "system",
                spacing: "normal",
                layout: "default",
                accentColor: "#1E88E5",
                chartStyle: "default",
                tableRowDensity: "medium",
                dashboardLayout: "standard",
                watchlistDisplay: "compact",
                tradingViewTheme: "light",
              },
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt
          ? user.updatedAt.toISOString()
          : user.createdAt.toISOString(),
      };

      console.log("Sending user settings response");
      res.setHeader("Content-Type", "application/json");
      res.status(200).json(userSettings);
    } catch (error) {
      console.error("Error fetching user settings:", error);
      res.status(500).json({ message: "Failed to fetch user settings" });
    }
  });

  app.get("/api/user-settings/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const requestedUserId = parseInt(req.params.id);
      const currentUserId = req.user.id;

      // Check if user is trying to access their own data or is an admin
      if (currentUserId !== requestedUserId && req.user.userRole !== "admin") {
        return res
          .status(403)
          .json({
            message: "Forbidden - you can only access your own settings",
          });
      }

      // Get user settings from the users table
      const user = await storage.getUser(requestedUserId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Format the settings object based on user data
      const userSettings = {
        id: user.id.toString(),
        userId: user.id.toString(),
        languagePreference: user.languagePreference || "en",
        currencyPreference: user.currencyPreference || "USD",
        themePreference: user.themePreference || "light",
        notificationPreferences:
          typeof user.notificationPreference === "object"
            ? user.notificationPreference
            : {
                email: true,
                browser: true,
                marketAlerts: true,
                tradingUpdates: true,
                securityAlerts: true,
              },
        privacySettings:
          typeof user.privacySettings === "object"
            ? user.privacySettings
            : {
                showProfileToOthers: true,
                shareTradeHistory: false,
                allowMarketingCommunications: true,
              },
        interfaceSettings:
          typeof user.interfaceSettings === "object"
            ? user.interfaceSettings
            : {
                colorScheme: "default",
                fontSize: "medium",
                brightness: "auto",
                fontFamily: "system",
                spacing: "normal",
                layout: "default",
                accentColor: "#1E88E5",
                chartStyle: "default",
                tableRowDensity: "medium",
                dashboardLayout: "standard",
                watchlistDisplay: "compact",
                tradingViewTheme: "light",
              },
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt
          ? user.updatedAt.toISOString()
          : user.createdAt.toISOString(),
      };

      res.json(userSettings);
    } catch (error) {
      console.error("Error fetching user settings:", error);
      res.status(500).json({ message: "Failed to fetch user settings" });
    }
  });

  app.post("/api/user-settings", async (req: Request, res: Response) => {
    console.log("POST /api/user-settings - Request received");
    console.log("Authentication state:", req.isAuthenticated() ? "Authenticated" : "Not authenticated");

    try {
      if (!req.isAuthenticated()) {
        console.log("User not authenticated, returning 401");
        return res.status(401).json({ message: "Not authenticated" });
      }

      console.log("User is authenticated, ID:", req.user.id);
      const userId = req.user.id;
      const settingsData = req.body;

      console.log("Received settings data:", JSON.stringify(settingsData, null, 2));

      // Check if user is trying to update their own data
      if (parseInt(settingsData.userId) !== userId) {
        console.log("User ID mismatch:", settingsData.userId, "vs", userId);
        return res
          .status(403)
          .json({
            message: "Forbidden - you can only update your own settings",
          });
      }

      console.log("Building updates object for user", userId);

      // Update user settings in the users table
      const updates: Partial<User> = {
        languagePreference: settingsData.languagePreference,
        notificationPreference: settingsData.notificationPreferences,  // Update from client uses plural form
        privacySettings: settingsData.privacySettings,
        interfaceSettings: settingsData.interfaceSettings,
      };

      console.log("Prepared updates:", JSON.stringify(updates, null, 2));

      // Add additional settings if available
      if (settingsData.currencyPreference) {
        updates.currencyPreference = settingsData.currencyPreference;
      }

      if (settingsData.themePreference) {
        updates.themePreference = settingsData.themePreference;
      }

      const updatedUser = await storage.updateUserPreferences(userId, updates);

      // Format the response object
      const updatedSettings = {
        id: updatedUser.id.toString(),
        userId: updatedUser.id.toString(),
        languagePreference: updatedUser.languagePreference || "en",
        currencyPreference: updatedUser.currencyPreference || "USD",
        themePreference: updatedUser.themePreference || "light",
        notificationPreferences:
          typeof updatedUser.notificationPreference === "object"
            ? updatedUser.notificationPreference
            : {
                email: true,
                browser: true,
                marketAlerts: true,
                tradingUpdates: true,
                securityAlerts: true,
              },
        privacySettings:
          typeof updatedUser.privacySettings === "object"
            ? updatedUser.privacySettings
            : {
                showProfileToOthers: true,
                shareTradeHistory: false,
                allowMarketingCommunications: true,
              },
        interfaceSettings:
          typeof updatedUser.interfaceSettings === "object"
            ? updatedUser.interfaceSettings
            : {
                colorScheme: "default",
                fontSize: "medium",
                brightness: "auto",
                fontFamily: "system",
                spacing: "normal",
                layout: "default",
                accentColor: "#1E88E5",
                chartStyle: "default",
                tableRowDensity: "medium",
                dashboardLayout: "standard",
                watchlistDisplay: "compact",
                tradingViewTheme: "light",
              },
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt
          ? updatedUser.updatedAt.toISOString()
          : updatedUser.createdAt.toISOString(),
      };

      console.log("Sending updated user settings response");
      res.setHeader("Content-Type", "application/json");
      res.status(200).json(updatedSettings);
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ message: "Failed to update user settings" });
    }
  });

  // Add missing routes required by client-side code
  // These were returning HTML instead of proper JSON responses

  // Traders API routes
  app.get("/api/traders", async (req: Request, res: Response) => {
    console.log("GET /api/traders - Request received");
    try {
      res.setHeader("Content-Type", "application/json");
      // Implement this with actual data when available
      // For now return an empty array to prevent client errors
      return res.json([]);
    } catch (error) {
      console.error("Error fetching traders:", error);
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({ message: "Failed to fetch traders data" });
    }
  });

  app.get("/api/traders/featured", async (req: Request, res: Response) => {
    console.log("GET /api/traders/featured - Request received");
    try {
      res.setHeader("Content-Type", "application/json");
      // Implement this with actual data when available
      return res.json([]);
    } catch (error) {
      console.error("Error fetching featured traders:", error);
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({ message: "Failed to fetch featured traders data" });
    }
  });

  // Recent data API route
  app.get("/api/recent", async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    console.log("GET /api/recent - Request received");
    try {
      // Implement this with actual data when available 
      return res.json([]);
    } catch (error) {
      console.error("Error fetching recent data:", error);
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({ message: "Failed to fetch recent data" });
    }
  });

  // Recent trades API endpoint
  app.get("/api/trades/recent", async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    console.log("GET /api/trades/recent - Request received");

    try {
      // Get a limited number of recent trades
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const trades = await storage.getRecentTrades(limit);
      console.log(`Fetched ${trades.length} recent trades`);

      // Format the response
      const formattedTrades = trades.map(trade => ({
        id: trade.id,
        userId: trade.userId,
        symbol: trade.symbol,
        type: trade.type,
        price: trade.price,
        shares: trade.shares,
        total: trade.total,
        commission: trade.commission,
        tradeDate: trade.tradeDate.toISOString(),
        usedBonus: trade.usedBonus,
        bonusAmount: trade.bonusAmount,
        bonusId: trade.bonusId
      }));

      res.json(formattedTrades);
    } catch (error) {
      console.error("Error in /api/trades/recent endpoint:", error);
      res.status(500).json({ message: "Failed to fetch recent trades" });
    }
  });

  // User trades API endpoint - used by client components
  app.get("/api/trades/user/:id", async (req: Request, res: Response) => {
    // Always set the Content-Type to application/json for all API endpoints
    res.setHeader("Content-Type", "application/json");
    console.log(`GET /api/trades/user/${req.params.id} - Request received`);

    try {
      if (!req.isAuthenticated()) {
        console.log("User not authenticated");
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Check if user is requesting their own data or is an admin
      const requestedUserId = parseInt(req.params.id);
      const currentUserId = req.user.id;

      if (currentUserId !== requestedUserId && req.user.userRole !== "admin") {
        console.log(`Access denied: User ${currentUserId} tried to access trades for user ${requestedUserId}`);
        return res.status(403).json({ 
          message: "Forbidden - You can only access your own trades" 
        });
      }

      // Get trades for the user
      const trades = await storage.getUserTrades(requestedUserId);
      console.log(`Fetched ${trades.length} trades for user ${requestedUserId}`);

      // Format the response
      const formattedTrades = trades.map(trade => ({
        id: trade.id,
        userId: trade.userId,
        symbol: trade.symbol,
        type: trade.type,
        price: trade.price,
        shares: trade.shares,
        total: trade.total,
        commission: trade.commission,
        tradeDate: trade.tradeDate.toISOString(),
        usedBonus: trade.usedBonus,
        bonusAmount: trade.bonusAmount,
        bonusId: trade.bonusId
      }));

      res.json(formattedTrades);
    } catch (error) {
      console.error(`Error in /api/trades/user/${req.params.id} endpoint:`, error);
      res.status(500).json({ message: "Failed to fetch user trades" });
    }
  });

  // Featured content API route
  app.get("/api/featured", async (req: Request, res: Response) => {
    console.log("GET /api/featured - Request received");
    try {
      res.setHeader("Content-Type", "application/json");
      // Return empty array until implemented with real data
      return res.json([]);
    } catch (error) {
      console.error("Error fetching featured content:", error);
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({ message: "Failed to fetch featured content" });
    }
  });

  // Update user data
  app.patch("/api/user/profile", async (req: Request, res: Response) => {
    try {
      // Always set the Content-Type header to application/json
      res.setHeader("Content-Type", "application/json");

      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "No authenticated user found" });
      }

      // Use the authenticated user's ID from the session
      const userId = req.user.id;

      // Update user data with the provided values
      const updates = req.body;

      // Prevent updating sensitive fields
      delete updates.id;
      delete updates.password;
      delete updates.email; // If you want to allow email updates, add specific validation logic

      try {
        // Make sure interfaceSettings, notificationPreferences, and privacySettings are stored correctly
        if (updates.interfaceSettings) {
          updates.interfaceSettings = updates.interfaceSettings;
        }

        // Make sure notificationPreference field is consistent 
        // Client sends notificationPreferences (plural), but DB field is notificationPreference (singular)
        if (updates.notificationPreferences) {
          updates.notificationPreference = updates.notificationPreferences;
          delete updates.notificationPreferences;
        }

        if (updates.privacySettings) {
          updates.privacySettings = updates.privacySettings;
        }

        const updatedUser = await storage.updateUserPreferences(
          userId,
          updates,
        );
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Remove password from the response
        const { password: _, ...userWithoutPassword } = updatedUser;
        res.json(userWithoutPassword);
      } catch (error) {
        console.error("Error in update user:", error);
        return res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Add a specific endpoint for updating a user (for both admin access and self-update)
  app.patch("/api/user/:id", async (req: Request, res: Response) => {
    try {
      // Always set the Content-Type header to application/json
      res.setHeader("Content-Type", "application/json");

      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const requestedUserId = parseInt(req.params.id);
      const currentUserId = req.user.id;

      // Check if the user is updating their own profile or is an admin
      if (currentUserId !== requestedUserId && req.user.userRole !== "admin") {
        return res.status(403).json({ 
          message: "Forbidden - You can only update your own profile"
        });
      }

      const updateData = req.body;

      // Simple validation
      if (!updateData) {
        return res.status(400).json({ message: "No update data provided" });
      }

      // Prevent updating sensitive fields
      delete updateData.id;
      delete updateData.password;
      delete updateData.email; // If you want to allow email updates, add specific validation logic

      // Make sure notificationPreference field is consistent 
      // Client sends notificationPreferences (plural), but DB field is notificationPreference (singular)
      if (updateData.notificationPreferences) {
        updateData.notificationPreference = updateData.notificationPreferences;
        delete updateData.notificationPreferences;
      }

      // Update the user profile
      const updatedUser = await storage.updateUserPreferences(requestedUserId, updateData);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove sensitive information
      const { password, ...userWithoutPassword } = updatedUser;

      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Watchlist routes
  app.get("/api/watchlist", async (req: Request, res: Response) => {
    try {
      // Check authentication
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Use authenticated user's ID from session
      const userId = req.user.id;

      const watchlistItems = await storage.getWatchlistItems(userId);
      res.json(watchlistItems);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  app.post("/api/watchlist", async (req: Request, res: Response) => {
    try {
      // Check authentication
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Use authenticated user's ID from session
      const userId = req.user.id;

      // Use the authenticated user's ID, not the one from the request body
      const watchlistData = { ...req.body, userId };
      const watchlistInput = insertWatchlistSchema.parse(watchlistData);

      const item = await storage.addToWatchlist(watchlistInput);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add to watchlist" });
    }
  });

  app.delete(
    "/api/watchlist/:symbol",
    async (req: Request, res: Response) => {
      try {
        // Check authentication
        if (!req.isAuthenticated()) {
          return res.status(401).json({ message: "Authentication required" });
        }

        // Use authenticated user's ID from session
        const userId = req.user.id;
        const { symbol } = req.params;

        await storage.removeFromWatchlist(userId, symbol);
        res.status(204).end();
      } catch (error) {
        res.status(500).json({ message: "Failed to remove from watchlist" });
      }
    },
  );

  // Portfolio routes
  app.get("/api/portfolio", async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {      const portfolio = await storage.getPortfolioItems(req.user.id);
      const trades = await storage.getUserTrades(req.user.id);
      const summary = await storage.getPortfolioSummary(req.user.id);

      res.json({
        portfolio: portfolio || [],
        trades: trades || [],
        summary: {
          totalValue: summary?.totalValue || "0",
          changePercent: summary?.changePercent || "0",
          holdings: summary?.holdings || [],
        },
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Portfolio fetch error:", error);
      res.status(500).json({ error: "Failed to fetch portfolio data" });
    }
  });

  // Get detailed portfolio summary
  app.get("/api/portfolio-details", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const detailedSummary = await storage.getDetailedPortfolioSummary(
        req.user.id,
      );

      res.setHeader('Content-Type', 'application/json');

      if (!detailedSummary) {
        // If no detailed summary exists yet, create a default one
        const defaultSummary = {
          userId: req.user.id,
          totalBalance: "0.00",
          totalEquity: "0.00",
          totalProfit: "0.00",
          totalLoss: "0.00",
          openPositions: 0,
          totalInvestment: "0.00",
          availableBalance: "0.00",
          totalReturn: "0.00",
          marginAuthorized: "0.00",
          marginUsed: "0.00",
          unauthorizedPnl: "0.00",
        };

        const newSummary = await storage.savePortfolioSummary(defaultSummary);
        res.json(newSummary);
      } else {
        res.json(detailedSummary);
      }
    } catch (error) {
      console.error("Portfolio summary fetch error:", error);
      res.status(500).json({ error: "Failed to fetch portfolio summary data" });
    }
  });

  // Trade routes
  app.post("/api/trades", async (req: Request, res: Response) => {
    try {
      // Check authentication
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Use authenticated user's ID from session
      const userId = req.user.id;

      // Use the authenticated user's ID, not the one from the request body
      const tradeData = { ...req.body, userId };
      const tradeInput = insertTradeSchema.parse(tradeData);

      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Calculate total cost/proceeds
      const totalWithCommission =
        parseFloat(tradeInput.total.toString()) +
        parseFloat(tradeInput.commission.toString());

      // Check if user has enough balance for buy orders
      if (tradeInput.type === "buy") {
        const currentBalance = parseFloat(user.balance.toString());
        if (currentBalance < totalWithCommission) {
          return res.status(400).json({ message: "Insufficient funds" });
        }

        // Update user balance
        const newBalance = (currentBalance - totalWithCommission).toFixed(2);
        await storage.updateUserBalance(user.id, newBalance);
      } else if (tradeInput.type === "sell") {
        // For sell orders, check if user has the shares
        const portfolioItem = await storage.getPortfolioItem(
          user.id,
          tradeInput.symbol,
        );
        if (
          !portfolioItem ||
          parseFloat(portfolioItem.shares.toString()) <
            parseFloat(tradeInput.shares.toString())
        ) {
          return res.status(400).json({ message: "Insufficient shares" });
        }

        // Update user balance (add proceeds)
        const currentBalance = parseFloat(user.balance.toString());
        const newBalance = (
          currentBalance +
          parseFloat(tradeInput.total.toString()) -
          parseFloat(tradeInput.commission.toString())
        ).toFixed(2);
        await storage.updateUserBalance(user.id, newBalance);
      }

      // Create the trade
      const trade = await storage.createTrade(tradeInput);

      // Update portfolio
      const existingItem = await storage.getPortfolioItem(
        tradeInput.userId,
        tradeInput.symbol,
      );
      if (tradeInput.type === "buy") {
        if (existingItem) {
          // Update existing position
          const currentShares = parseFloat(existingItem.shares.toString());
          const currentAvgPrice = parseFloat(existingItem.avgPrice.toString());
          const newShares =
            currentShares + parseFloat(tradeInput.shares.toString());

          // Calculate new average price
          const newAvgPrice =
            (currentShares * currentAvgPrice +
              parseFloat(tradeInput.total.toString())) /
            newShares;

          await storage.updatePortfolio({
            userId: tradeInput.userId,
            symbol: tradeInput.symbol,
            shares: newShares.toString(),
            avgPrice: newAvgPrice.toFixed(2),
          });
        } else {
          // Create new position
          await storage.updatePortfolio({
            userId: tradeInput.userId,
            symbol: tradeInput.symbol,
            shares: tradeInput.shares.toString(),
            avgPrice: (
              parseFloat(tradeInput.total.toString()) /
              parseFloat(tradeInput.shares.toString())
            ).toFixed(2),
          });
        }
      } else if (tradeInput.type === "sell" && existingItem) {
        // Update position after sell
        const currentShares = parseFloat(existingItem.shares.toString());
        const newShares =
          currentShares - parseFloat(tradeInput.shares.toString());

        if (newShares > 0) {
          // Update with remaining shares
          await storage.updatePortfolio({
            userId: tradeInput.userId,
            symbol: tradeInput.symbol,
            shares: newShares.toString(),
            avgPrice: existingItem.avgPrice.toString(),
          });
        } else {
          // Remove the position completely
          await storage.updatePortfolio({
            userId: tradeInput.userId,
            symbol: tradeInput.symbol,
            shares: "0",
            avgPrice: "0",
          });
        }
      }

      res.status(201).json(trade);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Trade error:", error);
      res.status(500).json({ message: "Failed to process trade" });
    }
  });

  app.get("/api/trades", async (req: Request, res: Response) => {
    try {
      // Check authentication
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Use authenticated user's ID from session
      const userId = req.user.id;

      const trades = await storage.getUserTrades(userId);
      res.json(trades);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });
  
  // Trade open endpoint
  app.post("/api/trade/open", async (req: Request, res: Response) => {
    try {
      console.log("\n ---- DEBUG START /api/trade/open ----");
      console.log("Request body:", req.body);
      console.log("Authenticated user:", req.user);
      
      // Set content type header
      res.setHeader("Content-Type", "application/json");
      
      // Check authentication
      if (!req.isAuthenticated()) {
        console.log("Authentication failed");
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { symbol, type, amount, stopLoss, takeProfit } = req.body;
      
      // Validate request body
      if (!symbol || !type || !amount) {
        return res.status(400).json({ 
          message: "Missing required fields", 
          required: ["symbol", "type", "amount"] 
        });
      }
      
      if (type !== 'buy' && type !== 'sell') {
        return res.status(400).json({ message: "Type must be 'buy' or 'sell'" });
      }
      
      // Get current price for symbol
      console.log(`Looking up asset with symbol: ${symbol}`);
      let asset;
      try {
        asset = await storage.getAsset(symbol);
        console.log("Asset lookup result:", asset);
        
        if (!asset) {
          console.log(`Asset with symbol ${symbol} not found`);
          return res.status(404).json({ message: `Asset with symbol ${symbol} not found` });
        }
      } catch (error) {
        console.error("Error looking up asset:", error);
        return res.status(500).json({ message: `Error looking up asset: ${error.message}` });
      }
      
      // Calculate total and commission (0.1% commission)
      const shares = amount.toString();
      
      // Check if lastPrice exists, if not try to use price
      if (!asset.lastPrice && !asset.price) {
        console.error(`Asset ${symbol} has no price information:`, asset);
        return res.status(500).json({ message: `Asset ${symbol} has no price information` });
      }
      
      const price = asset.lastPrice || asset.price || "0";
      const numericPrice = parseFloat(price);
      const numericShares = parseFloat(shares);
      const total = (numericPrice * numericShares).toFixed(2);
      const commission = (parseFloat(total) * 0.001).toFixed(2);
      
      // Validate stop loss and take profit if provided
      let validatedStopLoss = null;
      let validatedTakeProfit = null;
      
      if (stopLoss !== undefined && stopLoss !== null) {
        const stopLossValue = parseFloat(stopLoss);
        
        // For buy orders, stop loss must be below purchase price
        // For sell orders, stop loss must be above purchase price
        if (type === 'buy' && stopLossValue >= numericPrice) {
          return res.status(400).json({ 
            message: "For buy orders, stop loss must be below the purchase price" 
          });
        } else if (type === 'sell' && stopLossValue <= numericPrice) {
          return res.status(400).json({ 
            message: "For sell orders, stop loss must be above the purchase price" 
          });
        }
        
        validatedStopLoss = stopLossValue.toFixed(2);
      }
      
      if (takeProfit !== undefined && takeProfit !== null) {
        const takeProfitValue = parseFloat(takeProfit);
        
        // For buy orders, take profit must be above purchase price
        // For sell orders, take profit must be below purchase price
        if (type === 'buy' && takeProfitValue <= numericPrice) {
          return res.status(400).json({ 
            message: "For buy orders, take profit must be above the purchase price" 
          });
        } else if (type === 'sell' && takeProfitValue >= numericPrice) {
          return res.status(400).json({ 
            message: "For sell orders, take profit must be below the purchase price" 
          });
        }
        
        validatedTakeProfit = takeProfitValue.toFixed(2);
      }
      
      // Get trading wallet for the user
      console.log("Getting trading wallet for user:", req.user.id);
      let trade; // Declare trade variable outside the try block
      try {
        const wallets = await storage.getUserWallets(req.user.id);
        console.log("User wallets:", wallets);
        
        if (!wallets || wallets.length === 0) {
          console.log("No wallets found for user:", req.user.id);
          
          // Let's try to create default wallets for the user
          console.log("Attempting to initialize default wallets for user");
          // We need to initialize wallets for this user - add implementation here
          
          return res.status(400).json({ message: "No wallets found for user. Please contact support to setup your account." });
        }
        
        const tradingWallet = wallets.find(w => w.type === 'trading' && w.currency === 'USD');
        
        if (!tradingWallet) {
          console.log("Trading wallet not found for user:", req.user.id);
          console.log("Available wallet types:", wallets.map(w => `${w.type}:${w.currency}`).join(', '));
          return res.status(400).json({ message: "Trading wallet not found for user" });
        }
        
        console.log("Found trading wallet:", tradingWallet);
        console.log("Wallet ID:", tradingWallet.id);
        console.log("Available balance:", tradingWallet.available_balance);
        console.log("Total needed:", total);
        
        // Check sufficient balance - wallet uses available_balance not availableBalance
        if (parseFloat(tradingWallet.available_balance) < parseFloat(total)) {
          return res.status(400).json({ 
            message: "Insufficient balance in trading wallet",
            available: parseFloat(tradingWallet.available_balance),
            required: parseFloat(total)
          });
        }
        
        // Create trade object matching the schema - moved inside the try block
        trade = {
          userId: req.user.id,
          symbol,
          type,
          shares,
          price,
          total,
          commission,
          status: 'open',
          stopLoss: validatedStopLoss,
          takeProfit: validatedTakeProfit,
          walletId: tradingWallet.id,
          marketType: 'spot',
          leverage: '1.00',
          marginUsed: total
        };
      } catch (error) {
        console.error("Error retrieving wallets:", error);
        return res.status(500).json({ message: "Error retrieving user wallets" });
      }
      
      console.log("Creating trade with data:", trade);
      
      // استخدام الدالة المخزنة لفتح التداول مع المحفظة بدلاً من storage.createTrade
      const result = await database.database.getPool().query(
        `SELECT open_trade_with_wallet(
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )`,
        [
          trade.userId,
          trade.symbol,
          trade.type,
          trade.shares,
          trade.price,
          trade.total,
          trade.commission,
          trade.stopLoss || null,
          trade.takeProfit || null,
          trade.walletId
        ]
      );
      
      // تحويل النتيجة من JSON إلى كائن التداول
      const jsonResult = result.rows[0].open_trade_with_wallet;
      const newTrade = JSON.parse(jsonResult);
      
      // تنسيق الاستجابة لتتطابق مع التوقعات
      return res.status(200).json({
        id: newTrade.id,
        userId: newTrade.userId,
        symbol: newTrade.symbol,
        type: newTrade.type,
        amount: parseFloat(newTrade.shares), // تحويل الأسهم إلى كمية للاستجابة
        price: parseFloat(newTrade.price),
        status: newTrade.status,
        stopLoss: newTrade.stopLoss ? parseFloat(newTrade.stopLoss) : null,
        takeProfit: newTrade.takeProfit ? parseFloat(newTrade.takeProfit) : null,
        createdAt: newTrade.createdAt,
        closedAt: null,
        total: parseFloat(newTrade.total),
        commission: parseFloat(newTrade.commission)
      });
    } catch (error) {
      console.error("Error opening trade:", error);
      return res.status(500).json({ message: "Failed to open trade" });
    }
  });
  
  // Trade close endpoint
  app.post("/api/trade/close", async (req: Request, res: Response) => {
    try {
      // Set content type header
      res.setHeader("Content-Type", "application/json");
      
      // Check authentication
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { tradeId } = req.body;
      
      // Validate request body
      if (!tradeId) {
        return res.status(400).json({ 
          message: "Missing required field", 
          required: ["tradeId"] 
        });
      }
      
      // Get trade
      const trade = await storage.getTradeById(tradeId);
      
      if (!trade) {
        return res.status(404).json({ message: `Trade with ID ${tradeId} not found` });
      }
      
      // Check if user owns the trade or is admin
      if (trade.userId !== req.user.id && req.user.userRole !== 'admin') {
        return res.status(403).json({ message: "You can only close your own trades" });
      }
      
      // Check if trade is already closed
      if (trade.status === 'closed') {
        return res.status(400).json({ message: "Trade is already closed" });
      }
      
      // Get current price for symbol
      console.log(`Looking up asset with symbol for trade close: ${trade.symbol}`);
      let asset;
      try {
        asset = await storage.getAsset(trade.symbol);
        console.log("Asset lookup result for trade close:", asset);
        
        if (!asset) {
          console.log(`Asset with symbol ${trade.symbol} not found for trade close`);
          return res.status(404).json({ message: `Asset with symbol ${trade.symbol} not found` });
        }
      } catch (error) {
        console.error("Error looking up asset for trade close:", error);
        return res.status(500).json({ message: `Error looking up asset for trade close: ${error.message}` });
      }
      
      // Check if lastPrice exists, if not try to use price
      if (!asset.lastPrice && !asset.price) {
        console.error(`Asset ${trade.symbol} has no price information for trade close:`, asset);
        return res.status(500).json({ message: `Asset ${trade.symbol} has no price information for trade close` });
      }
      
      const currentPrice = asset.lastPrice || asset.price || "0";
      
      // Helper function to calculate profit
      const calculateProfit = (trade: any) => {
        const entryPrice = parseFloat(trade.price);
        const exitPrice = parseFloat(currentPrice);
        const shares = parseFloat(trade.shares);
        
        if (trade.type === 'buy') {
          return (exitPrice - entryPrice) * shares;
        } else {
          return (entryPrice - exitPrice) * shares;
        }
      };
      
      // استخدام الدالة المخزنة لإغلاق التداول بدلاً من storage.updateTrade
      const result = await database.database.getPool().query(
        `SELECT close_trade_with_wallet(
          $1, $2, $3
        )`,
        [
          tradeId,
          currentPrice,
          'user'
        ]
      );
      
      // تحويل النتيجة من JSON إلى كائن التداول
      const jsonResult = result.rows[0].close_trade_with_wallet;
      const updatedTrade = JSON.parse(jsonResult);
      
      // حساب الربح بناءً على البيانات المرتجعة
      const profit = parseFloat(updatedTrade.profit || calculateProfit(updatedTrade));
      
      // تنسيق الاستجابة لتتطابق مع التوقعات
      return res.status(200).json({
        id: updatedTrade.id,
        userId: updatedTrade.userId,
        symbol: updatedTrade.symbol,
        type: updatedTrade.type,
        amount: parseFloat(updatedTrade.shares), // تحويل الأسهم إلى كمية للاستجابة
        price: parseFloat(updatedTrade.price),
        closePrice: parseFloat(updatedTrade.closePrice),
        status: updatedTrade.status,
        closedBy: updatedTrade.closedBy,
        stopLoss: updatedTrade.stopLoss ? parseFloat(updatedTrade.stopLoss) : null,
        takeProfit: updatedTrade.takeProfit ? parseFloat(updatedTrade.takeProfit) : null,
        createdAt: updatedTrade.createdAt,
        closedAt: updatedTrade.closedAt,
        profit,
        total: parseFloat(updatedTrade.total),
        commission: parseFloat(updatedTrade.commission)
      });
    } catch (error) {
      console.error("Error closing trade:", error);
      return res.status(500).json({ message: "Failed to close trade" });
    }
  });

  // This endpoint used to be a duplicate but has been completely removed
  // The implementation at line 597 handles all /api/trades/user/:id requests

  // This endpoint is removed because it duplicates the functionality of the other
  // /api/trades/recent endpoint which is more comprehensive

  // Endpoint to check and update trades based on stop loss and take profit conditions
  app.post("/api/trade/check-conditions", async (req: Request, res: Response) => {
    try {
      // Set content type header
      res.setHeader("Content-Type", "application/json");
      
      // This endpoint should only be accessible by admins or the system itself
      if (req.isAuthenticated() && req.user.userRole !== 'admin') {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }
      
      // Get all open trades
      const allTrades = await storage.getAllTrades();
      const openTrades = allTrades.filter(trade => trade.status === 'open' && 
                                         (trade.stopLoss !== null || trade.takeProfit !== null));
      
      const updatedTrades = [];
      
      // Check each open trade for stop loss and take profit conditions
      for (const trade of openTrades) {
        // Get current price for symbol
        console.log(`Checking conditions for trade ${trade.id}, symbol: ${trade.symbol}`);
        let asset;
        try {
          asset = await storage.getAsset(trade.symbol);
          if (!asset) {
            console.log(`Asset with symbol ${trade.symbol} not found for condition check`);
            continue; // Skip trades where we can't get an asset
          }
        } catch (error) {
          console.error(`Error looking up asset for condition check: ${trade.symbol}`, error);
          continue; // Skip trades with errors
        }
        
        // Check if price information exists
        if (!asset.lastPrice && !asset.price) {
          console.log(`No price information available for ${trade.symbol}`);
          continue; // Skip trades where we can't get a current price
        }
        
        const currentPrice = parseFloat(asset.lastPrice || asset.price);
        const stopLoss = trade.stopLoss ? parseFloat(trade.stopLoss) : null;
        const takeProfit = trade.takeProfit ? parseFloat(trade.takeProfit) : null;
        
        let shouldClose = false;
        let closedBy = null;
        
        // Check stop loss condition
        if (stopLoss !== null) {
          if (trade.type === 'buy' && currentPrice <= stopLoss) {
            shouldClose = true;
            closedBy = 'stopLoss';
          } else if (trade.type === 'sell' && currentPrice >= stopLoss) {
            shouldClose = true;
            closedBy = 'stopLoss';
          }
        }
        
        // Check take profit condition
        if (!shouldClose && takeProfit !== null) {
          if (trade.type === 'buy' && currentPrice >= takeProfit) {
            shouldClose = true;
            closedBy = 'takeProfit';
          } else if (trade.type === 'sell' && currentPrice <= takeProfit) {
            shouldClose = true;
            closedBy = 'takeProfit';
          }
        }
        
        // Close the trade if conditions are met
        if (shouldClose) {
          const priceToUse = asset.lastPrice || asset.price;
          console.log(`Closing trade ${trade.id} by ${closedBy} at price ${priceToUse}`);
          
          const updatedTrade = await storage.updateTrade(trade.id, {
            status: 'closed',
            closePrice: priceToUse,
            closedBy
          });
          
          updatedTrades.push(updatedTrade);
        }
      }
      
      return res.status(200).json({
        message: `Processed ${openTrades.length} trades, closed ${updatedTrades.length} trades based on conditions`,
        closedTrades: updatedTrades
      });
    } catch (error) {
      console.error("Error checking trade conditions:", error);
      return res.status(500).json({ message: "Failed to check trade conditions" });
    }
  });

  // Market data routes
  app.get("/api/market-data", async (req: Request, res: Response) => {
    try {
      if (req.query.symbol) {
        const data = await storage.getMarketData(req.query.symbol as string);
        if (!data) {
          return res.status(404).json({ message: "Symbol not found" });
        }
        return res.json(data);
      }

      const data = await storage.getAllMarketData();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch market data" });
    }
  });

  // Endpoint to update market data
  app.put("/api/market-data", async (req: Request, res: Response) => {
    try {
      const marketData = req.body;

      if (!marketData || !marketData.symbol || marketData.price === undefined) {
        return res
          .status(400)
          .json({
            message: "Invalid market data. Symbol and price are required.",
          });
      }

      // Get current market data for comparison
      const existingData = await storage.getMarketData(marketData.symbol);

      // Update the market data in storage
      const updatedData = await storage.updateMarketData({
        symbol: marketData.symbol,
        price: parseFloat(marketData.price),
        change:
          marketData.change !== undefined
            ? parseFloat(marketData.change)
            : existingData
              ? existingData.price - marketData.price
              : 0,
        changePercent:
          marketData.changePercent !== undefined
            ? parseFloat(marketData.changePercent)
            : 0,
        volume:
          marketData.volume !== undefined
            ? parseInt(marketData.volume)
            : existingData
              ? existingData.volume
              : 0,
        updatedAt: new Date(),
      });

      // Send market updates via the WebSocket server that was initialized at line 33
      const message = JSON.stringify({
        type: "price",
        symbol: marketData.symbol,
        price: parseFloat(marketData.price),
        changePercent:
          marketData.changePercent !== undefined
            ? parseFloat(marketData.changePercent)
            : 0,
        timestamp: Date.now(),
      });

      // Broadcast to all connected clients
      if (wss && wss.clients) {
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            // WebSocket.OPEN = 1
            client.send(message);
          }
        });
      }

      // Clear the market data cache
      marketDataCache.delete(marketData.symbol);
      marketDataCache.delete("all_market_data");

      res.json(updatedData);
    } catch (error) {
      console.error("Error updating market data:", error);
      res.status(500).json({ message: "Failed to update market data" });
    }
  });

  // AI Analysis routes
  app.get("/api/analysis/:symbol", async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const analysis = await storage.getAnalysisForSymbol(symbol);

      if (!analysis) {
        // If no analysis exists, request one from the AI service
        return requestAndSaveAnalysis(symbol, res);
      }

      res.json(analysis);
    } catch(error) {
      res.status(500).json({ message: "Failed to fetch analysis" });
    }
  });

  app.post(
    "/api/analysis/refresh/:symbol",
    async (req: Request, res: Response) => {
      try {
        const { symbol } = req.params;
        const forceRefresh = req.query.force === "true";
        return requestAndSaveAnalysis(symbol, res, forceRefresh);
      } catch (error) {
        res.status(500).json({ message: "Failed to refresh analysis" });
      }
    },
  );

  // Asset routes with proper error handling and caching
  app.get("/api/assets", async (req: Request, res: Response) => {
    try {
      // Handle query parameters for filtering
      const { type, sector, country } = req.query;

      // If specific filters are provided, use the filter function
      if (type || sector || country) {
        const filteredAssets = await storage.getAssetsByFilter({
          type: (type as string) || undefined,
          sector: (sector as string) || undefined,
          country: (country as string) || undefined,
        });
        return res.json(filteredAssets);
      }

      // If only type is specified, use the type-specific function
      if (type && !sector && !country) {
        const typeAssets = await storage.getAssetsByType(type as string);
        return res.json(typeAssets);
      }

      // Otherwise, get all assets
      const assets = await storage.getAllAssets();
      return res.json(assets);
    } catch (error) {
      // Use error handling service
      errorHandler.logDatabaseError(error, "SELECT", "assets", {
        query: req.query,
      });

      res.status(500).json({
        message: "Failed to fetch assets",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get trending assets endpoint
  app.get("/api/assets/trending", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const assets = await storage.getTrendingAssets(limit);

      res.json(assets);
    } catch (error: unknown) {
      errorHandler.logDatabaseError(error, "SELECT", "assets", {
        limit: req.query.limit,
      });

      res.status(500).json({ message: "Failed to fetch trending assets" });
    }
  });

  app.get("/api/assets/featured", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 8;

      const assets = await storage.getFeaturedAssets(limit);

      res.json(assets);
    } catch (error: unknown) {
      errorHandler.logDatabaseError(error, "SELECT", "assets", {
        limit: req.query.limit,
      });

      res.status(500).json({ message: "Failed to fetch featured assets" });
    }
  });

  app.get("/api/assets/movers", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const assets = await storage.getMovers(limit);

      res.json(assets);
    } catch (error: unknown) {
      errorHandler.logDatabaseError(error, "SELECT", "assets", {
        limit: req.query.limit,
      });

      res.status(500).json({ message: "Failed to fetch market movers" });
    }
  });

  // Get recently updated assets (for live data)
  app.get("/api/assets/live", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      // If symbols are provided, fetch specific assets
      if (req.query.symbols) {
        const symbols = (req.query.symbols as string)
          .split(",")
          .map((s) => s.trim());
        if (symbols.length > 0) {
          const assets = await storage.getAssetsBySymbols(symbols);
          return res.json(assets);
        }
      }

      // Otherwise, get the most recently updated assets
      const assets = await storage.getRecentlyUpdatedAssets(limit);

      res.json(assets);
    } catch (error: unknown) {
      errorHandler.logDatabaseError(error, "SELECT", "assets", {
        limit: req.query.limit,
        symbols: req.query.symbols,
      });

      res.status(500).json({ message: "Failed to fetch live asset data" });
    }
  });

  // Get asset by symbol
  app.get("/api/assets/:symbol", async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const asset = await storage.getAsset(symbol);

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      res.json(asset);
    } catch (error: unknown) {
      errorHandler.logDatabaseError(error, "SELECT", "assets", {
        symbol: req.params.symbol,
      });

      res.status(500).json({ message: "Failed to fetch asset" });
    }
  });

  // Price history routes with caching and pagination
  app.get("/api/price-history/:symbol", async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const { interval = "1d", limit = "100" } = req.query;

      // Validate parameters
      if (!symbol) {
        return res.status(400).json({ message: "Symbol is required" });
      }

      // Check if the asset exists
      const asset = await storage.getAsset(symbol);
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      // Get price history with the specified interval and limit
      const priceHistory = await storage.getPriceHistory(
        symbol,
        interval as string,
        parseInt(limit as string, 10),
      );

      res.json(priceHistory);
    } catch (error) {
      // Use error handling service
      errorHandler.logDatabaseError(error, "SELECT", "price_history", {
        symbol: req.params.symbol,
        interval: req.query.interval,
        limit: req.query.limit,
      });

      res.status(500).json({ message: "Failed to fetch price history" });
    }
  });

  app.get(
    "/api/price-history/:symbol/range",
    async (req: Request, res: Response) => {
      try {
        const { symbol } = req.params;
        const { start, end, interval = "1d" } = req.query;

        // Validate parameters
        if (!symbol || !start || !end) {
          return res.status(400).json({
            message: "Symbol, start date, and end date are required",
            required: {
              symbol: "Asset symbol",
              start: "Start date (ISO format)",
              end: "End date (ISO format)",
              interval:
                "Optional: Data interval (e.g., 1m, 5m, 15m, 1h, 4h, 1d, 1w, 1mo)",
            },
          });
        }

        // Parse dates
        let startDate: Date, endDate: Date;
        try {
          startDate = new Date(start as string);
          endDate = new Date(end as string);

          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (err) {
          return res.status(400).json({
            message: "Invalid date format",
            details:
              "Dates must be in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS.sssZ)",
          });
        }

        // Get price history within the date range
        const priceHistory = await storage.getPriceHistoryByDateRange(
          symbol,
          startDate,
          endDate,
          interval as string,
        );

        res.json(priceHistory);
      } catch (error) {
        // Use error handling service
        errorHandler.logDatabaseError(error, "SELECT", "price_history", {
          symbol: req.params.symbol,
          start: req.query.start,
          end: req.query.end,
          interval: req.query.interval,
        });

        res
          .status(500)
          .json({ message: "Failed to fetch price history for date range" });
      }
    },
  );

  // Economic Events routes with caching
  app.get("/api/economic-events", async (req: Request, res: Response) => {
    try {
      const { limit = "50", country, impact } = req.query;

      // Handle specific filtering scenarios
      if (country) {
        const events = await storage.getEconomicEventsByCountry(
          country as string,
        );
        return res.json(events);
      }

      if (impact) {
        const events = await storage.getEconomicEventsByImpact(
          impact as string,
        );
        return res.json(events);
      }

      // Default to getting all economic events with a limit
      const events = await storage.getEconomicEvents(
        parseInt(limit as string, 10),
      );
      res.json(events);
    } catch (error) {
      // Use error handling service
      errorHandler.logDatabaseError(error, "SELECT", "economic_events", {
        query: req.query,
      });

      res.status(500).json({ message: "Failed to fetch economic events" });
    }
  });

  // Get upcoming events for the next few days
  app.get(
    "/api/economic-events/upcoming",
    async (req: Request, res: Response) => {
      try {
        // Default to 7 days and Medium impact
        const { days = "7", impact = "medium" } = req.query;

        // Import and use the economic event service
        const { getUpcomingEvents } = await import(
          "./services/economicEventService.js"
        );

        // Note: getUpcomingEvents will normalize impact level case internally
        const events = await getUpcomingEvents(
          parseInt(days as string, 10),
          impact as string,
        );

        res.json(events);
      } catch (error) {
        errorHandler.logDatabaseError(error, "SELECT", "economic_events", {
          source: "getUpcomingEvents",
          query: req.query,
        });

        res
          .status(500)
          .json({ message: "Failed to fetch upcoming economic events" });
      }
    },
  );

  // Get economic events affecting a specific asset
  app.get(
    "/api/economic-events/asset/:symbol",
    async (req: Request, res: Response) => {
      try {
        const { symbol } = req.params;
        const { threshold = "2.0", limit = "10" } = req.query;

        // Validate symbol
        if (!symbol) {
          return res.status(400).json({ message: "Asset symbol is required" });
        }

        // Import and use the economic event service
        const { findSignificantEventsForAsset } = await import(
          "./services/economicEventService.js"
        );

        const events = await findSignificantEventsForAsset(
          symbol,
          parseFloat(threshold as string),
          parseInt(limit as string, 10),
        );

        res.json(events);
      } catch (error) {
        errorHandler.logDatabaseError(error, "SELECT", "economic_events", {
          source: "findSignificantEventsForAsset",
          symbol: req.params.symbol,
          query: req.query,
        });

        res
          .status(500)
          .json({
            message: "Failed to fetch economic events for the specified asset",
          });
      }
    },
  );

  // Get events affected by market movements
  app.get(
    "/api/economic-events/movement/:symbol",
    async (req: Request, res: Response) => {
      try {
        const { symbol } = req.params;
        const { date, days = "3" } = req.query;

        // Validate parameters
        if (!symbol) {
          return res.status(400).json({ message: "Asset symbol is required" });
        }

        if (!date) {
          return res
            .status(400)
            .json({ message: "Event date is required (ISO format)" });
        }

        // Parse date
        let eventDate: Date;
        try {
          eventDate = new Date(date as string);
          if (isNaN(eventDate.getTime())) {
            throw new Error("Invalid date");
          }
        } catch (err) {
          return res.status(400).json({
            message: "Invalid date format",
            details:
              "Date must be in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS.sssZ)",
          });
        }

        // Import and use the economic event service
        const { findMarketMovementAroundEvent } = await import(
          "./services/economicEventService.js"
        );

        const movement = await findMarketMovementAroundEvent(
          symbol,
          eventDate,
          parseInt(days as string, 10),
        );

        res.json(movement);
      } catch (error) {
        errorHandler.logDatabaseError(error, "SELECT", "price_history", {
          source: "findMarketMovementAroundEvent",
          symbol: req.params.symbol,
          date: req.query.date,
        });

        res
          .status(500)
          .json({
            message: "Failed to analyze market movement around the event",
          });
      }
    },
  );

  // Get economic events that might affect a user's portfolio
  app.get(
    "/api/economic-events/portfolio",
    async (req: Request, res: Response) => {
      try {
        // Check authentication
        if (!req.isAuthenticated()) {
          return res.status(401).json({ message: "Authentication required" });
        }

        // Use authenticated user's ID from session
        const userId = req.user.id;
        const { days = "7" } = req.query;

        // Import and use the economic event service
        const { getEventsForPortfolio } = await import(
          "./services/economicEventService.js"
        );

        const events = await getEventsForPortfolio(
          parseInt(userId, 10),
          parseInt(days as string, 10),
        );

        res.json(events);
      } catch (error) {
        errorHandler.logDatabaseError(error, "SELECT", "economic_events", {
          source: "getEventsForPortfolio",
          userId: req.user?.id,
          days: req.query.days,
        });

        res
          .status(500)
          .json({
            message: "Failed to fetch economic events for the user portfolio",
          });
      }
    },
  );

  app.get("/api/economic-events/range", async (req: Request, res: Response) => {
    try {
      const { start, end } = req.query;

      // Validate parameters
      if (!start || !end) {
        return res.status(400).json({
          message: "Start date and end date are required",
          required: {
            start: "Start date (ISO format)",
            end: "End date (ISO format)",
          },
        });
      }

      // Parse dates
      let startDate: Date, endDate: Date;
      try {
        startDate = new Date(start as string);
        endDate = new Date(end as string);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error("Invalid date format");
        }
      } catch (err) {
        return res.status(400).json({
          message: "Invalid date format",
          details:
            "Dates must be in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS.sssZ)",
        });
      }

      // We'll pass the Date objects directly to the database layer
      // The storage layer will handle proper SQL conversion

      // Get economic events within the date range
      const events = await storage.getEconomicEventsByDateRange(
        startDate,
        endDate,
      );
      res.json(events);
    } catch (error) {
      // Use error handling service
      errorHandler.logDatabaseError(error, "SELECT", "economic_events", {
        start: req.query.start,
        end: req.query.end,
      });

      res
        .status(500)
        .json({ message: "Failed to fetch economic events for date range" });
    }
  });

  async function requestAndSaveAnalysis(
    symbol: string,
    res: Response,
    forceRefresh: boolean = false,
  ) {
    // Use a unique client ID for rate limiting based on the symbol
    // This is a simple approach - in production you'd use IP, API key, or user ID
    const clientId = `analysis_${symbol}`;

    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL || "http://0.0.0.0:5000";
      const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
      const useArabicModel = process.env.USE_ARABIC_MODEL === "true";

      // Try to get from cache first (if we have a cached analysis and not forcing refresh)
      const cachedAnalysis = analysisCache.get(symbol);
      if (cachedAnalysis && !forceRefresh) {
        log(`Using cached analysis for ${symbol}`, "ai");
        return res.json(cachedAnalysis);
      }

      // If we're forcing a refresh, clear this item from cache
      if (forceRefresh && cachedAnalysis) {
        log(`Force refreshing analysis for ${symbol}`, "ai");
        analysisCache.delete(symbol);
      }

      // Get market data for the symbol
      const marketData = await storage.getMarketData(symbol);
      if (!marketData) {
        return res
          .status(404)
          .json({ message: "Symbol not found in market data" });
      }

      let englishAnalysis;
      let indicators;
      let arabicAnalysis = null;
      let usedDeepSeekFallback = false;

      try {
        // Try the local AI service first
        log(
          `Requesting analysis from local AI service at ${aiServiceUrl}`,
          "ai",
        );

        // Request analysis from AI service with timeout and error handling
        const englishResponse = await axios.post(
          `${aiServiceUrl}/analyze`,
          {
            symbol: symbol,
            price: marketData.price.toString(),
            change: marketData.change.toString(),
            changePercent: marketData.changePercent.toString(),
          },
          {
            timeout: 5000, // 5 second timeout to fail fast if service is down
            validateStatus: (status) => status === 200, // Only accept 200 responses
          },
        );

        englishAnalysis = englishResponse.data.analysis;
        indicators = englishResponse.data.indicators;

        if (useArabicModel) {
          // Also request Arabic analysis if enabled (in parallel using a worker thread)
          const arabicRequestPromise = new Promise<string>(
            async (resolve, reject) => {
              try {
                // Run in a separate flow to avoid blocking main thread
                setTimeout(async () => {
                  try {
                    const arabicResponse = await axios.post(
                      `${aiServiceUrl}/analyze/arabic`,
                      {
                        symbol: symbol,
                        price: marketData.price.toString(),
                        change: marketData.change.toString(),
                        changePercent: marketData.changePercent.toString(),
                      },
                      { timeout: 8000 },
                    ); // Longer timeout for Arabic model

                    resolve(arabicResponse.data.analysis);
                  } catch (arabicError) {
                    // Log Arabic-specific error but don't fail the whole request
                    log(
                      `DeepSeek API fallback for ${symbol} (arabic): ${arabicError}`,
                      "ai",
                    );

                    // If we have DeepSeek API key, try to translate the English analysis
                    if (
                      deepseekApiKey &&
                      checkRateLimit(clientId, "deepseek")
                    ) {
                      try {
                        log(
                          `Falling back to DeepSeek for Arabic translation of ${symbol}`,
                          "ai",
                        );

                        const arabicPrompt = `
                      Translate the following market analysis to formal Arabic:

                      ${englishAnalysis}
                      `;

                        const arabicDeepseekResponse = await axios.post(
                          "https://api.deepseek.com/v1/chat/completions",
                          {
                            model: "deepseek-chat",
                            messages: [{ role: "user", content: arabicPrompt }],
                            temperature: 0.3,
                            max_tokens: 1000,
                          },
                          {
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${deepseekApiKey}`,
                            },
                          },
                        );

                        const arabicTranslation =
                          arabicDeepseekResponse.data.choices[0].message
                            .content;
                        log(
                          `Successfully translated ${symbol} analysis to Arabic via DeepSeek`,
                          "ai",
                        );
                        resolve(arabicTranslation);
                      } catch (deepseekError) {
                        // If DeepSeek also fails, just return null for arabicAnalysis
                        log(
                          `DeepSeek Arabic translation failed: ${deepseekError}`,
                          "ai",
                        );
                        reject(deepseekError);
                      }
                    } else {
                      // No DeepSeek API key or rate limited
                      reject(arabicError);
                    }
                  }
                }, 0);
              } catch (error) {
                reject(error);
              }
            },
          );

          // Wait for Arabic translation with timeout
          try {
            arabicAnalysis = await Promise.race([
              arabicRequestPromise,
              new Promise<null>((resolve) =>
                setTimeout(() => resolve(null), 10000),
              ), // 10 second max wait
            ]);

            if (arabicAnalysis === null) {
              log(`Arabic translation timed out for ${symbol}`, "ai");
            }
          } catch (arabicError) {
            log(`Arabic translation failed: ${arabicError}`, "ai");
            // Continue without Arabic translation
          }
        }
      } catch (localAiError) {
        // Log the local AI service failure
        log(
          `DeepSeek API fallback for ${symbol} (english): ${localAiError instanceof Error ? localAiError.message : String(localAiError)}`,
          "ai",
        );
        log(
          `Local AI service failed: ${localAiError.message}. Falling back to DeepSeek API.`,
          "ai",
        );

        // Check if we can use DeepSeek API as fallback
        if (!deepseekApiKey) {
          log("No DeepSeek API key found in environment.", "ai");
          throw new Error(
            "AI service unavailable and no DeepSeek API key configured",
          );
        }

        // Check rate limit before making the API call
        if (!checkRateLimit(clientId, "deepseek")) {
          log(
            `Rate limit exceeded for DeepSeek API request for ${symbol}`,
            "ai",
          );
          return res.status(429).json({
            message:
              "Rate limit exceeded for AI analysis. Please try again later.",
            retryAfter: 60, // Suggest retry after 1 minute
          });
        }

        usedDeepSeekFallback = true;

        // Construct market analysis prompt for DeepSeek
        const prompt = `
        Analyze the following stock/cryptocurrency:
        Symbol: ${symbol}
        Current Price: ${marketData.price.toString()}
        Change: ${marketData.change.toString()} (${marketData.changePercent.toString()}%)

        Provide a comprehensive market analysis including:
        1. Technical indicators assessment
        2. Recent price movement analysis
        3. Market sentiment
        4. Short-term price prediction

        Format your response as a JSON object with the following structure:
        {
          "analysis": "Your detailed market analysis here...",
          "indicators": {
            "rsi": number (0-100),
            "macd": "bullish" or "bearish",
            "moving_average": "uptrend" or "downtrend"
          }
        }
        `;

        try {
          // Call DeepSeek API with proper error handling
          log(`Requesting analysis from DeepSeek API for ${symbol}`, "ai");
          const deepseekResponse = await axios.post(
            "https://api.deepseek.com/v1/chat/completions",
            {
              model: "deepseek-chat",
              messages: [{ role: "user", content: prompt }],
              response_format: { type: "json_object" },
              temperature: 0.3,
              max_tokens: 1000,
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${deepseekApiKey}`,
              },
              timeout: 15000, // 15 second timeout for external API
            },
          );

          // Parse DeepSeek response
          const content = deepseekResponse.data.choices[0].message.content;
          let parsedContent;

          try {
            parsedContent = JSON.parse(content);
          } catch (parseError) {
            log(
              `Failed to parse DeepSeek response for ${symbol}: ${parseError}`,
              "ai",
            );
            // Try to salvage analysis by extracting from non-JSON response
            const analysisMatch = content.match(/\"analysis\"\s*:\s*\"(.*?)\"/);
            const rsiMatch = content.match(/\"rsi\"\s*:\s*(\d+)/);
            const macdMatch = content.match(
              /\"macd\"\s*:\s*\"(bullish|bearish)\"/,
            );
            const movingAvgMatch = content.match(
              /\"moving_average\"\s*:\s*\"(uptrend|downtrend)\"/,
            );

            if (analysisMatch && rsiMatch && macdMatch && movingAvgMatch) {
              parsedContent = {
                analysis: analysisMatch[1],
                indicators: {
                  rsi: parseInt(rsiMatch[1]),
                  macd: macdMatch[1],
                  moving_average: movingAvgMatch[1],
                },
              };
              log(
                `Salvaged partial analysis for ${symbol} from malformed JSON`,
                "ai",
              );
            } else {
              throw new Error("Could not parse or salvage DeepSeek response");
            }
          }

          englishAnalysis = parsedContent.analysis;
          indicators = parsedContent.indicators;

          // If Arabic analysis is required and we haven't already obtained it
          if (useArabicModel && !arabicAnalysis) {
            // Check rate limit for the Arabic translation request
            if (checkRateLimit(`${clientId}_arabic`, "deepseek")) {
              try {
                log(
                  `Requesting Arabic translation from DeepSeek for ${symbol}`,
                  "ai",
                );
                const arabicPrompt = `
                Translate the following market analysis to formal Arabic:

                ${englishAnalysis}
                `;

                const arabicDeepseekResponse = await axios.post(
                  "https://api.deepseek.com/v1/chat/completions",
                  {
                    model: "deepseek-chat",
                    messages: [{ role: "user", content: arabicPrompt }],
                    temperature: 0.3,
                    max_tokens: 1000,
                  },
                  {
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${deepseekApiKey}`,
                    },
                    timeout: 10000, // 10 second timeout for translation
                  },
                );

                arabicAnalysis =
                  arabicDeepseekResponse.data.choices[0].message.content;
                log(
                  `Successfully translated ${symbol} analysis to Arabic via DeepSeek`,
                  "ai",
                );
              } catch (arabicError) {
                log(`DeepSeek Arabic translation failed: ${arabicError}`, "ai");
                arabicAnalysis = null; // Proceed without Arabic translation
              }
            } else {
              log(
                `Rate limit exceeded for Arabic translation of ${symbol}`,
                "ai",
              );
              arabicAnalysis = null; // Skip translation due to rate limit
            }
          }
        } catch (deepseekError) {
          // Handle DeepSeek API errors
          log(`DeepSeek API error for ${symbol}: ${deepseekError}`, "ai");

          // Send a more specific error response based on the error
          if (deepseekError.response?.status === 429) {
            return res.status(429).json({
              message:
                "DeepSeek API rate limit exceeded. Please try again later.",
              retryAfter: 300, // 5 minutes
            });
          } else {
            throw new Error(`DeepSeek API error: ${deepseekError.message}`);
          }
        }
      }

      // Calculate prediction based on indicators - handle different formats safely
      // First, determine if macd is a string or an object with components
      let macdSentiment = "neutral";
      if (indicators && indicators.macd) {
        // Handle string macd value (e.g., 'bullish' or 'bearish')
        if (typeof indicators.macd === "string") {
          macdSentiment = indicators.macd;
        }
        // Handle object macd value (e.g., {value: "-0.70", signal: "0.73", histogram: "0.14"})
        else if (
          typeof indicators.macd === "object" &&
          indicators.macd.value &&
          indicators.macd.signal
        ) {
          // If histogram is positive, consider bullish
          if (
            indicators.macd.histogram &&
            parseFloat(indicators.macd.histogram) > 0
          ) {
            macdSentiment = "bullish";
          } else {
            macdSentiment = "bearish";
          }
        }
      }

      const prediction = {
        direction: macdSentiment === "bullish" ? "up" : "down",
        target: (
          parseFloat(marketData.price.toString()) *
          (1 + (macdSentiment === "bullish" ? 0.03 : -0.02))
        ).toFixed(2),
        days: 7,
      };

      let confidence = "75.00"; // Default confidence
      if (indicators && typeof indicators.rsi === "number") {
        confidence =
          indicators.rsi > 70 || indicators.rsi < 30 ? "85.00" : "75.00";
      }

      // Ensure we have a valid analysis text to save to database
      const defaultAnalysis = `Analysis for ${symbol} at ${new Date().toISOString()}. 
The current price is ${marketData.price} with a recent change of ${marketData.change} (${marketData.changePercent}%). 
Based on technical indicators, the market sentiment appears to be ${macdSentiment}.`;

      // Save analysis to database with fallback for missing values
      const newAnalysis = await storage.saveAnalysis({
        symbol: symbol,
        analysis: englishAnalysis || defaultAnalysis,
        arabicAnalysis: arabicAnalysis,
        indicators: indicators || {
          rsi: 50,
          macd: macdSentiment,
          ema: { ema9: "0", ema21: "0" },
          sma: { sma50: "0", sma200: "0" },
        },
        prediction: prediction,
        confidence: confidence,
      });

      // Add fallback information in response
      const responseData = {
        ...newAnalysis,
        meta: {
          usedFallback: usedDeepSeekFallback,
          generatedAt: new Date().toISOString(),
          hasArabicTranslation: !!arabicAnalysis,
        },
      };

      // Create rate-limited response with headers
      const rateLimitedResponse = createRateLimitedResponse(
        responseData,
        clientId,
        usedDeepSeekFallback ? "deepseek" : "default",
      );

      // Set rate limit headers
      res.set({
        "X-RateLimit-Remaining":
          rateLimitedResponse.rateLimit.remaining.toString(),
        "X-RateLimit-Reset": new Date(
          rateLimitedResponse.rateLimit.reset,
        ).toISOString(),
      });

      res.json(rateLimitedResponse.data);
    } catch (error) {
      console.error("AI analysis error:", error);
      res.status(500).json({
        message: "Failed to get AI analysis",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Admin monitoring endpoints
  app.get("/api/admin/error-stats", (req: Request, res: Response) => {
    try {
      const stats = errorHandler.getErrorStats();
      res.json(stats);
    } catch (error) {
      console.error("Failed to get error stats:", error);
      res.status(500).json({ error: "Failed to retrieve error statistics" });
    }
  });

  app.get("/api/admin/recent-errors", (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const errors = errorHandler.getRecentErrors(limit);
      res.json(errors);
    } catch (error) {
      console.error("Failed to get recent errors:", error);
      res.status(500).json({ error: "Failed to retrieve recent errors" });
    }
  });

  app.post("/api/admin/reset-error-stats", (req: Request, res: Response) => {
    try {
      errorHandler.resetStats();
      res.json({ success: true, message: "Error statistics have been reset" });
    } catch (error) {
      console.error("Failed to reset error stats:", error);
      res.status(500).json({ error: "Failed to reset error statistics" });
    }
  });

  app.get("/api/admin/cache-stats", (req: Request, res: Response) => {
    try {
      const stats = {
        marketData: marketDataCache.getStats(),
        analysis: analysisCache.getStats(),
        users: userCache.getStats(),
        assets: assetsCache.getStats(),
        economicEvents: economicEventsCache.getStats(),
      };
      res.json(stats);
    } catch (error) {
      console.error("Failed to get cache stats:", error);
      res.status(500).json({ error: "Failed to retrieve cache statistics" });
    }
  });

  app.post("/api/admin/clear-cache", (req: Request, res: Response) => {
    try {
      const { cache } = req.body;

      if (cache === "all") {
        marketDataCache.clear();
        analysisCache.clear();
        userCache.clear();
        assetsCache.clear();
        economicEventsCache.clear();
        res.json({ success: true, message: "All caches cleared" });
      } else if (cache === "marketData") {
        marketDataCache.clear();
        res.json({ success: true, message: "Market data cache cleared" });
      } else if (cache === "analysis") {
        analysisCache.clear();
        res.json({ success: true, message: "Analysis cache cleared" });
      } else if (cache === "users") {
        userCache.clear();
        res.json({ success: true, message: "User cache cleared" });
      } else if (cache === "assets") {
        assetsCache.clear();
        res.json({ success: true, message: "Assets cache cleared" });
      } else if (cache === "economicEvents") {
        economicEventsCache.clear();
        res.json({ success: true, message: "Economic events cache cleared" });
      } else {
        res.status(400).json({ error: "Invalid cache specified" });
      }
    } catch (error) {
      console.error("Failed to clear cache:", error);
      res.status(500).json({ error: "Failed to clear cache" });
    }
  });

  // Test endpoint for triggering notifications without admin auth
  app.post(
    "/api/test/trigger-notifications",
    async (req: Request, res: Response) => {
      try {
        const { types = ["all"], userId } = req.body;

        console.log(
          `[TEST] Manually triggering notifications: ${types.join(", ")}`,
        );

        const results = { triggered: [], errors: [], timing: {} };

        // Check which notification types to trigger
        const triggerAll = types.includes("all");
        const triggerEconomicEvents =
          triggerAll || types.includes("economic_events");
        const triggerCorrelations =
          triggerAll || types.includes("correlations");
        const triggerVolatility = triggerAll || types.includes("volatility");

        // Get user ID from request if provided (default to user 1)
        const targetUserId = userId || 1;

        // Run the notification checks based on requested types
        if (triggerEconomicEvents) {
          try {
            const start = Date.now();
            await checkForEconomicEventNotifications();
            const duration = Date.now() - start;
            results.triggered.push("economic_events");
            results.timing["economic_events"] = `${duration}ms`;
          } catch (error) {
            console.error(
              "Error triggering economic event notifications:",
              error,
            );
            results.errors.push({
              type: "economic_events",
              message: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        if (triggerCorrelations) {
          try {
            const start = Date.now();
            await checkEconomicEventCorrelations();
            const duration = Date.now() - start;
            results.triggered.push("correlations");
            results.timing["correlations"] = `${duration}ms`;
          } catch (error) {
            console.error("Error triggering correlation notifications:", error);
            results.errors.push({
              type: "correlations",
              message: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        if (triggerVolatility) {
          try {
            const start = Date.now();
            await checkUpcomingVolatilityEvents();
            const duration = Date.now() - start;
            results.triggered.push("volatility");
            results.timing["volatility"] = `${duration}ms`;
          } catch (error) {
            console.error("Error triggering volatility notifications:", error);
            results.errors.push({
              type: "volatility",
              message: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        // Run all checks at once if requested
        if (triggerAll && types.length === 1) {
          try {
            const start = Date.now();
            await runAllNotificationChecks();
            const duration = Date.now() - start;
            results.timing["all_combined"] = `${duration}ms`;
          } catch (error) {
            console.error("Error triggering all notifications:", error);
            results.errors.push({
              type: "all_combined",
              message: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        res.json({
          success: true,
          triggered: Date.now(),
          results,
        });
      } catch (error) {
        console.error("Error in test trigger-notifications endpoint:", error);
        res.status(500).json({
          error: "Failed to trigger notifications",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // This just registers the admin router which contains all the admin routes
  app.use("/api/admin", adminRouter);

  // The following direct admin routes are now deprecated and will be removed in a future version
  // These are maintained for backward compatibility only and redirect to the centralized admin router

  // Custom admin routes for direct access - redirecting to admin router
  app.get("/api/admin/kyc", (req: Request, res: Response) => {
    console.log("GET /api/admin/kyc - Request received, delegating to admin router via /api/admin/kyc");
    // This endpoint is now handled by the admin router in /server/routes/admin/index.ts
    // where we've added a redirect from /kyc to /kyc-requests
    // No need to implement the logic here, just forward the request
    req.url = "/kyc";
    adminRouter.handle(req, res, (err) => {
      if (err) {
        console.error("Error delegating to admin router:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });
  });

  // Admin trades endpoint - delegating to admin router
  app.get("/api/admin/trades", (req: Request, res: Response) => {
    console.log("GET /api/admin/trades - Request received, delegating to admin router via /api/admin/trades");
    // This endpoint is now handled by the admin router in /server/routes/admin/index.ts
    // where we already have an endpoint for /trades
    // No need to implement the logic here, just forward the request
    req.url = "/trades";
    adminRouter.handle(req, res, (err) => {
      if (err) {
        console.error("Error delegating to admin router:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });
  });

  // Mount bonus routes
  app.use("/api/bonuses", bonusRouter);

  // Portfolio holdings endpoint
  app.get("/api/portfolio/holdings", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: "Unauthorized",
        message: "You must be logged in to view portfolio holdings"
      });
    }

    try {
      const summary = await storage.getPortfolioSummary(req.user.id);
      // Return the holdings from the portfolio summary
      res.setHeader('Content-Type', 'application/json');
      res.json(summary?.holdings || []);
    } catch (error) {
      console.error("Portfolio holdings error:", error);
      res.status(500).json({ 
        error: "Failed to fetch portfolio holdings",
        message: "An error occurred while retrieving your portfolio holdings"
      });
    }
  });

  // Portfolio summary route
  app.get("/api/portfolio-summary", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const summary = await storage.getPortfolioSummary(req.user.id);
      res.setHeader('Content-Type', 'application/json');
      res.json({
        totalValue: summary?.totalValue || "0",
        changePercent: summary?.changePercent || "0",
        holdings: summary?.holdings || [],
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Portfolio summary error:", error);
      res.status(500).json({ error: "Failed to fetch portfolio summary" });
    }
  });

  // Change password route (implemented in routes.ts for easier testing)
  app.post("/api/auth/change-password-test", (req, res) => {
    console.log("Change password test endpoint hit with body:", req.body);

    // Set appropriate content type header
    res.setHeader('Content-Type', 'application/json');

    // Return success response
    return res.status(200).json({ 
      message: "Password change test endpoint reached", 
      body: req.body,
      contentType: "application/json" 
    });
  });

  return httpServer;
}