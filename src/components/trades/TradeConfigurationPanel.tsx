
import { useState, useEffect } from 'react';
import { tradeExecutor } from '@/utils/arbitrage/tradeExecutor';
import { commonTokens } from '@/utils/dex';
import { availableDEXes } from '@/utils/dex';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { timeFrames } from '@/utils/arbitrage/constants';
import TokenSelector from './TokenSelector';
import DEXSelector from './DEXSelector';
import TradingScheduler from './TradingScheduler';
import PresetManager from './PresetManager';
import { 
  Save, 
  RotateCcw, 
  ChevronRight, 
  AlertTriangle, 
  Clock, 
  Settings, 
  Sliders,
  Database,
  Wallet, 
  Zap
} from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { MAX_CONFIGS, MIN_SLIPPAGE, MAX_SLIPPAGE, DEFAULT_MAX_FLASHLOAN } from '@/utils/arbitrage/constants';

export interface TradeConfig {
  id: string;
  name: string;
  selectedTokens: string[];
  selectedDexes: string[];
  maxFlashloanAmount: number;
  slippageTolerance: number;
  gasPrice: string;
  maxGasLimit: number;
  autoExecute: boolean;
  tradingHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    days: string[];
  };
}

const TradeConfigurationPanel = () => {
  const { wallet } = useWallet();
  const [activeTab, setActiveTab] = useState('tokens');
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [selectedDexes, setSelectedDexes] = useState<string[]>([]);
  const [maxFlashloanAmount, setMaxFlashloanAmount] = useState(DEFAULT_MAX_FLASHLOAN);
  const [slippageTolerance, setSlippageTolerance] = useState(0.5);
  const [gasPrice, setGasPrice] = useState('auto');
  const [maxGasLimit, setMaxGasLimit] = useState(300000);
  const [autoExecute, setAutoExecute] = useState(false);
  const [tradingHours, setTradingHours] = useState({
    enabled: false,
    startTime: '09:00',
    endTime: '17:00',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  });
  const [configName, setConfigName] = useState('Default Configuration');
  const [isDirty, setIsDirty] = useState(false);

  // Load current configuration on component mount
  useEffect(() => {
    const config = tradeExecutor.getExecutionConfig();
    
    // Only update auto-execute from the execution config
    setAutoExecute(config.autoExecute);
    setSlippageTolerance(config.slippageTolerance);
    
    // Load initial tokens and DEXes
    const activeDexes = availableDEXes.filter(d => d.active).map(d => d.id);
    setSelectedDexes(activeDexes);
    
    // Load commonly used tokens by default
    setSelectedTokens(commonTokens.slice(0, 4).map(t => t.address));
    
    setIsDirty(false);
  }, []);

  // Mark as dirty when any setting changes
  useEffect(() => {
    setIsDirty(true);
  }, [
    selectedTokens,
    selectedDexes,
    maxFlashloanAmount,
    slippageTolerance,
    gasPrice,
    maxGasLimit,
    autoExecute,
    tradingHours
  ]);

  const handleSaveConfig = () => {
    try {
      // Update execution configuration
      tradeExecutor.updateExecutionConfig({
        autoExecute,
        slippageTolerance,
        gasPrice,
      });
      
      // Save other configuration settings to localStorage or backend
      // (this would be implemented in a separate service)
      const config: TradeConfig = {
        id: Date.now().toString(),
        name: configName,
        selectedTokens,
        selectedDexes,
        maxFlashloanAmount,
        slippageTolerance,
        gasPrice,
        maxGasLimit,
        autoExecute,
        tradingHours
      };
      
      // For now, just log the configuration
      console.log('Saved configuration:', config);
      
      toast({
        title: 'Configuration Saved',
        description: 'Your trade configuration has been updated successfully.'
      });
      
      setIsDirty(false);
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: 'Error Saving Configuration',
        description: 'Failed to save your trade configuration.',
        variant: 'destructive'
      });
    }
  };

  const handleReset = () => {
    // Reset to defaults
    setSelectedTokens(commonTokens.slice(0, 4).map(t => t.address));
    setSelectedDexes(availableDEXes.filter(d => d.active).map(d => d.id));
    setMaxFlashloanAmount(DEFAULT_MAX_FLASHLOAN);
    setSlippageTolerance(0.5);
    setGasPrice('auto');
    setMaxGasLimit(300000);
    setAutoExecute(false);
    setTradingHours({
      enabled: false,
      startTime: '09:00',
      endTime: '17:00',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    });
  };

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              Trade Configuration
            </CardTitle>
            <CardDescription>
              Configure your arbitrage trading parameters
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReset}
              disabled={!wallet?.connected}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button 
              size="sm" 
              onClick={handleSaveConfig} 
              disabled={!wallet?.connected || !isDirty}
            >
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 mb-6">
            <TabsTrigger value="tokens">
              <Database className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Tokens</span>
            </TabsTrigger>
            <TabsTrigger value="dexes">
              <Wallet className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">DEXes</span>
            </TabsTrigger>
            <TabsTrigger value="execution">
              <Sliders className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Execution</span>
            </TabsTrigger>
            <TabsTrigger value="schedule">
              <Clock className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Schedule</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="tokens" className="space-y-4">
            <TokenSelector 
              selectedTokens={selectedTokens} 
              setSelectedTokens={setSelectedTokens} 
              disabled={!wallet?.connected}
            />
          </TabsContent>
          
          <TabsContent value="dexes" className="space-y-4">
            <DEXSelector 
              selectedDexes={selectedDexes} 
              setSelectedDexes={setSelectedDexes} 
              disabled={!wallet?.connected}
            />
          </TabsContent>
          
          <TabsContent value="execution" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max-flashloan">Max Flashloan Amount (ETH)</Label>
                <Input
                  id="max-flashloan"
                  type="number"
                  value={maxFlashloanAmount}
                  onChange={(e) => setMaxFlashloanAmount(parseFloat(e.target.value))}
                  disabled={!wallet?.connected}
                  min="0"
                  step="0.1"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="slippage">Slippage Tolerance (%)</Label>
                  <span className="text-xs text-muted-foreground">{slippageTolerance}%</span>
                </div>
                <Slider
                  id="slippage"
                  min={MIN_SLIPPAGE}
                  max={MAX_SLIPPAGE}
                  step={0.1}
                  value={[slippageTolerance]}
                  onValueChange={(values) => setSlippageTolerance(values[0])}
                  disabled={!wallet?.connected}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{MIN_SLIPPAGE}%</span>
                  <span>{MAX_SLIPPAGE}%</span>
                </div>
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
              
              <div className="space-y-2">
                <Label htmlFor="max-gas-limit">Max Gas Limit</Label>
                <Input
                  id="max-gas-limit"
                  type="number"
                  value={maxGasLimit}
                  onChange={(e) => setMaxGasLimit(parseInt(e.target.value))}
                  disabled={!wallet?.connected}
                  min="100000"
                  step="10000"
                />
              </div>
              
              <div className="col-span-full">
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
          </TabsContent>
          
          <TabsContent value="schedule" className="space-y-4">
            <TradingScheduler 
              tradingHours={tradingHours}
              setTradingHours={setTradingHours}
              disabled={!wallet?.connected}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex flex-col space-y-4">
        <PresetManager 
          configName={configName}
          setConfigName={setConfigName}
          onSave={handleSaveConfig}
          disabled={!wallet?.connected}
        />
        
        {!wallet?.connected && (
          <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 rounded-md w-full">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>Connect wallet to configure trading parameters</span>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default TradeConfigurationPanel;
