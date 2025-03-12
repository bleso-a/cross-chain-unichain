import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as circle from "./circle";
import { z } from "zod";
import { insertWalletSchema, insertTransactionSchema } from "@shared/schema";
import type { Blockchain } from "@shared/types";
import { USDC_TOKEN_IDS } from '@/lib/constants';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Add GET endpoint to list all wallets
  app.get('/api/wallets', async (_req, res) => {
    try {
      const wallets = await circle.listWallets();
      res.json(wallets);
    } catch (error) {
      console.error('Error listing wallets:', error);
      res.status(500).json({ error: 'Failed to list wallets' });
    }
  });

  app.post('/api/wallets', async (req, res) => {
    try {
      const { blockchain } = req.body as { blockchain: Blockchain };
      const wallet = await circle.createProgrammableWallet(blockchain);

      await storage.createWallet({
        walletId: wallet.id,
        address: wallet.address,
        blockchain: wallet.blockchain,
        balance: '0'
      });

      res.json(wallet);
    } catch (error) {
      console.error('Error creating wallet:', error);
      res.status(500).json({ error: 'Failed to create wallet' });
    }
  });

  app.get('/api/wallets/:id/balance', async (req, res) => {
    try {
      // First ensure the wallet exists in Circle
      const allWallets = await circle.listWallets();
      const circleWallet = allWallets.find(w => w.id === req.params.id);

      if (!circleWallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      // Get fresh balance from Circle
      const balance = await circle.getWalletBalance(req.params.id);

      // Ensure wallet exists in our storage
      const storedWallet = await storage.getWallet(req.params.id);
      if (!storedWallet) {
        await storage.createWallet({
          walletId: circleWallet.id,
          address: circleWallet.address,
          blockchain: circleWallet.blockchain,
          balance: balance?.tokenBalances?.[0]?.amount || '0'
        });
      } else if (balance?.tokenBalances?.[0]) {
        // Update stored balance
        await storage.updateWalletBalance(req.params.id, balance.tokenBalances[0].amount);
      }

      // Return the Circle balance response directly
      res.json(balance);
    } catch (error) {
      console.error('Error getting wallet balance:', error);
      res.status(500).json({ error: 'Failed to get wallet balance' });
    }
  });

  app.post('/api/wallets/:id/request-tokens', async (req, res) => {
    try {
      const result = await circle.requestTestnetTokens(req.params.id);
      res.json(result);
    } catch (error) {
      console.error('Error requesting tokens:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to request tokens' });
    }
  });

  app.post('/api/transactions', async (req, res) => {
    try {
      // Validate request body
      const transactionSchema = z.object({
        fromWalletId: z.string(),
        toWalletId: z.string(),
        amount: z.string()
      });

      const data = transactionSchema.parse(req.body);

      // Get source wallet to determine the blockchain
      const sourceWallet = await storage.getWallet(data.fromWalletId);
      if (!sourceWallet) {
        throw new Error('Source wallet not found');
      }

      console.log('Creating transaction:', {
        walletId: data.fromWalletId,
        destinationAddress: data.toWalletId,
        amount: data.amount,
        blockchain: sourceWallet.blockchain
      });

      const tx = await circle.createTransaction({
        walletId: data.fromWalletId,
        tokenId: USDC_TOKEN_IDS[sourceWallet.blockchain as Blockchain],
        destinationAddress: data.toWalletId,
        amount: data.amount,
        blockchain: sourceWallet.blockchain as Blockchain
      });

      if (!tx) {
        throw new Error('Failed to create transaction');
      }

      const transaction = await storage.createTransaction({
        fromWalletId: data.fromWalletId,
        toWalletId: data.toWalletId,
        amount: data.amount,
        status: tx.status,
        txHash: tx.id
      });

      res.json(transaction);
    } catch (error) {
      console.error('Error creating transaction:', error);
      res.status(500).json({ error: 'Failed to create transaction' });
    }
  });

  app.post('/api/cctp/transfer', async (req, res) => {
    try {
      const tx = await circle.createCCTPTransfer({
        walletId: req.body.sourceWalletId,
        destinationAddress: req.body.destinationAddress,
        amount: req.body.amount,
        destinationChain: req.body.destinationChain
      });

      const transaction = await storage.createTransaction({
        fromWalletId: req.body.sourceWalletId,
        toWalletId: req.body.destinationAddress,
        amount: req.body.amount,
        status: 'PENDING',
        txHash: tx.burnTxHash // Use the burn transaction hash as the main transaction identifier
      });

      res.json(transaction);
    } catch (error) {
      console.error('Error creating CCTP transfer:', error);
      res.status(500).json({ error: 'Failed to create CCTP transfer' });
    }
  });

  app.get('/api/transactions/:id', async (req, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      res.json(transaction);
    } catch (error) {
      console.error('Error getting transaction:', error);
      res.status(500).json({ error: 'Failed to get transaction status' });
    }
  });

  app.get('/api/test/transaction/:txHash', async (req, res) => {
    try {
      const result = await circle.testTransactionReceipt(req.params.txHash);
      res.json(result);
    } catch (error) {
      console.error('Error testing transaction receipt:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get transaction receipt' });
    }
  });

  // Add a new endpoint to check attestation status
  app.get('/api/cctp/attestation/:messageHash', async (req, res) => {
    try {
      console.log('Checking attestation status for messageHash:', req.params.messageHash);

      const response = await fetch(
        `https://iris-api-sandbox.circle.com/v1/attestations/${req.params.messageHash}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return res.json({ status: 'pending', message: 'Attestation not ready yet' });
        }
        throw new Error(`Failed to fetch attestation: ${response.statusText}`);
      }

      const responseData = await response.json();
      if (!responseData.data) {
        return res.json({ status: 'pending', message: 'Waiting for attestation data' });
      }

      const attestationResponse = responseData.data;
      res.json({
        status: attestationResponse.status,
        attestation: attestationResponse.status === 'complete' ? attestationResponse.attestation : undefined,
        message: attestationResponse.status === 'complete'
          ? 'Attestation is ready'
          : 'Attestation is still being processed'
      });
    } catch (error) {
      console.error('Error checking attestation status:', error);
      res.status(500).json({
        error: 'Failed to check attestation status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return httpServer;
}