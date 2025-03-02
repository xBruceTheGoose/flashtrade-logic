
import { useState, useEffect } from 'react';
import GlassCard from './ui/GlassCard';
import { Badge } from "@/components/ui/badge";
import { Transaction } from '@/types';
import { getTransactionHistory } from '@/utils/transactions';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCcw, ExternalLink, Filter } from 'lucide-react';
import { format } from 'date-fns';

const TransactionMonitor = () => {
  const { wallet } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (wallet?.connected) {
      loadTransactions();
    }
  }, [wallet?.connected]);

  const loadTransactions = async () => {
    if (!wallet?.connected) return;
    
    setLoading(true);
    try {
      const history = await getTransactionHistory();
      setTransactions(history);
    } catch (error) {
      console.error('Error loading transaction history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: Transaction['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 animate-pulse">Pending</Badge>;
      case 'confirmed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Confirmed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: Transaction['type']) => {
    switch (type) {
      case 'swap':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Swap</Badge>;
      case 'approval':
        return <Badge variant="default">Approval</Badge>;
      case 'flashloan':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Flash Loan</Badge>;
      case 'arbitrage':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Arbitrage</Badge>;
      default:
        return null;
    }
  };

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), 'MMM dd, HH:mm');
  };

  const openEtherscan = (hash: string) => {
    window.open(`https://etherscan.io/tx/${hash}`, '_blank');
  };

  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Transaction History</h2>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={loadTransactions}
            disabled={loading || !wallet?.connected}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
          </Button>
          <Button variant="outline" size="icon" disabled={!wallet?.connected}>
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {wallet?.connected ? (
        transactions.length > 0 ? (
          <div className="space-y-3 overflow-auto">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="p-3 rounded-md bg-background/50 border border-border/50 flex flex-col"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    {getTypeBadge(tx.type)}
                    {getStatusBadge(tx.status)}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => openEtherscan(tx.hash)}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
                
                <div className="text-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-muted-foreground">
                      {formatDate(tx.timestamp)}
                    </span>
                    <span className="font-medium">
                      {tx.value}
                    </span>
                  </div>
                  
                  <div className="text-xs text-muted-foreground truncate">
                    {tx.hash.substring(0, 18)}...
                  </div>
                  
                  {tx.type === 'arbitrage' && tx.details && (
                    <div className="mt-2 text-xs bg-muted/50 p-1.5 rounded">
                      <div>
                        <span className="font-medium">Source:</span> {tx.details.sourceDex}
                      </div>
                      <div>
                        <span className="font-medium">Target:</span> {tx.details.targetDex}
                      </div>
                      <div>
                        <span className="font-medium">Profit:</span>{' '}
                        <span className="text-green-600 dark:text-green-400">
                          {tx.details.profit}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <RefreshCcw className="h-12 w-12 mb-4 opacity-20" />
            <h3 className="text-lg font-medium mb-2">No Transactions Found</h3>
            <p className="text-sm max-w-md">
              Your transaction history will appear here once you start trading.
            </p>
          </div>
        )
      ) : (
        <div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
          <h3 className="text-lg font-medium mb-2">Wallet Not Connected</h3>
          <p className="text-sm max-w-md">
            Connect your wallet to view your transaction history.
          </p>
        </div>
      )}
    </GlassCard>
  );
};

export default TransactionMonitor;
