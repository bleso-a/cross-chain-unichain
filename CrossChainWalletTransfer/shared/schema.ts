import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  walletId: text("wallet_id").notNull().unique(),
  address: text("address").notNull(),
  blockchain: text("blockchain").notNull(),
  balance: text("balance"),
  lastUpdated: timestamp("last_updated").defaultNow()
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  fromWalletId: text("from_wallet_id").notNull(),
  toWalletId: text("to_wallet_id").notNull(),
  amount: text("amount").notNull(),
  status: text("status").notNull(),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow()
});

export const insertWalletSchema = createInsertSchema(wallets).omit({ 
  id: true,
  lastUpdated: true 
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true
});

export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof wallets.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
