import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';
import GlassCard from '@/components/ui/GlassCard';
import { Radar, Zap, Loader2, TrendingUp, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { ArbitrageOpportunity } from '@/types';
import { cn } from '@/lib/utils';
import { tradeExecutor } from '@/utils/arbitrage/tradeExecutor';
import { scanForArbitrageOpportunities } from '@/utils/arbitrage';
import { availableDEXes, commonTokens } from '@/utils/dex';

interface ArbitrageOpportunitiesPanelProps {
  className?: string;
  onOpportunitiesUpdate?: (count: number) => void;
}

const ArbitrageOpportunitiesPanel = ({ 
  className,
  onOpportunitiesUpdate 
}: ArbitrageOpportunitiesPanelProps) => {
  const { wallet } = useWallet();
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  
  // Filter active DEXes
  const activeDexes = availableDEXes.filter(dex => dex.active);

  useEffect(() => {
    // Update parent component with active opportunities count
    if (onOpportunitiesUpdate) {
      const activeCount = opportunities.filter(
        op => op.status === 'pending' || op.status === 'executing'
      ).length;
      onOpportunitiesUpdate(activeCount);
    }
  }, [opportunities, onOpportunitiesUpdate]);

  const handleScan = async () => {
    if (!wallet?.connected || scanning) return;
    
    setScanning(true);
    try {
      const newOpportunities = await scanForArbitrageOpportunities(
        activeDexes,
        commonTokens
      );
      
      setOpportunities(prev => {
        // Keep existing opportunities that are not in the new batch
        const existingIds = new Set(newOpportunities.map(op => op.id));
        const filteredPrev = prev.filter(op => 
          !existingIds.has(op.id) && 
          (op.status === 'completed' || op.status === 'executing' || op.status === 'failed')
        );
        
        return [...filteredPrev, ...newOpportunities];
      });
      
      if (newOpportunities.length === 0) {
        toast({
          title: 'No New Opportunities',
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
      setScanning(false);
    }
  };

  const executeOpportunity = async (opportunity: ArbitrageOpportunity) => {
    if (!wallet?.connected || executingId) return;
    
    setExecutingId(opportunity.id);
    setOpportunities(prev => 
      prev.map(op => 
        op.id === opportunity.id 
          ? { ...op, status: 'executing' } 
          : op
      )
    );
    
    try {
      // Use the trade executor to execute the opportunity
      const result = await tradeExecutor.executeTrade(opportunity);
      
      if (result.success) {
        setOpportunities(prev => 
          prev.map(op => 
            op.id === opportunity.id 
              ? { ...op, status: 'completed' } 
              : op
          )
        );
        
        toast({
          title: 'Trade Executed',
          description: `Successfully executed trade with ${opportunity.profitPercentage.toFixed(2)}% profit`,
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
      console.error('Error executing opportunity:', error);
      
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
      setExecutingId(null);
    }
  };

  const getStatusIcon = (status: ArbitrageOpportunity['status']) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'executing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: ArbitrageOpportunity['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Ready</Badge>;
      case 'executing':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse">Executing</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Completed</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Failed</Badge>;
      default:
        return null;
    }
  };

  return (
    <GlassCard className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Radar className="h-5 w-5 mr-2" />
          Arbitrage Opportunities
        </h2>
        <Button 
          onClick={handleScan} 
          disabled={scanning || !wallet?.connected}
          size="sm"
        >
          {scanning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <TrendingUp className="mr-2 h-4 w-4" />
              Scan Now
            </>
          )}
        </Button>
      </div>
      
      {opportunities.length > 0 ? (
        <div className="space-y-3 overflow-y-auto flex-grow pr-1">
          {opportunities
            .sort((a, b) => {
              // Sort by status (pending first, then executing, completed, failed)
              const statusPriority = { 'pending': 0, 'executing': 1, 'completed': 2, 'failed': 3 };
              const statusA = statusPriority[a.status];
              const statusB = statusPriority[b.status];
              if (statusA !== statusB) return statusA - statusB;
              
              // Then sort by profit percentage (highest first)
              return b.profitPercentage - a.profitPercentage;
            })
            .map((opportunity) => (
              <div 
                key={opportunity.id} 
                className="p-3 rounded-md bg-background/50 border border-border/50 hover:bg-background/80 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">
                        {opportunity.tokenIn.symbol} → {opportunity.tokenOut.symbol}
                      </h3>
                      {getStatusBadge(opportunity.status)}
                    </div>
                    
                    <div className="flex items-center text-xs text-muted-foreground gap-4">
                      <div>{opportunity.sourceDex.name} → {opportunity.targetDex.name}</div>
                      <div className="flex items-center gap-1">
                        <div>Profit:</div>
                        <div className="text-green-600 dark:text-green-400 font-medium">
                          {opportunity.profitPercentage.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      <span>Amount: {opportunity.tradeSize || 'Auto'}</span>
                      <span className="mx-2">•</span>
                      <span>Gas: {opportunity.gasEstimate}</span>
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    variant={opportunity.status === 'pending' ? 'default' : 'outline'}
                    className="h-8"
                    disabled={
                      opportunity.status !== 'pending' || 
                      !!executingId ||
                      !wallet?.connected
                    }
                    onClick={() => executeOpportunity(opportunity)}
                  >
                    {opportunity.status === 'executing' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : opportunity.status === 'pending' ? (
                      <>
                        <Zap className="h-3.5 w-3.5 mr-1" />
                        Execute
                      </>
                    ) : (
                      getStatusIcon(opportunity.status)
                    )}
                  </Button>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="flex-grow flex flex-col items-center justify-center py-6 text-center">
          <Radar className="h-12 w-12 mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-medium">No Opportunities Found</h3>
          <p className="text-muted-foreground text-sm max-w-md mt-1">
            Scan for arbitrage opportunities across different DEXes to find profitable trades.
          </p>
          
          {!wallet?.connected && (
            <div className="mt-4 text-sm text-yellow-600 dark:text-yellow-400">
              Connect your wallet to start scanning
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
};

export default ArbitrageOpportunitiesPanel;
