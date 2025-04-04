/**
 * Wallet System Schema Definitions
 * 
 * This file contains the schema definitions for the wallet system, including:
 * - wallets
 * - wallet_transactions
 * - wallet_transfers
 * - wallet_deposits
 * - wallet_withdrawals
 * 
 * It extends the main schema.ts file with wallet-specific tables.
 */

import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { boolean, text, timestamp, numeric, pgTable, serial, uuid, json, integer } from "drizzle-orm/pg-core";
import { z } from "zod";

// Existing imports and references from schema.ts
import { users, transactions, bonuses, activities, trades } from "./schema";

// Wallet table for storing user wallets
export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'main', 'trading', 'bonus'
  currency: text("currency").notNull(),
  balance: numeric("balance", { precision: 20, scale: 8 }).notNull().default("0.0"),
  availableBalance: numeric("available_balance", { precision: 20, scale: 8 }).notNull().default("0.0"),
  lockedBalance: numeric("locked_balance", { precision: 20, scale: 8 }).notNull().default("0.0"),
  status: text("status").notNull().default("active"), // 'active', 'frozen', 'closed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallet transactions table for storing wallet transactions
export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull().references(() => wallets.id),
  transactionType: text("transaction_type").notNull(), // 'deposit', 'withdrawal', 'transfer', 'trade', 'fee', 'bonus'
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  fee: numeric("fee", { precision: 20, scale: 8 }).notNull().default("0.0"),
  beforeBalance: numeric("before_balance", { precision: 20, scale: 8 }).notNull(),
  afterBalance: numeric("after_balance", { precision: 20, scale: 8 }).notNull(),
  description: text("description"),
  metadata: json("metadata"),
  referenceId: text("reference_id"),
  referenceType: text("reference_type"), // 'trade', 'deposit', 'withdrawal'
  status: text("status").notNull().default("completed"), // 'pending', 'completed', 'failed', 'canceled'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallet transfers table for storing transfers between wallets
export const walletTransfers = pgTable("wallet_transfers", {
  id: serial("id").primaryKey(),
  fromWalletId: integer("from_wallet_id").notNull().references(() => wallets.id),
  toWalletId: integer("to_wallet_id").notNull().references(() => wallets.id),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  fee: numeric("fee", { precision: 20, scale: 8 }).notNull().default("0.0"),
  fromTransactionId: integer("from_transaction_id").references(() => walletTransactions.id),
  toTransactionId: integer("to_transaction_id").references(() => walletTransactions.id),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Deposits table for storing deposit transactions
export const walletDeposits = pgTable("wallet_deposits", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull().references(() => wallets.id),
  transactionId: integer("transaction_id").references(() => walletTransactions.id),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  fee: numeric("fee", { precision: 20, scale: 8 }).notNull().default("0.0"),
  currency: text("currency").notNull(),
  method: text("method").notNull(), // 'bank_transfer', 'credit_card', 'crypto'
  externalId: text("external_id"),
  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'failed', 'canceled'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Withdrawals table for storing withdrawal transactions
export const walletWithdrawals = pgTable("wallet_withdrawals", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull().references(() => wallets.id),
  transactionId: integer("transaction_id").references(() => walletTransactions.id),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  fee: numeric("fee", { precision: 20, scale: 8 }).notNull().default("0.0"),
  currency: text("currency").notNull(),
  method: text("method").notNull(), // 'bank_transfer', 'crypto'
  destination: text("destination").notNull(), // bank account number or crypto wallet address
  externalId: text("external_id"),
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed', 'canceled'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations

// Wallet relations
export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  transactions: many(walletTransactions),
  outgoingTransfers: many(walletTransfers, { relationName: "fromWallet" }),
  incomingTransfers: many(walletTransfers, { relationName: "toWallet" }),
  deposits: many(walletDeposits),
  withdrawals: many(walletWithdrawals),
  trades: many(trades),
}));

// Wallet transactions relations
export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletTransactions.walletId],
    references: [wallets.id],
  }),
  fromTransfer: one(walletTransfers, {
    fields: [walletTransactions.id],
    references: [walletTransfers.fromTransactionId],
  }),
  toTransfer: one(walletTransfers, {
    fields: [walletTransactions.id],
    references: [walletTransfers.toTransactionId],
  }),
  deposit: one(walletDeposits, {
    fields: [walletTransactions.id],
    references: [walletDeposits.transactionId],
  }),
  withdrawal: one(walletWithdrawals, {
    fields: [walletTransactions.id],
    references: [walletWithdrawals.transactionId],
  }),
  openTrade: one(trades, {
    fields: [walletTransactions.id],
    references: [trades.openTransactionId],
  }),
  closeTrade: one(trades, {
    fields: [walletTransactions.id],
    references: [trades.closeTransactionId],
  }),
}));

// Wallet transfers relations
export const walletTransfersRelations = relations(walletTransfers, ({ one }) => ({
  fromWallet: one(wallets, {
    fields: [walletTransfers.fromWalletId],
    references: [wallets.id],
    relationName: "fromWallet",
  }),
  toWallet: one(wallets, {
    fields: [walletTransfers.toWalletId],
    references: [wallets.id],
    relationName: "toWallet",
  }),
  fromTransaction: one(walletTransactions, {
    fields: [walletTransfers.fromTransactionId],
    references: [walletTransactions.id],
  }),
  toTransaction: one(walletTransactions, {
    fields: [walletTransfers.toTransactionId],
    references: [walletTransactions.id],
  }),
}));

// Wallet deposits relations
export const walletDepositsRelations = relations(walletDeposits, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletDeposits.walletId],
    references: [wallets.id],
  }),
  transaction: one(walletTransactions, {
    fields: [walletDeposits.transactionId],
    references: [walletTransactions.id],
  }),
}));

// Wallet withdrawals relations
export const walletWithdrawalsRelations = relations(walletWithdrawals, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletWithdrawals.walletId],
    references: [wallets.id],
  }),
  transaction: one(walletTransactions, {
    fields: [walletWithdrawals.transactionId],
    references: [walletTransactions.id],
  }),
}));

// Create Zod schemas for insert operations

export const insertWalletSchema = createInsertSchema(wallets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWalletTransferSchema = createInsertSchema(walletTransfers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWalletDepositSchema = createInsertSchema(walletDeposits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWalletWithdrawalSchema = createInsertSchema(walletWithdrawals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export types for use in the application

export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof wallets.$inferSelect;

export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactions.$inferSelect;

export type InsertWalletTransfer = z.infer<typeof insertWalletTransferSchema>;
export type WalletTransfer = typeof walletTransfers.$inferSelect;

export type InsertWalletDeposit = z.infer<typeof insertWalletDepositSchema>;
export type WalletDeposit = typeof walletDeposits.$inferSelect;

export type InsertWalletWithdrawal = z.infer<typeof insertWalletWithdrawalSchema>;
export type WalletWithdrawal = typeof walletWithdrawals.$inferSelect;