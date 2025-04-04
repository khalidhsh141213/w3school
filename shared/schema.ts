import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  numeric,
  json,
  date,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  phoneNumber: text("phone_number"),
  profilePictureUrl: text("profile_picture_url"),
  isVerified: boolean("is_verified").default(false),
  verificationStatus: text("verification_status").default("pending"),
  verificationNotes: text("verification_notes"), // Admin notes on verification
  country: text("country"), // User's country
  city: text("city"), // User's city
  address: text("address"), // User's address
  userRole: text("user_role").default("user"),
  languagePreference: text("language_preference").default("en"),
  currencyPreference: text("currency_preference").default("USD"),
  themePreference: text("theme_preference").default("light"),
  notificationPreference: json("notification_preference").default({}),
  privacySettings: json("privacy_settings").default({}),
  interfaceSettings: json("interface_settings").default({}), // واجهة المستخدم: حجم الخط، تباعد العناصر، تخطيط الصفحة، الخ
  balance: numeric("balance", { precision: 10, scale: 2 })
    .default("10000.00")
    .notNull(),
  bonusBalance: numeric("bonus_balance", { precision: 10, scale: 2 }).default(
    "0.00",
  ), // رصيد المكافآت
  referralCode: text("referral_code").unique(), // رمز الإحالة الفريد للمستخدم
  referredBy: integer("referred_by").references(() => users.id), // المستخدم الذي قام بالإحالة
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// KYC Documents table for storing user verification documents
export const kycDocuments = pgTable("kyc_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  documentType: text("document_type").notNull(), // passport, national_id, driver_license, etc.
  documentNumber: text("document_number"), // ID number, passport number, etc.
  documentFrontUrl: text("document_front_url").notNull(), // URL to the front image of the document
  documentBackUrl: text("document_back_url"), // URL to the back image of the document (optional)
  selfieUrl: text("selfie_url"), // URL to the selfie image (optional)
  additionalDocumentUrls: json("additional_document_urls").default([]), // Array of additional document URLs
  issueDate: timestamp("issue_date"), // When the document was issued
  expiryDate: timestamp("expiry_date"), // When the document expires
  status: text("status").default("pending").notNull(), // pending, approved, rejected
  adminNotes: text("admin_notes"), // Admin notes for internal use
  submitDate: timestamp("submit_date").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const kycDocumentsRelations = relations(kycDocuments, ({ one }) => ({
  user: one(users, {
    fields: [kycDocuments.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  watchlists: many(watchlist),
  portfolios: many(portfolio),
  trades: many(trades),
  sessions: many(sessions),
  transactions: many(transactions),
  bonuses: many(bonuses),
  activities: many(activities),
  kycDocuments: many(kycDocuments),
  referredUsers: many(users, {
    relationName: "referralRelation",
  }),
  referrer: one(users, {
    relationName: "referralRelation",
    fields: [users.referredBy],
    references: [users.id],
  }),
  sentReferrals: many(referrals, {
    relationName: "referrerRelation",
  }),
  receivedReferrals: many(referrals, {
    relationName: "referredRelation",
  }),
}));

// New Assets table
export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(), // stock, crypto, forex, commodity, etc.
  sector: text("sector"),
  industry: text("industry"),
  marketCap: numeric("market_cap", { precision: 20, scale: 2 }),
  country: text("country"),
  exchange: text("exchange"),
  currency: text("currency").default("USD").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  website: text("website"),
  isActive: boolean("is_active").default(true).notNull(),
  featured: boolean("featured").default(false), // Whether asset should be featured on homepage
  // Added fields from market_data
  lastPrice: numeric("last_price", { precision: 10, scale: 2 }),
  priceChange: numeric("price_change", { precision: 10, scale: 2 }),
  priceChangePercentage: numeric("price_change_percentage", {
    precision: 10,
    scale: 2,
  }),
  dailyVolume: numeric("daily_volume", { precision: 16, scale: 0 }),
  high24h: numeric("high_24h", { precision: 10, scale: 2 }),
  low24h: numeric("low_24h", { precision: 10, scale: 2 }),
  // New fields requested by the client
  polygonSymbol: text("polygon_symbol"), // Symbol used in Polygon API
  tradingviewSymbol: text("tradingview_symbol"), // Symbol used in TradingView
  price: numeric("price", { precision: 10, scale: 2 }), // Current price from market update
  marketStatus: text("market_status").default("active"), // Market status: active, suspended, halted, etc.
  lastUpdatedAt: timestamp("last_updated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const assetsRelations = relations(assets, ({ many, one }) => ({
  priceHistory: many(priceHistory),
  analysis: one(aiAnalysis, {
    fields: [assets.symbol],
    references: [aiAnalysis.symbol],
  }),
}));

// New Price History table
export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  symbol: text("symbol")
    .notNull()
    .references(() => assets.symbol),
  timestamp: timestamp("timestamp").notNull(),
  open: numeric("open", { precision: 10, scale: 2 }).notNull(),
  high: numeric("high", { precision: 10, scale: 2 }).notNull(),
  low: numeric("low", { precision: 10, scale: 2 }).notNull(),
  close: numeric("close", { precision: 10, scale: 2 }).notNull(),
  volume: numeric("volume", { precision: 16, scale: 0 }).notNull(),
  interval: text("interval").notNull(), // 1m, 5m, 15m, 1h, 4h, 1d, 1w, 1mo
});

