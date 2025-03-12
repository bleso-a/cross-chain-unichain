import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WalletSelector } from '@/components/WalletSelector';
import { TransactionForm } from '@/components/TransactionForm';
import { WalletCard } from '@/components/WalletCard';
import { type Blockchain, type CircleWallet } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { createWallet } from '@/lib/circle';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const [selectedChain, setSelectedChain] = useState<Blockchain>('UNI-SEPOLIA');
  const [selectedDestChain, setSelectedDestChain] = useState<Blockchain>('ETH-SEPOLIA');
  const { toast } = useToast();

  const { data: wallets = [], isLoading, refetch } = useQuery<CircleWallet[]>({
    queryKey: ['/api/wallets'],
  });

  const handleCreateWallet = async (blockchain: Blockchain) => {
    try {
      await createWallet(blockchain);
      await refetch();
      toast({
        title: 'Success',
        description: `Created wallet for ${blockchain}`
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create wallet'
      });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
        Circle Cross-Chain DeFi
      </h1>

      <div className="grid grid-cols-1 gap-8 mb-8">
        <WalletCard 
          blockchain={selectedChain}
          wallet={wallets.find(w => w.blockchain === selectedChain)}
          isLoading={isLoading}
          onCreateWallet={() => handleCreateWallet(selectedChain)}
        />
        {selectedDestChain && (
          <WalletCard
            blockchain={selectedDestChain} 
            wallet={wallets.find(w => w.blockchain === selectedDestChain)}
            isLoading={isLoading}
            onCreateWallet={() => handleCreateWallet(selectedDestChain)}
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transfer USDC</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="cctp">
            <TabsList className="mb-4">
              <TabsTrigger value="cctp">Cross-Chain Transfer</TabsTrigger>
              <TabsTrigger value="regular">Regular Transfer</TabsTrigger>
            </TabsList>

            <TabsContent value="cctp">
              <TransactionForm 
                type="cctp"
                sourceChain={selectedChain}
                destinationChain={selectedDestChain}
                onChainSelect={setSelectedChain}
                onDestChainSelect={setSelectedDestChain}
                wallets={wallets}
              />
            </TabsContent>

            <TabsContent value="regular">
              <TransactionForm
                type="regular"
                sourceChain={selectedChain}
                onChainSelect={setSelectedChain}
                wallets={wallets}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}