import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { WalletSelector } from './WalletSelector';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Blockchain, CircleWallet } from '@shared/types';

interface TransactionFormProps {
  type: 'cctp' | 'regular';
  sourceChain: Blockchain;
  destinationChain?: Blockchain;
  onChainSelect: (chain: Blockchain) => void;
  onDestChainSelect?: (chain: Blockchain) => void;
  wallets?: CircleWallet[];
}

export function TransactionForm({
  type,
  sourceChain,
  destinationChain,
  onChainSelect,
  onDestChainSelect,
  wallets = [],
}: TransactionFormProps) {
  const { toast } = useToast();
  const [error, setError] = useState<string>();
  const [messageHash, setMessageHash] = useState<string>();

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      amount: '',
      destinationAddress: ''
    }
  });

  // Query for checking attestation status
  const attestationQuery = useQuery({
    queryKey: ['/api/cctp/attestation', messageHash],
    enabled: !!messageHash,
    refetchInterval: messageHash ? 5000 : false, // Poll every 5 seconds when we have a messageHash
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      setError(undefined);
      setMessageHash(undefined);

      if (type === 'cctp') {
        const res = await apiRequest('POST', '/api/cctp/transfer', {
          sourceWalletId: wallets.find(w => w.blockchain === sourceChain)?.id!,
          destinationAddress: data.destinationAddress,
          amount: data.amount,
          sourceChain,
          destinationChain: destinationChain!
        });
        return res.json();
      } else {
        const res = await apiRequest('POST', '/api/transactions', {
          fromWalletId: wallets.find(w => w.blockchain === sourceChain)?.id!,
          toWalletId: data.destinationAddress,
          amount: data.amount
        });
        return res.json();
      }
    },
    onSuccess: (response) => {
      if (type === 'cctp' && response.messageHash) {
        setMessageHash(response.messageHash);
        toast({
          title: 'CCTP Transfer Initiated',
          description: 'Transfer started. Waiting for attestation (this may take 30+ minutes).'
        });
      } else {
        toast({
          title: 'Success',
          description: 'Transaction submitted successfully'
        });
      }
    },
    onError: (err: Error) => {
      // Extract messageHash from error message if available
      const match = err.message.match(/messageHash: ([a-f0-9]+)/i);
      if (match) {
        setMessageHash(match[1]);
      }
      setError(err.message);
    }
  });

  // Update UI based on attestation status
  if (messageHash && attestationQuery.data?.status === 'complete') {
    toast({
      title: 'Attestation Ready',
      description: 'CCTP transfer can now be completed on the destination chain.'
    });
    setMessageHash(undefined); // Clear messageHash to stop polling
  }

  return (
    <form onSubmit={handleSubmit(data => mutation.mutate(data))} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WalletSelector
          label="Source Chain"
          value={sourceChain}
          onChange={onChainSelect}
          exclude={destinationChain ? [destinationChain] : []}
        />

        {type === 'cctp' && onDestChainSelect && (
          <WalletSelector
            label="Destination Chain"
            value={destinationChain!}
            onChange={onDestChainSelect}
            exclude={[sourceChain]}
          />
        )}
      </div>

      <Input
        {...register('amount', { required: true })}
        type="text"
        placeholder="Amount (USDC)"
      />

      <Input 
        {...register('destinationAddress', { required: true })}
        type="text"
        placeholder="Destination Address"
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {messageHash && (
        <Alert>
          <AlertDescription>
            Waiting for attestation... This process typically takes 30+ minutes.
            Status: {attestationQuery.data?.status || 'checking...'}
          </AlertDescription>
        </Alert>
      )}

      <Button 
        type="submit" 
        className="w-full"
        disabled={mutation.isPending || !!messageHash}
      >
        {mutation.isPending ? 'Sending...' : messageHash ? 'Waiting for Attestation...' : 'Send USDC'}
      </Button>
    </form>
  );
}