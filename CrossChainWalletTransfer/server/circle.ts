import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import type { Blockchain } from '@shared/types';
import {
  USDC_CONTRACT_ADDRESSES,
  TOKEN_MESSENGER_ADDRESSES
} from '@/lib/constants';
import {
  createPublicClient,
  http,
  keccak256,
  toHex,
  decodeAbiParameters
} from 'viem';

// Add Message Transmitter contract addresses mapping
const MESSAGE_TRANSMITTER_ADDRESSES: Record<Blockchain, string> = {
  'ETH-SEPOLIA': '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
  'MATIC-AMOY': '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
  'AVAX-FUJI': '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
  'ARB-SEPOLIA': '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
  'UNI-SEPOLIA': '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD'
};

// Create a public client with the Unichain Sepolia RPC
const unichainSepoliaClient = createPublicClient({
  transport: http('https://unichain-sepolia-rpc.publicnode.com')
});

interface CircleAPIResponse<T> {
  data: T;
}

interface AttestationResponse {
  status: string;
  attestation?: string;
}

if (!process.env.CIRCLE_API_KEY || !process.env.ENTITY_SECRET) {
  throw new Error('Missing required environment variables: CIRCLE_API_KEY, ENTITY_SECRET');
}

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.ENTITY_SECRET
});

/**
 * Converts an amount in USDC to the smallest unit (6 decimals)
 */
function convertToUSDCSmallestUnit(amount: string): bigint {
  try {
    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat)) {
      throw new Error('Invalid amount format');
    }
    const amountInSmallestUnit = Math.round(amountFloat * 1_000_000);
    return BigInt(amountInSmallestUnit);
  } catch (error) {
    throw new Error(`Failed to convert amount ${amount} to USDC smallest unit: ${error}`);
  }
}

/**
 * Creates a contract execution transaction
 */
const createContractExecutionTransaction = async (
  contractAddress: string,
  abiFunctionSignature: string,
  abiParameters: any[],
  walletId: string,
) => {
  console.log('Creating contract execution transaction...');
  const response = await client.createContractExecutionTransaction({
    contractAddress,
    abiFunctionSignature,
    abiParameters,
    fee: {
      type: 'level',
      config: {
        feeLevel: 'HIGH',
      },
    },
    walletId,
  });

  if (!response.data) {
    throw new Error('Failed to create contract execution transaction');
  }

  console.log(`Contract execution transaction created with ID: ${response.data.id}`);
  return response.data;
};

/**
 * Waits for transaction confirmation
 */
