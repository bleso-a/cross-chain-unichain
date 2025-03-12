export type Blockchain = 'ETH-SEPOLIA' | 'AVAX-FUJI' | 'MATIC-AMOY' | 'ARB-SEPOLIA' | 'UNI-SEPOLIA';

export type WalletBalance = {
  balance: string;
};

export type CircleWallet = {
  id: string;
  address: string;
  blockchain: Blockchain;
  balance?: string;
};

export type TransactionRequest = {
  fromWalletId: string;
  toWalletId: string;
  amount: string;
};

export type CCTPTransferRequest = {
  sourceWalletId: string;
  destinationAddress: string;
  amount: string;
  sourceChain: Blockchain;
  destinationChain: Blockchain;
};