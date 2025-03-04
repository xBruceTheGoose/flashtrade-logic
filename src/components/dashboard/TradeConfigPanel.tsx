import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';
import GlassCard from '@/components/ui/GlassCard';
import { Settings, Sliders, AlertTriangle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { tradeExecutor } from '@/utils/arbitrage/tradeExecutor';
import { ExecutionStrategyType } from '@/utils/arbitrage/types';

const TradeConfigPanel = () => {
  const { wallet } = useWallet();
  const [minProfitPercentage, setMinProfitPercentage] = useState('0.50');
  const [maxTradeSize, setMaxTradeSize] = useState('1.0');
  const [slippageTolerance, setSlippageTolerance] = useState('0.50');
  const [gasPrice, setGasPrice] = useState('auto');
  const [autoExecute, setAutoExecute] = useState(false);
  const [riskTolerance, setRiskTolerance] = useState('medium');
  const [executionStrategy, setExecutionStrategy] = useState<ExecutionStrategyType>('sequential');
  const [maxConcurrentTrades, setMaxConcurrentTrades] = useState('2');
  
  useEffect(() => {
    const config = tradeExecutor.getExecutionConfig();
    setMinProfitPercentage(config.minProfitPercentage.toString());
    setMaxTradeSize(config.maxTradeSize.toString());
    setSlippageTolerance(config.slippageTolerance.toString());
    setGasPrice(config.gasPrice === 'auto' ? 'auto' : config.gasPrice.toString());
    setAutoExecute(config.autoExecute);
    setRiskTolerance(config.riskTolerance);
    setExecutionStrategy(config.executionStrategy);
    setMaxConcurrentTrades(config.maxConcurrentTrades.toString());
  }, []);

  const handleSaveSettings = () => {
    try {
      const profitPercentage = parseFloat(minProfitPercentage);
      const tradeSize = parseFloat(maxTradeSize);
      const slippage = parseFloat(slippageTolerance);
      const concurrent = parseInt(maxConcurrentTrades, 10);
      
      if (isNaN(profitPercentage) || profitPercentage < 0) {
        throw new Error('Invalid minimum profit percentage');
      }
      
      if (isNaN(tradeSize) || tradeSize <= 0) {
        throw new Error('Invalid maximum trade size');
      }
      
      if (isNaN(slippage) || slippage < 0 || slippage > 100) {
        throw new Error('Invalid slippage tolerance');
      }
      
      if (isNaN(concurrent) || concurrent < 1) {
        throw new Error('Invalid concurrent trades value');
      }
      
      tradeExecutor.updateExecutionConfig({
        minProfitPercentage: profitPercentage,
        maxTradeSize: tradeSize,
        slippageTolerance: slippage,
        gasPrice: gasPrice,
        autoExecute: autoExecute,
        riskTolerance: riskTolerance as 'low' | 'medium' | 'high',
        executionStrategy: executionStrategy,
        maxConcurrentTrades: concurrent,
      });
      
      toast({
        title: 'Settings Saved',
        description: 'Your trading configuration has been updated',
      });
    } catch (error: any) {
      toast({
        title: 'Invalid Settings',
        description: error.message || 'Please check your inputs',
        variant: 'destructive',
      });
    }
  };

  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          Trade Configuration
        </h2>
      </div>
      
      <div className="space-y-4 flex-grow">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="min-profit">Minimum Profit (%)</Label>
            <Input
              id="min-profit"
              type="number"
              value={minProfitPercentage}
              onChange={(e) => setMinProfitPercentage(e.target.value)}
              disabled={!wallet?.connected}
              min="0"
              step="0.1"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="max-trade">Maximum Trade Size (ETH)</Label>
            <Input
              id="max-trade"
              type="number"
              value={maxTradeSize}
              onChange={(e) => setMaxTradeSize(e.target.value)}
              disabled={!wallet?.connected}
              min="0.01"
              step="0.1"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="slippage">Slippage Tolerance (%)</Label>
            <Input
              id="slippage"
              type="number"
              value={slippageTolerance}
              onChange={(e) => setSlippageTolerance(e.target.value)}
              disabled={!wallet?.connected}
              min="0.1"
              max="5"
              step="0.1"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="gas-price">Gas Price</Label>
            <Select 
              value={gasPrice} 
              onValueChange={setGasPrice}
              disabled={!wallet?.connected}
            >
              <SelectTrigger id="gas-price">
                <SelectValue placeholder="Select gas price" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (Recommended)</SelectItem>
                <SelectItem value="low">Low (Slower)</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High (Faster)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="risk-tolerance">Risk Tolerance</Label>
              <span className="text-xs text-muted-foreground capitalize">{riskTolerance}</span>
            </div>
            <div className="py-1">
              <Slider
                id="risk-tolerance"
                min={1}
                max={3}
                step={1}
                value={[riskTolerance === 'low' ? 1 : riskTolerance === 'medium' ? 2 : 3]}
                onValueChange={(values) => {
                  const value = values[0];
                  if (value === 1) setRiskTolerance('low');
                  else if (value === 2) setRiskTolerance('medium');
                  else setRiskTolerance('high');
                }}
                disabled={!wallet?.connected}
              />
              
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Conservative</span>
                <span>Balanced</span>
                <span>Aggressive</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="execution-strategy">Execution Strategy</Label>
            <Select 
              value={executionStrategy} 
              onValueChange={(value) => setExecutionStrategy(value as ExecutionStrategyType)}
              disabled={!wallet?.connected}
            >
              <SelectTrigger id="execution-strategy">
                <SelectValue placeholder="Select strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential">Sequential (One at a time)</SelectItem>
                <SelectItem value="concurrent">Concurrent (Multiple)</SelectItem>
                <SelectItem value="priority">Priority-based</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {executionStrategy === 'concurrent' && (
            <div className="space-y-2">
              <Label htmlFor="max-concurrent">Max Concurrent Trades</Label>
              <Input
                id="max-concurrent"
                type="number"
                value={maxConcurrentTrades}
                onChange={(e) => setMaxConcurrentTrades(e.target.value)}
                disabled={!wallet?.connected}
                min="1"
                max="5"
                step="1"
              />
            </div>
          )}
          
          <div className="flex items-center justify-between space-x-2 pt-2">
            <div className="space-y-0.5">
              <Label htmlFor="auto-execute">Auto-Execute Trades</Label>
              <div className="text-xs text-muted-foreground">
                Automatically execute profitable opportunities
              </div>
            </div>
            <Switch
              id="auto-execute"
              checked={autoExecute}
              onCheckedChange={setAutoExecute}
              disabled={!wallet?.connected}
            />
          </div>
        </div>
      </div>
      
      <div className="flex justify-end pt-4">
        <Button 
          onClick={handleSaveSettings} 
          disabled={!wallet?.connected}
        >
          <Save className="h-4 w-4 mr-2" />
          Save Configuration
        </Button>
      </div>
      
      {!wallet?.connected && (
        <div className="mt-4 flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 rounded-md">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>Connect wallet to configure trading parameters</span>
        </div>
      )}
    </GlassCard>
  );
};

export default TradeConfigPanel;
