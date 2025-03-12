import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Copy, Droplets } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CHAIN_NAMES } from '@/lib/constants';
import { requestTestnetTokens, getWalletBalance } from '@/lib/circle';
import type { Blockchain, CircleWallet } from '@shared/types';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface WalletCardProps {
  blockchain: Blockchain;
  wallet?: CircleWallet;
  isLoading?: boolean;
  onCreateWallet?: () => void;
}

export function WalletCard({ blockchain, wallet, isLoading, onCreateWallet }: WalletCardProps) {
  const { toast } = useToast();
  const [isRequestingTokens, setIsRequestingTokens] = useState(false);
  const queryClient = useQueryClient();

  // Balance query
  const { data: balanceData, isLoading: isBalanceLoading, refetch: refetchBalance } = useQuery({
    queryKey: [`/api/wallets/${wallet?.id}/balance`],
    queryFn: async () => {
      if (!wallet?.id) return null;
      return getWalletBalance(wallet.id);
    },
    enabled: !!wallet?.id,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const copyAddress = () => {
    if (wallet?.address) {
      navigator.clipboard.writeText(wallet.address);
      toast({
        title: 'Address Copied',
        description: 'Wallet address copied to clipboard'
      });
    }
  };

  const refreshBalance = async () => {
    if (!wallet?.id) return;
    try {
      await refetchBalance();
      toast({
        title: 'Balance Updated',
        description: `${CHAIN_NAMES[blockchain]} balance refreshed`
      });
    } catch (error) {
      console.error('Error refreshing balance:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to refresh ${CHAIN_NAMES[blockchain]} balance`
      });
    }
  };

  const handleRequestTokens = async () => {
    if (!wallet?.id) return;
    setIsRequestingTokens(true);

    try {
      await requestTestnetTokens(wallet.id);
      toast({
        title: 'Success',
        description: 'Test tokens requested successfully'
      });
      await refreshBalance();
    } catch (error) {
      console.error('Error requesting tokens:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to request tokens'
      });
    } finally {
      setIsRequestingTokens(false);
    }
  };

  // Get current balance
  const currentBalance = balanceData?.balance || wallet?.balance || '0.00';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-semibold">{CHAIN_NAMES[blockchain]}</CardTitle>
        {wallet && (
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={copyAddress}
              title="Copy Address"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={refreshBalance}
              disabled={isBalanceLoading}
              title="Refresh Balance"
            >
              <RefreshCw className={`h-4 w-4 ${isBalanceLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleRequestTokens}
              disabled={isRequestingTokens}
              title="Request Test Tokens"
            >
              <Droplets className={`h-4 w-4 ${isRequestingTokens ? 'animate-bounce' : ''}`} />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        ) : wallet ? (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground font-mono break-all">
              {wallet.address}
            </div>
            <div className="text-2xl font-bold">
              {isBalanceLoading ? (
                <Skeleton className="h-8 w-32 inline-block" />
              ) : (
                `${currentBalance} USDC`
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-sm text-muted-foreground mb-4">No wallet created</div>
            {onCreateWallet && (
              <Button onClick={onCreateWallet} className="w-full">
                Create Wallet
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}