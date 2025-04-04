/**
 * Validation utilities for WebSocket messages and API requests
 */
import { z } from "zod";
import { log } from "./vite.js";
// Error handling code moved inline for simplicity

// WebSocket message validation schemas
export const marketUpdateSchema = z.object({
  symbol: z.string().min(1).max(10),
  price: z.string().or(z.number().transform((n) => n.toString())),
  change: z.string().or(z.number().transform((n) => n.toString())),
  changePercent: z.string().or(z.number().transform((n) => n.toString())),
  volume: z
    .string()
    .or(z.number().transform((n) => n.toString()))
    .optional(),
  timestamp: z.number().int().positive(),
  // Additional fields with optional validation
  name: z.string().optional(),
  assetType: z.string().optional(),
  sector: z.string().optional(),
  country: z.string().optional(),
  high24h: z
    .string()
    .or(z.number().transform((n) => n.toString()))
    .nullable()
    .optional(),
  low24h: z
    .string()
    .or(z.number().transform((n) => n.toString()))
    .nullable()
    .optional(),
});

export const subscriptionSchema = z.object({
  type: z.literal("subscribe"),
  symbols: z.array(z.string().min(1).max(10)).min(1),
});

export const unsubscriptionSchema = z.object({
  type: z.literal("unsubscribe"),
  symbols: z.array(z.string().min(1).max(10)).min(1).optional(),
});

// API rate limit tracking
interface RateLimitConfig {
  maxRequests: number;
  timeWindowMs: number;
  cooldownMs: number;
}

interface RateLimitTracker {
  requests: number;
  windowStart: number;
  isBlocked: boolean;
  blockedUntil: number;
}

// Map to store rate limits by client identifier (IP or API key)
const rateLimits = new Map<string, RateLimitTracker>();

// Default rate limit configurations
const defaultRateLimit: RateLimitConfig = {
  maxRequests: 60, // 60 requests
  timeWindowMs: 60000, // per minute
  cooldownMs: 30000, // 30 second cooldown if exceeded
};

const deepseekRateLimit: RateLimitConfig = {
  maxRequests: 10, // 10 requests
  timeWindowMs: 60000, // per minute
  cooldownMs: 60000 * 5, // 5 minute cooldown if exceeded
};

/**
 * Check if a request from a client exceeds the rate limit
 * @param clientId Unique identifier for the client (IP address, API key, etc.)
 * @param serviceType Optional service type to apply different rate limits
 * @returns True if the request is allowed, false if it exceeds the rate limit
 */
export function checkRateLimit(
  clientId: string,
  serviceType: "default" | "deepseek" = "default",
): boolean {
  const config =
    serviceType === "deepseek" ? deepseekRateLimit : defaultRateLimit;
  const now = Date.now();

  // Get or initialize rate limit tracker for this client
  let tracker = rateLimits.get(clientId);
  if (!tracker) {
    tracker = {
      requests: 0,
      windowStart: now,
      isBlocked: false,
      blockedUntil: 0,
    };
    rateLimits.set(clientId, tracker);
  }

  // Check if the client is currently blocked
  if (tracker.isBlocked) {
    if (now > tracker.blockedUntil) {
      // Unblock the client if the cooldown period has passed
      tracker.isBlocked = false;
      tracker.requests = 1;
      tracker.windowStart = now;
      return true;
    }

    // Client is still blocked
    log(
      `Rate limit exceeded for ${clientId} (${serviceType}). Blocked for ${Math.round((tracker.blockedUntil - now) / 1000)}s more`,
      "ratelimit",
    );
    return false;
  }

  // Check if we need to reset the time window
  if (now - tracker.windowStart > config.timeWindowMs) {
    tracker.requests = 1;
    tracker.windowStart = now;
    return true;
  }

  // Increment request count and check if over limit
  tracker.requests++;
  if (tracker.requests > config.maxRequests) {
    // Block the client for the cooldown period
    tracker.isBlocked = true;
    tracker.blockedUntil = now + config.cooldownMs;

    log(
      `Rate limit exceeded for ${clientId} (${serviceType}). Blocked for ${config.cooldownMs / 1000}s`,
      "ratelimit",
    );
    return false;
  }

  return true;
}

/**
 * Validate WebSocket message data
 * @param data Message data to validate
 * @param schema Zod schema to validate against
 * @returns Validated data or null if validation fails
 */
export function validateWebSocketMessage<T>(
  data: any,
  schema: z.ZodSchema<T>,
): T | null {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      log(
        `WebSocket message validation failed: ${error.errors.map((e) => e.message).join(", ")}`,
        "websocket",
      );
    }
    return null;
  }
}

// DeepSeek API fallback logging was removed as we now solely rely on DeepSeek API

/**
 * Create an API response with rate limit information
 * @param data Response data
 * @param clientId Client identifier for rate limit tracking
 * @param serviceType Service type for rate limit configuration
 * @returns Response object with data and rate limit information
 */
export function createRateLimitedResponse<T>(
  data: T,
  clientId: string,
  serviceType: "default" | "deepseek" = "default",
): {
  data: T;
  rateLimit: {
    remaining: number;
    reset: number;
  };
} {
  const config =
    serviceType === "deepseek" ? deepseekRateLimit : defaultRateLimit;
  const tracker = rateLimits.get(clientId);

  if (!tracker) {
    return {
      data,
      rateLimit: {
        remaining: config.maxRequests - 1,
        reset: Date.now() + config.timeWindowMs,
      },
    };
  }

  const remaining = Math.max(0, config.maxRequests - tracker.requests);
  const reset = tracker.isBlocked
    ? tracker.blockedUntil
    : tracker.windowStart + config.timeWindowMs;

  return {
    data,
    rateLimit: {
      remaining,
      reset,
    },
  };
}
