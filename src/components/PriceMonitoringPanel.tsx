
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import GlassCard from './ui/GlassCard';
import { Badge } from "@/components/ui/badge";
import { Token, DEX } from '@/types';
import { availableDEXes } from '@/utils/dex';
import { commonTokens } from '@/utils/dex';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Play, PauseCircle, BarChart3, Settings, Shuffle } from 'lucide-react';
import { priceMonitoringService, TokenPair, PriceHistory, priceHistoryStorage } from '@/utils/blockchain/priceMonitoring';
import { toast } from '@/hooks/use-toast';
import { workerManager } from '@/utils/blockchain/priceMonitoring/worker/workerManager';

// Memoized TokenPairItem component to prevent unnecessary re-renders
const TokenPairItem = memo(({ 
  pair, 
  onRemove, 
  isMonitoring 
}: { 
  pair: TokenPair; 
  onRemove: (pair: TokenPair) => void; 
  isMonitoring: boolean 
}) => {
  return (
    <div 
      className="p-3 rounded-md bg-background/50 border border-border/50 flex justify-between items-center"
    >
      <div>
        <div className="flex items-center space-x-2">
          <span className="font-medium">
            {pair.tokenA.symbol} / {pair.tokenB.symbol}
          </span>
        </div>
      </div>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => onRemove(pair)}
        disabled={isMonitoring}
      >
        Remove
      </Button>
    </div>
  );
});

TokenPairItem.displayName = "TokenPairItem";

// Memoized EmptyState component
const EmptyState = memo(() => (
  <div className="text-center p-6 text-muted-foreground">
    <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-20" />
    <p>No token pairs are being monitored</p>
    <p className="text-sm mt-1">Add a pair to start monitoring prices</p>
  </div>
));

EmptyState.displayName = "EmptyState";

