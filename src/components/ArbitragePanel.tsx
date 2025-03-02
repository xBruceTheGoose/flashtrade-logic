
import { useState, useEffect } from 'react';
import GlassCard from './ui/GlassCard';
import { Badge } from '@radix-ui/react-toast';
import { ArbitrageOpportunity, DEX, Token } from '@/types';
import { availableDEXes } from '@/utils/dex';
import { commonTokens } from '@/utils/dex';
import { scanForArbitrageOpportunities, executeArbitrage } from '@/utils/arbitrage';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Zap } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

const ArbitragePanel = () => {
  const { wallet } = useWallet();
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);

  const activeDexes = availableDEXes.filter(dex => dex.active);

  const scanForOpportunities = async () => {
    if (!wallet?.connected) {
      toast({
        title: 'Wallet Required',
        description: 'Please connect your wallet to scan for arbitrage opportunities',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const newOpportunities = await scanForArbitrageOpportunities(
        activeDexes,
        commonTokens
      );
      
      setOpportunities(newOpportunities);
      
      if (newOpportunities.length === 0) {
        toast({
          title: 'No Opportunities Found',
          description: 'No profitable arbitrage opportunities were found at this time.',
        });
      } else {
        toast({
          title: 'Opportunities Found',
          description: `Found ${newOpportunities.length} potential arbitrage opportunities.`,
        });
      }
    } catch (error) {
      console.error('Error scanning for opportunities:', error);
      toast({
        title: 'Scan Failed',
        description: 'Failed to scan for arbitrage opportunities.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (opportunity: ArbitrageOpportunity) => {
    if (!wallet?.connected) return;
    
    setExecuting(opportunity.id);
    try {
      const result = await executeArbitrage(opportunity);
      
      if (result.success) {
        setOpportunities(prev => 
          prev.map(op => 
            op.id === opportunity.id 
              ? { ...op, status: 'completed' } 
              : op
          )
        );
        
        toast({
          title: 'Arbitrage Executed',
          description: `Transaction hash: ${result.txHash?.slice(0, 10)}...`,
        });
      } else {
        setOpportunities(prev => 
          prev.map(op => 
            op.id === opportunity.id 
              ? { ...op, status: 'failed' } 
              : op
          )
        );
        
        toast({
          title: 'Execution Failed',
          description: result.error || 'Unknown error occurred',
          variant: 'destructive',
        });
      }
    } catch (error) {
      setOpportunities(prev => 
        prev.map(op => 
          op.id === opportunity.id 
            ? { ...op, status: 'failed' } 
            : op
        )
      );
      
      toast({
        title: 'Execution Failed',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setExecuting(null);
    }
  };

  const getStatusBadge = (status: ArbitrageOpportunity['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'executing':
        return <Badge variant="outline" className="animate-pulse">Executing</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return null;
    }
  };

  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Arbitrage Opportunities</h2>
        <Button 
          onClick={scanForOpportunities} 
          disabled={loading || !wallet?.connected}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Scan
            </>
          )}
        </Button>
      </div>
      
      {opportunities.length > 0 ? (
        <div className="space-y-4 overflow-auto">
          {opportunities.map((opportunity) => (
            <div 
              key={opportunity.id} 
              className="p-4 rounded-md bg-background/50 border border-border/50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="font-medium">
                      {opportunity.tokenIn.symbol} → {opportunity.tokenOut.symbol}
                    </h3>
                    {getStatusBadge(opportunity.status)}
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      <span className="font-medium">From:</span> {opportunity.sourceDex.name}
                    </p>
                    <p>
                      <span className="font-medium">To:</span> {opportunity.targetDex.name}
                    </p>
                    <p>
                      <span className="font-medium">Expected Profit:</span>{' '}
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {opportunity.estimatedProfit} ({opportunity.profitPercentage.toFixed(2)}%)
                      </span>
                    </p>
                    <p>
                      <span className="font-medium">Gas Cost:</span> {opportunity.gasEstimate}
                    </p>
                  </div>
                </div>
                
                <Button
                  variant={opportunity.status === 'completed' ? 'secondary' : 'default'}
                  size="sm"
                  disabled={
                    executing !== null || 
                    !wallet?.connected || 
                    opportunity.status === 'executing' ||
                    opportunity.status === 'completed' ||
                    opportunity.status === 'failed'
                  }
                  onClick={() => handleExecute(opportunity)}
                >
                  {executing === opportunity.id ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Executing...
                    </>
                  ) : opportunity.status === 'completed' ? (
                    'Completed'
                  ) : (
                    <>
                      <Zap className="mr-2 h-3 w-3" />
                      Execute
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
          <Search className="h-12 w-12 mb-4 opacity-20" />
          <h3 className="text-lg font-medium mb-2">No Opportunities Found</h3>
          <p className="text-sm max-w-md">
            Scan for arbitrage opportunities across different DEXes to find profitable trades.
          </p>
        </div>
      )}
      
      {!wallet?.connected && (
        <div className="mt-4 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
          Connect your wallet to scan for arbitrage opportunities
        </div>
      )}
    </GlassCard>
  );
};

export default ArbitragePanel;
