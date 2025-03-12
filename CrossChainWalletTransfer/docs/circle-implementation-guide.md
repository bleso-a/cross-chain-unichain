# Circle Programmable Wallets and CCTP Implementation Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Programmable Wallets](#programmable-wallets)
3. [Cross-Chain Transfer Protocol (CCTP)](#cctp)
4. [API Integration](#api-integration)
5. [Best Practices](#best-practices)

## Introduction

This guide covers the implementation details of Circle's Programmable Wallets and Cross-Chain Transfer Protocol (CCTP) in a DeFi application.

## Programmable Wallets

### Overview
Circle's Programmable Wallets are developer-controlled smart contract wallets that enable secure management of digital assets across multiple blockchains.

### Key Components

#### 1. Wallet Creation
```typescript
const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.ENTITY_SECRET
});

// Create a wallet set
const walletSet = await client.createWalletSet({
  name: `${blockchain} Wallet Set`
});

// Create wallets in the set
const walletsResponse = await client.createWallets({
  blockchains: [blockchain],
  accountType: 'SCA',
  count: 1,
  walletSetId: walletSet.data.walletSet.id
});
```

#### 2. Balance Management
```typescript
// Get wallet balance
const balance = await client.getWalletTokenBalance({
  id: walletId
});

// Request testnet tokens
const tokens = await client.requestTestnetTokens({
  walletId
});
```

#### 3. Transaction Handling
```typescript
// Create a transaction
const tx = await client.createTransaction({
  walletId,
  tokenId,
  destinationAddress,
  amounts: [amount],
  fee: {
    type: 'level',
    config: {
      feeLevel: 'MEDIUM'
    }
  }
});
```

## CCTP (Cross-Chain Transfer Protocol)

### Overview
CCTP enables secure USDC transfers between supported blockchains using a burn-and-mint mechanism with attestation.

### Implementation Steps

#### 1. Approve USDC Transfer
```typescript
const approvalTransaction = await createContractExecutionTransaction(
  USDC_CONTRACT_ADDRESSES[sourceChain],
  'approve(address,uint256)',
  [TOKEN_MESSENGER_ADDRESSES[sourceChain], amount],
  walletId
);
```

#### 2. Burn USDC on Source Chain
```typescript
const burnTransaction = await createContractExecutionTransaction(
  TOKEN_MESSENGER_ADDRESSES[sourceChain],
  'depositForBurn(uint256,uint32,bytes32,address)',
  [
    amount,
    0, // Chain domain ID
    destinationAddressBytes32,
    USDC_CONTRACT_ADDRESSES[sourceChain]
  ],
  walletId
);
```

#### 3. Get Message Details
```typescript
async function getMessageDetails(txHash: string) {
  const transactionReceipt = await provider.getTransactionReceipt(txHash);
  const eventTopic = keccak256(toHex('MessageSent(bytes)'));
  const log = transactionReceipt.logs.find(l => l.topics[0] === eventTopic);
  
  const [messageBytes] = decodeAbiParameters([{ type: 'bytes' }], log.data);
  const messageHash = keccak256(messageBytes);
  
  return { messageBytes, messageHash };
}
```

#### 4. Wait for Attestation
```typescript
async function waitForAttestation(messageHash: string) {
  const response = await fetch(
    `https://iris-api-sandbox.circle.com/v1/attestations/${messageHash}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`
      }
    }
  );
  
  const data = await response.json();
  return data.attestation;
}
```

#### 5. Complete Transfer on Destination Chain
```typescript
const completionTransaction = await createContractExecutionTransaction(
  MESSAGE_TRANSMITTER_ADDRESSES[destinationChain],
  'receiveMessage(bytes,bytes)',
  [messageBytes, attestation],
  destinationWalletId
);
```

## API Integration

### Important Contracts
```typescript
const USDC_CONTRACT_ADDRESSES: Record<Blockchain, string> = {
  'ETH-SEPOLIA': '0x...',
  'MATIC-AMOY': '0x...',
  'AVAX-FUJI': '0x...',
  'ARB-SEPOLIA': '0x...',
  'UNI-SEPOLIA': '0x...'
};

const MESSAGE_TRANSMITTER_ADDRESSES: Record<Blockchain, string> = {
  'ETH-SEPOLIA': '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
  'MATIC-AMOY': '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
  'AVAX-FUJI': '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
  'ARB-SEPOLIA': '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
  'UNI-SEPOLIA': '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD'
};
```

### Required Environment Variables
```
CIRCLE_API_KEY=<your-api-key>
ENTITY_SECRET=<your-entity-secret>
```

## Best Practices

1. **Error Handling**
   - Implement robust error handling for API calls
   - Handle transaction failures gracefully
   - Provide clear user feedback

2. **Transaction Monitoring**
   - Poll transaction status until confirmed
   - Implement retry mechanisms for failed transactions
   - Cache transaction details for recovery

3. **Security**
   - Never expose API keys or entity secrets
   - Validate all user inputs
   - Use appropriate fee levels for transactions

4. **User Experience**
   - Show clear loading states during transactions
   - Display meaningful error messages
   - Provide transaction status updates

5. **Rate Limiting**
   - Implement appropriate delays between API calls
   - Handle API rate limits gracefully
   - Cache responses when appropriate

## Common Issues and Solutions

1. **Attestation Delays**
   - CCTP attestations can take 30+ minutes
   - Implement proper polling with reasonable intervals
   - Provide clear user feedback during waiting period

2. **Transaction Failures**
   - Check gas fees and wallet balances
   - Verify contract approvals
   - Ensure correct contract addresses for network

3. **Balance Updates**
   - Implement regular balance polling
   - Update UI after successful transactions
   - Handle network-specific token decimals

## Frontend Implementation

### Wallet Display
```tsx
<WalletCard 
  blockchain={blockchain}
  wallet={wallet}
  isLoading={isLoading}
  onCreateWallet={handleCreateWallet}
/>
```

### Transaction Form
```tsx
<TransactionForm
  type="cctp"
  sourceChain={sourceChain}
  destinationChain={destinationChain}
  onChainSelect={setSelectedChain}
  onDestChainSelect={setSelectedDestChain}
  wallets={wallets}
/>
```

This documentation provides a comprehensive overview of Circle's Programmable Wallets and CCTP implementation, including code examples, best practices, and common issues to watch out for when building DeFi applications.