// Memoized StatCard component
const StatCard = memo(({ title, value, variant = "default" }: { title: string; value: React.ReactNode; variant?: string }) => (
  <div className="p-4 rounded-md bg-background/50 border border-border/50">
    <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
    <div className="flex items-center">
      {variant === "badge" ? (
        <Badge variant={typeof value === 'boolean' && value ? "default" : "outline"} 
               className={typeof value === 'boolean' && value ? 
                 "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}>
          {value?.toString()}
        </Badge>
      ) : (
        <p className="text-2xl font-semibold">{value}</p>
      )}
    </div>
  </div>
));

StatCard.displayName = "StatCard";

const PriceMonitoringPanel = () => {
  const { wallet } = useWallet();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [monitoredPairs, setMonitoredPairs] = useState<TokenPair[]>([]);
  const [selectedTokenA, setSelectedTokenA] = useState<string>(commonTokens[0]?.address || '');
  const [selectedTokenB, setSelectedTokenB] = useState<string>(commonTokens[1]?.address || '');
  const [pollingInterval, setPollingInterval] = useState(30);
  const [minProfitPercentage, setMinProfitPercentage] = useState(0.5);
  const [autoExecute, setAutoExecute] = useState(false);
  const [stats, setStats] = useState({
    monitoredPairsCount: 0,
    activeDexesCount: 0,
    pendingOpportunitiesCount: 0,
    requestsRemaining: 0,
  });

  // Update monitoring stats periodically with useCallback to prevent recreation
  const updateStats = useCallback(() => {
    const currentStats = priceMonitoringService.getMonitoringStats();
    setIsMonitoring(currentStats.isRunning);
    setStats({
      monitoredPairsCount: currentStats.monitoredPairsCount,
      activeDexesCount: currentStats.activeDexesCount,
      pendingOpportunitiesCount: currentStats.pendingOpportunitiesCount,
      requestsRemaining: currentStats.requestsRemaining,
    });
  }, []);

  // Effect for periodic stats updates
  useEffect(() => {
    // Update stats immediately
    updateStats();

    // Set up interval to update stats
    const intervalId = setInterval(updateStats, 5000);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [updateStats]);

  // Update monitored pairs when monitoring status changes
  useEffect(() => {
    setMonitoredPairs(priceMonitoringService.getMonitoredPairs());
  }, [isMonitoring]);

  // Memoize token selection options to prevent recreation on each render
  const tokenAOptions = useMemo(() => 
    commonTokens.map(token => (
      <option key={token.address} value={token.address}>
        {token.symbol} - {token.name}
      </option>
    )),
  []);

  const tokenBOptions = useMemo(() => 
    commonTokens.map(token => (
      <option key={token.address} value={token.address}>
        {token.symbol} - {token.name}
      </option>
    )),
  []);

  // Callbacks for actions to prevent recreation
  const startMonitoring = useCallback(async () => {
    if (!wallet?.connected) {
      toast({
        title: 'Wallet Required',
        description: 'Please connect your wallet to start price monitoring',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Update configuration
      priceMonitoringService.updateConfig({
        pollingInterval: pollingInterval * 1000,
        minProfitPercentage,
        autoExecuteTrades: autoExecute,
      });

      // Start monitoring
      const success = await priceMonitoringService.startMonitoring();
      if (success) {
        setIsMonitoring(true);
        setMonitoredPairs(priceMonitoringService.getMonitoredPairs());
      }
    } catch (error) {
      console.error('Error starting monitoring:', error);
      toast({
        title: 'Monitoring Failed',
        description: 'Failed to start price monitoring',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [wallet, pollingInterval, minProfitPercentage, autoExecute]);

  const stopMonitoring = useCallback(() => {
    priceMonitoringService.stopMonitoring();
    setIsMonitoring(false);
  }, []);

  const addPair = useCallback(() => {
    if (selectedTokenA && selectedTokenB && selectedTokenA !== selectedTokenB) {
      const tokenA = commonTokens.find(t => t.address === selectedTokenA);
      const tokenB = commonTokens.find(t => t.address === selectedTokenB);

      if (tokenA && tokenB) {
        const added = priceMonitoringService.addPairToMonitor(tokenA, tokenB);
        if (added) {
          setMonitoredPairs(priceMonitoringService.getMonitoredPairs());
          toast({
            title: 'Pair Added',
            description: `Now monitoring ${tokenA.symbol}/${tokenB.symbol}`,
          });
        } else {
          toast({
            title: 'Pair Already Monitored',
            description: `${tokenA.symbol}/${tokenB.symbol} is already being monitored`,
            variant: 'destructive',
          });
        }
      }
    } else {
      toast({
        title: 'Invalid Pair',
        description: 'Please select different tokens for the pair',
        variant: 'destructive',
      });
    }
  }, [selectedTokenA, selectedTokenB]);

  const removePair = useCallback((pair: TokenPair) => {
    priceMonitoringService.removePairFromMonitor(pair.tokenA, pair.tokenB);
    setMonitoredPairs(priceMonitoringService.getMonitoredPairs());
  }, []);

  const updateConfig = useCallback(() => {
    priceMonitoringService.updateConfig({
      pollingInterval: pollingInterval * 1000,
      minProfitPercentage,
      autoExecuteTrades: autoExecute,
    });

    toast({
      title: 'Configuration Updated',
      description: 'Price monitoring configuration has been updated',
    });
  }, [pollingInterval, minProfitPercentage, autoExecute]);

  // Handle running calculations via web worker
  useEffect(() => {
    if (isMonitoring && workerManager.isReady()) {
      // Only run calculations when monitoring is active
      const calculationInterval = setInterval(async () => {
        try {
          // Get prices from the storage
          const tokens = monitoredPairs.flatMap(pair => [pair.tokenA, pair.tokenB]);
          const uniqueTokens = Array.from(new Set(tokens.map(t => t.address)))
            .map(addr => tokens.find(t => t.address === addr))
            .filter(Boolean) as Token[];
            
          if (uniqueTokens.length < 2) return;
            
          const prices: Record<string, Record<string, number>> = {};
          const activeDexes = availableDEXes.filter(dex => dex.active);

          for (const dex of activeDexes) {
            prices[dex.id] = {};
            for (const token of uniqueTokens) {
              const price = priceHistoryStorage.getLatestPrice(token.address, dex.id);
              if (price !== null) {
                prices[dex.id][token.address] = price;
              }
            }
          }
            
          // Calculate arbitrage opportunities in web worker
          const gasPrice = await fetch('https://ethgasstation.info/api/ethgasAPI.json')
            .then(res => res.json())
            .then(data => data.average * 1e8)
            .catch(() => 50e9); // Default to 50 Gwei
            
          workerManager.calculateArbitrage({
            prices,
            tokens: uniqueTokens,
            minProfitPercentage,
            gasPrice
          });
            
        } catch (error) {
          console.error('Error running worker calculations:', error);
        }
      }, 15000); // Run every 15 seconds
        
      return () => clearInterval(calculationInterval);
    }
  }, [isMonitoring, monitoredPairs, minProfitPercentage]);

  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Price Monitoring</h2>
        <Button 
          onClick={isMonitoring ? stopMonitoring : startMonitoring} 
          disabled={loading || !wallet?.connected}
          variant={isMonitoring ? "destructive" : "default"}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : isMonitoring ? (
            <>
              <PauseCircle className="mr-2 h-4 w-4" />
              Stop Monitoring
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Start Monitoring
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="pairs" className="flex-grow">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="pairs">Token Pairs</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="pairs" className="flex-grow">
          <div className="mb-4 flex gap-2">
            <div className="flex-grow">
              <Label htmlFor="tokenA" className="mb-1 block">Token A</Label>
              <select
                id="tokenA"
                className="w-full p-2 rounded-md border border-input bg-background"
                value={selectedTokenA}
                onChange={(e) => setSelectedTokenA(e.target.value)}
              >
                {tokenAOptions}
              </select>
            </div>
            <div className="flex-grow">
              <Label htmlFor="tokenB" className="mb-1 block">Token B</Label>
              <select
                id="tokenB"
                className="w-full p-2 rounded-md border border-input bg-background"
                value={selectedTokenB}
                onChange={(e) => setSelectedTokenB(e.target.value)}
              >
                {tokenBOptions}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={addPair} disabled={!wallet?.connected || isMonitoring}>
                <Shuffle className="h-4 w-4 mr-2" />
                Add Pair
              </Button>
            </div>
          </div>

          <div className="space-y-3 overflow-auto flex-grow">
            {monitoredPairs.length > 0 ? (
              monitoredPairs.map((pair) => (
                <TokenPairItem 
                  key={`${pair.tokenA.address}-${pair.tokenB.address}`}
                  pair={pair}
                  onRemove={removePair}
                  isMonitoring={isMonitoring}
                />
              ))
            ) : (
              <EmptyState />
            )}
          </div>
        </TabsContent>

        <TabsContent value="config">
          <div className="space-y-6">
            <div>
              <Label htmlFor="pollingInterval" className="mb-2 block">
                Polling Interval: {pollingInterval} seconds
              </Label>
              <Slider
                id="pollingInterval"
                min={5}
                max={120}
                step={5}
                value={[pollingInterval]}
                onValueChange={(value) => setPollingInterval(value[0])}
                disabled={isMonitoring}
              />
            </div>

            <div>
              <Label htmlFor="minProfit" className="mb-2 block">
                Minimum Profit Percentage: {minProfitPercentage}%
              </Label>
              <Slider
                id="minProfit"
                min={0.1}
                max={5}
                step={0.1}
                value={[minProfitPercentage]}
                onValueChange={(value) => setMinProfitPercentage(value[0])}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="autoExecute" className="cursor-pointer">
                Auto-Execute Profitable Trades
              </Label>
              <Switch
                id="autoExecute"
                checked={autoExecute}
                onCheckedChange={setAutoExecute}
              />
            </div>

            <Button onClick={updateConfig} className="w-full" disabled={!wallet?.connected}>
              <Settings className="h-4 w-4 mr-2" />
              Update Configuration
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid grid-cols-2 gap-4">
            <StatCard 
              title="Monitoring Status" 
              value={isMonitoring ? "Active" : "Inactive"} 
              variant="badge" 
            />
            <StatCard title="Monitored Pairs" value={stats.monitoredPairsCount} />
            <StatCard title="Active DEXes" value={stats.activeDexesCount} />
            <StatCard title="Pending Opportunities" value={stats.pendingOpportunitiesCount} />

            <div className="p-4 rounded-md bg-background/50 border border-border/50 col-span-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">API Rate Limit</h3>
              <div className="w-full bg-secondary rounded-full h-2.5 mt-2">
                <div 
                  className="bg-primary h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${(stats.requestsRemaining / 60) * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.requestsRemaining} requests remaining
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {!wallet?.connected && (
        <div className="mt-4 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
          Connect your wallet to start monitoring prices
        </div>
      )}
    </GlassCard>
  );
};

export default PriceMonitoringPanel;
