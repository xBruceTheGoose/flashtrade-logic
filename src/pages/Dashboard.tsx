
import { useEffect, useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import GlassCard from '@/components/ui/GlassCard';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { ArrowUpRight, Wallet, RefreshCw, Eye, Clock, BarChart3, Zap, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import WalletPanel from '@/components/dashboard/WalletPanel';
import ArbitrageOpportunitiesPanel from '@/components/dashboard/ArbitrageOpportunitiesPanel';
import TradingHistoryPanel from '@/components/dashboard/TradingHistoryPanel';
import TradeConfigPanel from '@/components/dashboard/TradeConfigPanel';
import PerformancePanel from '@/components/dashboard/PerformancePanel';
import { useMediaQuery } from '@/hooks/use-media-query';
import DEXPanel from '@/components/DEXPanel';
import { TradeExecutionRecord } from '@/utils/arbitrage/types';
import { tradeExecutionStorage } from '@/utils/arbitrage/storage';
import { Badge } from '@/components/ui/badge';
import TradeConfigurationPanel from '@/components/trades/TradeConfigurationPanel';

const Dashboard = () => {
  const { wallet, refreshBalance } = useWallet();
  const [refreshing, setRefreshing] = useState(false);
  const [tradeHistory, setTradeHistory] = useState<TradeExecutionRecord[]>([]);
  const [activeOpportunities, setActiveOpportunities] = useState(0);
  const isMobile = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    // Load trade history on component mount
    const history = tradeExecutionStorage.getRecords();
    setTradeHistory(history);

    // Set up event listener for new trades
    const handleNewTrade = () => {
      setTradeHistory(tradeExecutionStorage.getRecords());
      // Show notification for new trades
      toast({
        title: "Trade Executed",
        description: "A new trade has been completed",
      });
    };

    // Subscribe to trade updates
    window.addEventListener('trade-executed', handleNewTrade);

    return () => {
      window.removeEventListener('trade-executed', handleNewTrade);
    };
  }, []);

  const handleRefreshWallet = async () => {
    if (!wallet?.connected) return;
    
    setRefreshing(true);
    await refreshBalance();
    setRefreshing(false);
    
    toast({
      title: "Wallet Refreshed",
      description: "Your wallet balance has been updated",
    });
  };

  const updateActiveOpportunities = (count: number) => {
    setActiveOpportunities(count);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Trading Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor opportunities, execute trades, and track performance
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {wallet?.connected ? (
            <>
              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Wallet Connected
              </Badge>
              <Button size="sm" variant="outline" onClick={handleRefreshWallet} disabled={refreshing}>
                {refreshing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="sr-only md:not-sr-only md:ml-2">Refresh</span>
              </Button>
            </>
          ) : (
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
              Wallet Not Connected
            </Badge>
          )}
          
          {activeOpportunities > 0 && (
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              {activeOpportunities} Active Opportunities
            </Badge>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <WalletPanel className="lg:col-span-1" />
        <ArbitrageOpportunitiesPanel 
          className="lg:col-span-2" 
          onOpportunitiesUpdate={updateActiveOpportunities}
        />
      </div>
      
      <Tabs defaultValue="advanced-config" className="w-full">
        <TabsList className="w-full grid grid-cols-4 mb-4">
          <TabsTrigger value="advanced-config">
            <Settings className="h-4 w-4 mr-2" />
            <span>Advanced Configuration</span>
          </TabsTrigger>
          <TabsTrigger value="basic-config">
            <Eye className="h-4 w-4 mr-2" />
            <span>Basic Configuration</span>
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="h-4 w-4 mr-2" />
            <span>Trading History</span>
          </TabsTrigger>
          <TabsTrigger value="performance">
            <BarChart3 className="h-4 w-4 mr-2" />
            <span>Performance</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="advanced-config">
          <TradeConfigurationPanel />
        </TabsContent>
        
        <TabsContent value="basic-config">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TradeConfigPanel />
            <DEXPanel />
          </div>
        </TabsContent>
        
        <TabsContent value="history">
          <TradingHistoryPanel trades={tradeHistory} />
        </TabsContent>
        
        <TabsContent value="performance">
          <PerformancePanel trades={tradeHistory} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
