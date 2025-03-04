
import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';
import GlassCard from '@/components/ui/GlassCard';
import { Wallet, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import WalletConnect from '@/components/WalletConnect';
import { cn } from '@/lib/utils';

interface WalletPanelProps {
  className?: string;
}

const WalletPanel = ({ className }: WalletPanelProps) => {
  const { wallet, networkName, isCorrectNetwork } = useWallet();
  const [explorerLink, setExplorerLink] = useState<string | null>(null);
  
  useEffect(() => {
    if (wallet?.address) {
      // This is a simplified version that only handles Ethereum mainnet
      // In a real implementation, you would use the current network's explorer URL
      setExplorerLink(`https://etherscan.io/address/${wallet.address}`);
    } else {
      setExplorerLink(null);
    }
  }, [wallet?.address]);

  return (
    <GlassCard className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Wallet className="h-5 w-5 mr-2" />
          Wallet
        </h2>
      </div>
      
      {wallet?.connected ? (
        <div className="space-y-4 flex-grow">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Address</span>
              {explorerLink && (
                <a 
                  href={explorerLink} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs flex items-center text-blue-500 hover:text-blue-600 transition-colors"
                >
                  View on Explorer
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              )}
            </div>
            <div className="text-sm font-mono bg-muted/50 p-2 rounded-md truncate">
              {wallet.address}
            </div>
          </div>
          
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Balance</span>
            <div className="text-2xl font-bold">{wallet.balance}</div>
          </div>
          
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Network</span>
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-2 w-2 rounded-full", 
                isCorrectNetwork 
                  ? "bg-green-500" 
                  : "bg-yellow-500"
              )} />
              <span className="font-medium">{networkName}</span>
              
              {!isCorrectNetwork && (
                <div className="flex items-center text-yellow-600 dark:text-yellow-400 text-xs bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Unsupported Network
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-2 mt-auto pt-4">
            <span className="text-sm text-muted-foreground">Wallet Type</span>
            <div className="font-medium capitalize">{wallet.type}</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 gap-4 flex-grow">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">Connect your wallet to start trading</p>
          </div>
          <WalletConnect />
        </div>
      )}
    </GlassCard>
  );
};

export default WalletPanel;
