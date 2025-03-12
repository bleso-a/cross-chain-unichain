import { apiRequest } from './queryClient';
import type { Blockchain, CircleWallet, TransactionRequest, CCTPTransferRequest } from '@shared/types';

export async function createWallet(blockchain: Blockchain): Promise<CircleWallet> {
  const res = await apiRequest('POST', '/api/wallets', { blockchain });
  return res.json();
}

export async function getWalletBalance(walletId: string): Promise<CircleWallet> {
  const res = await apiRequest('GET', `/api/wallets/${walletId}/balance`);
  const data = await res.json();

  // Extract USDC balance from token balances
  let balance = '0.00';
  if (data.tokenBalances && data.tokenBalances.length > 0) {
    balance = data.tokenBalances[0].amount || '0.00';
  }

  return {
    ...data,
    balance
  };
}

export async function requestTestnetTokens(walletId: string) {
  const res = await apiRequest('POST', `/api/wallets/${walletId}/request-tokens`);
  return res.json();
}

interface CCTPTransferResponse {
  burnTxHash: string;
  messageHash?: string;
  attestation?: string;
  mintTxHash?: string;
  status: 'PENDING' | 'COMPLETED';
}

interface AttestationResponse {
  status: string;
  attestation?: string;
  message: string;
}

export async function sendCCTPTransfer(data: CCTPTransferRequest): Promise<CCTPTransferResponse> {
  const res = await apiRequest('POST', '/api/cctp/transfer', data);
  return res.json();
}

export async function checkAttestation(messageHash: string): Promise<AttestationResponse> {
  const res = await apiRequest('GET', `/api/cctp/attestation/${messageHash}`);
  return res.json();
}

export async function getTransactionStatus(txId: string) {
  const res = await apiRequest('GET', `/api/transactions/${txId}`);
  return res.json();
}

export type TransactionState = 'CANCELLED' | 'CONFIRMED' | 'COMPLETE' | 'DENIED' | 'FAILED' | 'INITIATED' | 'PENDING_RISK_SCREENING';

export async function pollTransactionStatus(
  txId: string,
  {
    maxRetries = 30,
    interval = 2000,
    acceptableStates = ['CONFIRMED', 'COMPLETE'] as TransactionState[]
  } = {}
): Promise<{ success: boolean; state?: TransactionState }> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const tx = await getTransactionStatus(txId);

      if (tx.state === 'FAILED' || tx.state === 'DENIED' || tx.state === 'CANCELLED') {
        return { success: false, state: tx.state };
      }

      if (acceptableStates.includes(tx.state)) {
        return { success: true, state: tx.state };
      }
    } catch (error) {
      console.error('Error polling transaction:', error);
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return { success: false };
}