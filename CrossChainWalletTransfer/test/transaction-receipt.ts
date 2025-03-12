import { createPublicClient, http } from 'viem';

// Create a public client with the Unichain Sepolia RPC
const client = createPublicClient({
  transport: http('https://unichain-sepolia-rpc.publicnode.com')
});

// Example transaction hash - replace with a real one
const txHash = process.argv[2] || '0x4ca7ee652d57678f26e887c149ab0735f41de37bcad58c9f6d3ed5824f15b74d';

async function fetchReceipt() {
  try {
    console.log('Fetching receipt for transaction:', txHash);
    const receipt = await client.getTransactionReceipt({ 
      hash: txHash as `0x${string}` 
    });

    console.log('Transaction Receipt:', {
      blockNumber: receipt.blockNumber,
      status: receipt.status,
      from: receipt.from,
      to: receipt.to,
      logs: receipt.logs.length
    });

    return receipt;
  } catch (error) {
    console.error('Error fetching receipt:', error);
    throw error;
  }
}

fetchReceipt().catch(console.error);