export const priceHistoryRelations = relations(priceHistory, ({ one }) => ({
  asset: one(assets, {
    fields: [priceHistory.symbol],
    references: [assets.symbol],
  }),
}));

// New Economic Events table
export const economicEvents = pgTable("economic_events", {
  id: serial("id").primaryKey(),
  eventDate: timestamp("event_date").notNull(),
  releaseDate: timestamp("release_date").notNull(),
  eventName: text("event_name").notNull(),
  country: text("country").notNull(),
  impact: text("impact").notNull(), // High, Medium, Low
  forecast: text("forecast"),
  previous: text("previous"),
  actual: text("actual"),
  unit: text("unit"), // %, USD, etc.
  description: text("description"),
  source: text("source"),
  affectedAssets: json("affected_assets"), // array of asset symbols
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bonuses table - for user bonuses and promotions
export const bonuses = pgTable("bonuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  type: text("type").notNull(), // welcome, deposit, referral, promotion
  description: text("description").notNull(),
  status: text("status").default("active").notNull(), // active, used, expired
  conditions: json("conditions").default({}), // conditions for bonus usage
  startDate: timestamp("start_date").defaultNow().notNull(),
  expiryDate: timestamp("expiry_date"), // optional expiry date
  usedAmount: numeric("used_amount", { precision: 10, scale: 2 }).default(
    "0.00",
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bonusesRelations = relations(bonuses, ({ one, many }) => ({
  user: one(users, {
    fields: [bonuses.userId],
    references: [users.id],
  }),
  trades: many(trades, {
    relationName: "bonusTradeRelation",
  }),
}));

// Activities table - for tracking user activities
export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(), // login, trade, deposit, withdrawal, bonus_received, bonus_used, password_change, settings_update
  description: text("description").notNull(),
  metadata: json("metadata").default({}), // additional data about the activity
  ip: text("ip"), // IP address
  userAgent: text("user_agent"), // browser/device info
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  relatedEntityType: text("related_entity_type"), // trade, transaction, bonus, etc.
  relatedEntityId: text("related_entity_id"), // ID of the related entity
});

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

// Referrals table - for tracking user referrals
export const referrals = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerId: integer("referrer_id")
    .notNull()
    .references(() => users.id),
  referredId: integer("referred_id")
    .notNull()
    .references(() => users.id),
  referralCode: text("referral_code").notNull(),
  status: text("status").default("pending").notNull(), // pending, completed, rewarded
  reward: uuid("reward_id").references(() => bonuses.id), // related bonus given as reward
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"), // when referral conditions were met
});

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    relationName: "referrerRelation",
    fields: [referrals.referrerId],
    references: [users.id],
  }),
  referred: one(users, {
    relationName: "referredRelation",
    fields: [referrals.referredId],
    references: [users.id],
  }),
  bonus: one(bonuses, {
    fields: [referrals.reward],
    references: [bonuses.id],
  }),
}));

export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  symbol: text("symbol")
    .notNull()
    .references(() => assets.symbol),
  name: text("name").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const watchlistRelations = relations(watchlist, ({ one }) => ({
  user: one(users, {
    fields: [watchlist.userId],
    references: [users.id],
  }),
  asset: one(assets, {
    fields: [watchlist.symbol],
    references: [assets.symbol],
  }),
}));