async function waitForTransactionConfirmation(transactionId: string) {
  let response;
  let status;

  do {
    response = await client.getTransaction({ id: transactionId });
    status = response.data?.transaction?.state;

    if (status === 'FAILED') {
      throw new Error(`Transaction ${transactionId} failed`);
    }

    if (status !== 'CONFIRMED') {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } while (status !== 'CONFIRMED');

  if (!response.data?.transaction) {
    throw new Error('No transaction data in response');
  }

  return response.data.transaction;
}

function replacer(_key: string, value: any) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

/**
 * Gets message bytes and hash from transaction receipt
 */
async function getMessageDetails(txHash: string): Promise<{ messageBytes: string; messageHash: string }> {
  try {
    console.log('Getting transaction receipt for hash:', txHash);

    // Get the transaction receipt using Viem
    const transactionReceipt = await unichainSepoliaClient.getTransactionReceipt({
      hash: txHash as `0x${string}`
    });

    console.log('Transaction receipt:', JSON.stringify(transactionReceipt, replacer, 2));

    // Find MessageSent event
    const eventTopic = keccak256(toHex('MessageSent(bytes)'));
    console.log('Looking for MessageSent event with topic:', eventTopic);

    const log = transactionReceipt.logs.find(l => l.topics[0] === eventTopic);
    if (!log) {
      throw new Error('MessageSent event not found in transaction logs');
    }

    // Get message bytes and hash
    const [messageBytes] = decodeAbiParameters([{ type: 'bytes' }], log.data);
    const messageHash = keccak256(messageBytes);

    console.log('Successfully extracted message details:', {
      messageBytes: messageBytes.substring(0, 66) + '...',
      messageHash
    });

    return { messageBytes, messageHash };
  } catch (error) {
    console.error('Error getting transaction receipt:', error);
    throw error;
  }
}

/**
 * Waits for attestation from Circle's API
 */
async function waitForAttestation(messageHash: string): Promise<string> {
  const retryDelay = 2000; // 2 seconds
  let retries = 0;
  const startTime = Date.now();

  while (true) {
    try {
      const elapsedMinutes = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
      console.log(`Fetching attestation attempt ${retries + 1} (${elapsedMinutes} minutes elapsed)`);

      const response = await fetch(
        `https://iris-api-sandbox.circle.com/v1/attestations/${messageHash}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`Attestation not ready yet after ${elapsedMinutes} minutes, retrying...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retries++;
          continue;
        }
        throw new Error(`Failed to fetch attestation: ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('Attestation API Response:', responseData);

      // If we have a direct response (no data wrapper)
      const attestationResponse = responseData.data || responseData;

      if (attestationResponse.attestation && attestationResponse.attestation !== 'PENDING') {
        const totalMinutes = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        console.log(`Attestation received successfully after ${totalMinutes} minutes`);
        return attestationResponse.attestation;
      }

      console.log(`Attestation status: ${attestationResponse.status} after ${elapsedMinutes} minutes, waiting...`);

      // If it's taking too long, inform about the expected delay
      if (parseInt(elapsedMinutes) >= 30) {
        console.log('Note: Attestation process can take up to several hours. The process will continue running.');
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retries++;
    } catch (error) {
      console.error('Error fetching attestation:', error);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retries++;
    }
  }
}

export async function createCCTPTransfer(params: {
  walletId: string;
  destinationAddress: string;
  amount: string;
  destinationChain: Blockchain;
}) {
  try {
    // Get source chain from wallet
    const wallets = await listWallets();
    const sourceWallet = wallets.find(w => w.id === params.walletId);
    if (!sourceWallet) {
      throw new Error('Source wallet not found');
    }

    // Get or create destination chain wallet
    let destinationWallet = wallets.find(w => w.blockchain === params.destinationChain);
    if (!destinationWallet) {
      console.log('Creating wallet for destination chain...');
      destinationWallet = await createProgrammableWallet(params.destinationChain);
      if (!destinationWallet) {
        throw new Error('Failed to create destination chain wallet');
      }
    }

    const sourceChain = sourceWallet.blockchain as Blockchain;
    const usdcAmount = convertToUSDCSmallestUnit(params.amount);

    console.log('Processing transfer:', {
      amount: params.amount,
      usdcAmount: usdcAmount.toString(),
      sourceChain,
      destinationChain: params.destinationChain,
      destinationWallet: destinationWallet.id
    });

    // Step 1: Approve USDC transfer
    console.log('Approving USDC transfer...');
    const approvalTransaction = await createContractExecutionTransaction(
      USDC_CONTRACT_ADDRESSES[sourceChain],
      'approve(address,uint256)',
      [
        TOKEN_MESSENGER_ADDRESSES[sourceChain],
        usdcAmount.toString()
      ],
      params.walletId
    );

    console.log('Waiting for approval confirmation...');
    await waitForTransactionConfirmation(approvalTransaction.id);
    console.log('USDC approval confirmed');

    // Step 2: Burn USDC on source chain
    console.log('Creating burn transaction...');
    const destinationAddressBytes32 = '0x' + params.destinationAddress.toLowerCase().replace('0x', '').padStart(64, '0');

    const burnTransaction = await createContractExecutionTransaction(
      TOKEN_MESSENGER_ADDRESSES[sourceChain],
      'depositForBurn(uint256,uint32,bytes32,address)',
      [
        usdcAmount.toString(),
        0, // Chain domain ID - needs configuration from circle
        destinationAddressBytes32,
        USDC_CONTRACT_ADDRESSES[sourceChain]
      ],
      params.walletId
    );

    // Wait for burn transaction confirmation
    console.log('Waiting for burn transaction confirmation...');
    const burnConfirmed = await waitForTransactionConfirmation(burnTransaction.id);
    if (!burnConfirmed?.txHash) {
      throw new Error('No transaction hash in burn transaction response');
    }
    console.log('Burn transaction confirmed, txHash:', burnConfirmed.txHash);

    // Step 3: Get message details
    const { messageBytes, messageHash } = await getMessageDetails(burnConfirmed.txHash);
    console.log('Message hash generated:', messageHash);

    // Step 4: Get attestation
    console.log('Starting attestation process. This may take several hours...');
    console.log('MessageHash for tracking:', messageHash);

    console.log('Waiting for attestation...');
    const attestation = await waitForAttestation(messageHash);
    console.log('Attestation received:', attestation.substring(0, 66) + '...');

    // Step 5: Complete CCTP transfer on destination chain
    console.log('Creating completion transaction on destination chain...');
    const completionTransaction = await createContractExecutionTransaction(
      MESSAGE_TRANSMITTER_ADDRESSES[params.destinationChain], // Use destination chain's Message Transmitter
      'receiveMessage(bytes,bytes)',
      [messageBytes, attestation],
      destinationWallet.id // Use destination chain's wallet
    );

    // Wait for mint transaction confirmation
    console.log('Waiting for mint transaction confirmation...');
    try {
      const mintConfirmed = await waitForTransactionConfirmation(completionTransaction.id);
      if (!mintConfirmed?.txHash) {
        throw new Error('No transaction hash in mint transaction response');
      }
      console.log('Mint transaction confirmed, txHash:', mintConfirmed.txHash);

      return {
        burnTxHash: burnConfirmed.txHash,
        messageHash,
        attestation,
        mintTxHash: mintConfirmed.txHash,
        status: 'COMPLETED'
      };
    } catch (error) {
      console.error('Error in mint transaction confirmation:', error);
      throw new Error(`Failed to complete CCTP transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

  } catch (error) {
    console.error('Error in CCTP transfer:', error);

    // If the error occurred during attestation, provide the messageHash for later checking
    if (error instanceof Error && error.message.includes('attestation')) {
      throw new Error(`CCTP transfer incomplete. You can check the attestation status later with messageHash: ${messageHash}. Error: ${error.message}`);
    }

    throw error;
  }
}

export async function listWallets() {
  const response = await client.listWallets({});
  return response.data?.wallets || [];
}

export async function createProgrammableWallet(blockchain: Blockchain) {
  const walletSet = await client.createWalletSet({
    name: `${blockchain} Wallet Set`
  });

  if (!walletSet.data?.walletSet?.id) {
    throw new Error('Failed to create wallet set');
  }

  const walletsResponse = await client.createWallets({
    blockchains: [blockchain],
    accountType: 'SCA',
    count: 1,
    walletSetId: walletSet.data.walletSet.id
  });

  if (!walletsResponse.data?.wallets?.[0]) {
    throw new Error('Failed to create wallet');
  }

  return walletsResponse.data.wallets[0];
}

export async function getWalletBalance(walletId: string) {
  const response = await client.getWalletTokenBalance({
    id: walletId
  });
  return response.data;
}

export async function requestTestnetTokens(walletId: string) {
  const response = await client.requestTestnetTokens({
    walletId
  });
  return response.data;
}

export async function createTransaction(params: {
  walletId: string;
  tokenId: string;
  destinationAddress: string;
  amount: string;
  blockchain: Blockchain;
}) {
  try {
    console.log('Creating transaction with params:', params);

    const response = await client.createTransaction({
      walletId: params.walletId,
      tokenId: params.tokenId,
      destinationAddress: params.destinationAddress,
      amounts: [params.amount], // Convert amount to array format
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM'
        }
      }
    });

    if (!response.data) {
      throw new Error('No transaction data in response');
    }

    console.log('Transaction created:', response.data);

    return {
      id: response.data.id,
      status: response.data.state || 'PENDING',
      amount: params.amount,
      destinationAddress: params.destinationAddress,
      tokenId: params.tokenId,
      walletId: params.walletId
    };
  } catch (error) {
    console.error('Error creating transaction:', error);
    throw error;
  }
}