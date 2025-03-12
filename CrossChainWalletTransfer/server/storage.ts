import type { InsertWallet, Wallet, InsertTransaction, Transaction } from "@shared/schema";

export interface IStorage {
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  getWallet(id: string): Promise<Wallet | undefined>;
  updateWalletBalance(id: string, balance: string): Promise<Wallet>;
  createTransaction(tx: InsertTransaction): Promise<Transaction>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  listWallets(): Promise<Wallet[]>;
}

export class MemStorage implements IStorage {
  private wallets: Map<string, Wallet>;
  private transactions: Map<string, Transaction>;
  private currentWalletId: number;
  private currentTxId: number;

  constructor() {
    this.wallets = new Map();
    this.transactions = new Map();
    this.currentWalletId = 1;
    this.currentTxId = 1;
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const id = this.currentWalletId++;
    const wallet: Wallet = { 
      ...insertWallet, 
      id, 
      lastUpdated: new Date(),
      balance: insertWallet.balance || null 
    };
    this.wallets.set(insertWallet.walletId, wallet);
    return wallet;
  }

  async getWallet(walletId: string): Promise<Wallet | undefined> {
    return this.wallets.get(walletId);
  }

  async listWallets(): Promise<Wallet[]> {
    return Array.from(this.wallets.values());
  }

  async updateWalletBalance(walletId: string, balance: string): Promise<Wallet> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');

    const updated = { ...wallet, balance, lastUpdated: new Date() };
    this.wallets.set(walletId, updated);
    return updated;
  }

  async createTransaction(insertTx: InsertTransaction): Promise<Transaction> {
    const id = this.currentTxId++;
    const tx: Transaction = { 
      ...insertTx, 
      id, 
      createdAt: new Date(),
      txHash: insertTx.txHash || null 
    };
    this.transactions.set(String(id), tx);
    return tx;
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }
}

export const storage = new MemStorage();