export const portfolio = pgTable("portfolio", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  symbol: text("symbol")
    .notNull()
    .references(() => assets.symbol),
  shares: numeric("shares", { precision: 10, scale: 2 }).notNull(),
  avgPrice: numeric("avg_price", { precision: 10, scale: 2 }).notNull(),
  purchaseDate: timestamp("purchase_date").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const portfolioRelations = relations(portfolio, ({ one }) => ({
  user: one(users, {
    fields: [portfolio.userId],
    references: [users.id],
  }),
  asset: one(assets, {
    fields: [portfolio.symbol],
    references: [assets.symbol],
  }),
}));

// Portfolio Summary table for user portfolio overview
export const portfolioSummary = pgTable("portfolio_summary", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id)
    .unique(),
  totalBalance: numeric("total_balance", { precision: 15, scale: 2 }).notNull(),
  totalEquity: numeric("total_equity", { precision: 15, scale: 2 }).notNull(),
  totalProfit: numeric("total_profit", { precision: 15, scale: 2 }).notNull(),
  totalLoss: numeric("total_loss", { precision: 15, scale: 2 }).notNull(),
  openPositions: integer("open_positions").notNull(),
  totalInvestment: numeric("total_investment", {
    precision: 15,
    scale: 2,
  }).notNull(),
  availableBalance: numeric("available_balance", {
    precision: 15,
    scale: 2,
  }).notNull(),
  marginAuthorized: numeric("margin_authorized", {
    precision: 15,
    scale: 2,
  }).default("0.00"),
  marginUsed: numeric("margin_used", { precision: 15, scale: 2 }).default(
    "0.00",
  ),
  unauthorizedPnl: numeric("unauthorized_pnl", {
    precision: 15,
    scale: 2,
  }).default("0.00"),
  totalReturn: numeric("total_return", { precision: 15, scale: 2 }).notNull(),
  lastUpdate: timestamp("last_update").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const portfolioSummaryRelations = relations(
  portfolioSummary,
  ({ one }) => ({
    user: one(users, {
      fields: [portfolioSummary.userId],
      references: [users.id],
    }),
  }),
);

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  symbol: text("symbol")
    .notNull()
    .references(() => assets.symbol),
  type: text("type").notNull(), // 'buy' or 'sell'
  shares: numeric("shares", { precision: 10, scale: 2 }).notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  closePrice: numeric("close_price", { precision: 10, scale: 2 }),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  commission: numeric("commission", { precision: 10, scale: 2 }).notNull(),
  usedBonus: boolean("used_bonus").default(false), // ما إذا كانت الصفقة استخدمت مكافأة
  bonusAmount: numeric("bonus_amount", { precision: 10, scale: 2 }).default(
    "0.00",
  ), // مقدار المكافأة المستخدمة في الصفقة
  bonusId: uuid("bonus_id").references(() => bonuses.id), // المكافأة المستخدمة في الصفقة
  stopLoss: numeric("stop_loss", { precision: 10, scale: 2 }),
  takeProfit: numeric("take_profit", { precision: 10, scale: 2 }),
  status: text("status").default("open").notNull(), // 'open' or 'closed'
  closedBy: text("closed_by"), // 'user', 'stopLoss', 'takeProfit'
  tradeDate: timestamp("trade_date").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

export const tradesRelations = relations(trades, ({ one }) => ({
  user: one(users, {
    fields: [trades.userId],
    references: [users.id],
  }),
  asset: one(assets, {
    fields: [trades.symbol],
    references: [assets.symbol],
  }),
  bonus: one(bonuses, {
    fields: [trades.bonusId],
    references: [bonuses.id],
  }),
}));

export const marketData = pgTable("market_data", {
  id: serial("id").primaryKey(),
  symbol: text("symbol")
    .notNull()
    .references(() => assets.symbol)
    .unique(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  dailyChange: numeric("daily_change", { precision: 10, scale: 2 }).notNull(),
  dailyChangePercent: numeric("daily_change_percent", {
    precision: 10,
    scale: 2,
  }).notNull(),
  intradayChange: numeric("intraday_change", { precision: 10, scale: 2 }),
  intradayChangePercent: numeric("intraday_change_percent", {
    precision: 10,
    scale: 2,
  }),
  volume: numeric("volume", { precision: 16, scale: 0 }).notNull(),
  high24h: numeric("high_24h", { precision: 10, scale: 2 }),
  low24h: numeric("low_24h", { precision: 10, scale: 2 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const marketDataRelations = relations(marketData, ({ one }) => ({
  asset: one(assets, {
    fields: [marketData.symbol],
    references: [assets.symbol],
  }),
}));

export const aiAnalysis = pgTable("ai_analysis", {
  id: serial("id").primaryKey(),
  symbol: text("symbol")
    .notNull()
    .references(() => assets.symbol)
    .unique(),
  analysis: text("analysis").notNull(),
  arabicAnalysis: text("arabic_analysis"),
  indicators: json("indicators").notNull(),
  prediction: json("prediction").notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiAnalysisRelations = relations(aiAnalysis, ({ one }) => ({
  asset: one(assets, {
    fields: [aiAnalysis.symbol],
    references: [assets.symbol],
  }),
}));

// Sessions table for authentication
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  data: json("data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// Transactions table for financial operations
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(), // deposit, withdrawal, fee, etc.
  amount: numeric("amount", { precision: 15, scale: 5 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  status: text("status").default("pending").notNull(), // pending, completed, failed, etc.
  transactionDate: timestamp("transaction_date").defaultNow().notNull(),
  processedByAdmin: boolean("processed_by_admin").default(false),
  notes: text("notes"),
  relatedTradeId: text("related_trade_id"), // Optional reference to a trade ID
  bonusAmount: numeric("bonus_amount", { precision: 10, scale: 2 }).default(
    "0.00",
  ), // مقدار المكافأة المستخدم في المعاملة
  bonusId: uuid("bonus_id").references(() => bonuses.id), // المكافأة المستخدمة في المعاملة
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  bonus: one(bonuses, {
    fields: [transactions.bonusId],
    references: [bonuses.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPriceHistorySchema = createInsertSchema(priceHistory).omit({
  id: true,
});

export const insertEconomicEventSchema = createInsertSchema(
  economicEvents,
).omit({
  id: true,
  createdAt: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlist).omit({
  id: true,
  addedAt: true,
});

export const insertPortfolioSchema = createInsertSchema(portfolio).omit({
  id: true,
  updatedAt: true,
  purchaseDate: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  tradeDate: true,
  closedAt: true,
});

export const insertMarketDataSchema = createInsertSchema(marketData).omit({
  id: true,
  updatedAt: true,
});

export const insertAiAnalysisSchema = createInsertSchema(aiAnalysis).omit({
  id: true,
  createdAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBonusSchema = createInsertSchema(bonuses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  timestamp: true,
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertKycDocumentSchema = createInsertSchema(kycDocuments).omit({
  id: true,
  submitDate: true,
  updatedAt: true,
});

export const insertPortfolioSummarySchema = createInsertSchema(
  portfolioSummary,
).omit({
  id: true,
  lastUpdate: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;

export type InsertPriceHistory = z.infer<typeof insertPriceHistorySchema>;
export type PriceHistory = typeof priceHistory.$inferSelect;

export type InsertEconomicEvent = z.infer<typeof insertEconomicEventSchema>;
export type EconomicEvent = typeof economicEvents.$inferSelect;

export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlist.$inferSelect;

export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type Portfolio = typeof portfolio.$inferSelect;

export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;

export type InsertMarketData = z.infer<typeof insertMarketDataSchema>;
export type MarketData = typeof marketData.$inferSelect;

export type InsertAiAnalysis = z.infer<typeof insertAiAnalysisSchema>;
export type AiAnalysis = typeof aiAnalysis.$inferSelect;

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertBonus = z.infer<typeof insertBonusSchema>;
export type Bonus = typeof bonuses.$inferSelect;

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;

export type InsertKycDocument = z.infer<typeof insertKycDocumentSchema>;
export type KycDocument = typeof kycDocuments.$inferSelect;

export type InsertPortfolioSummary = z.infer<
  typeof insertPortfolioSummarySchema
>;
export type PortfolioSummary = typeof portfolioSummary.$inferSelect;

// ملاحظة: الجداول متاحة للاستيراد عن طريق استخدام المسار import { bonuses, activities, referrals } from "@shared/schema";
