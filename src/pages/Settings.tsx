
import { useState, useEffect } from 'react';
import GlassCard from '@/components/ui/GlassCard';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, Check, X, AlertTriangle } from 'lucide-react';
import { aiService } from '@/utils/ai/aiService';
import { getAIConfig } from '@/utils/ai/config';

const Settings = () => {
  const { wallet } = useWallet();
  const [gasLimit, setGasLimit] = useState('300000');
  const [slippage, setSlippage] = useState('0.50');
  const [autoExecution, setAutoExecution] = useState(false);
  const [network, setNetwork] = useState('ethereum');
  const [minProfit, setMinProfit] = useState('0.1');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [isApiKeyChanged, setIsApiKeyChanged] = useState(false);
  
  // Load saved API key on mount
  useEffect(() => {
    const config = getAIConfig();
    if (config.apiKey) {
      setApiKey(config.apiKey);
    }
  }, []);
  
  const validateApiKey = async () => {
    if (!apiKey) {
      setApiKeyStatus('invalid');
      return;
    }
    
    setApiKeyStatus('validating');
    const isValid = await aiService.validateApiKey(apiKey);
    
    if (isValid) {
      setApiKeyStatus('valid');
      aiService.setApiKey(apiKey);
      setIsApiKeyChanged(false);
      
      toast({
        title: 'API Key Validated',
        description: 'Your Coinbase API key is valid and has been saved.',
      });
    } else {
      setApiKeyStatus('invalid');
      toast({
        title: 'Invalid API Key',
        description: 'The provided API key could not be validated.',
        variant: 'destructive',
      });
    }
  };
  
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    setApiKeyStatus('idle');
    setIsApiKeyChanged(true);
  };
  
  const saveSettings = () => {
    // Validate API key if it has changed
    if (isApiKeyChanged && apiKey) {
      validateApiKey();
    }
    
    // In a real app, this would save to a backend or local storage
    toast({
      title: 'Settings Saved',
      description: 'Your changes have been saved successfully.',
    });
  };
  
  const getApiKeyStatusIcon = () => {
    switch (apiKeyStatus) {
      case 'valid':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'invalid':
        return <X className="h-5 w-5 text-red-500" />;
      case 'validating':
        return <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
      default:
        return null;
    }
  };
  
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Settings</h1>
      
      <div className="grid md:grid-cols-2 gap-6">
        <GlassCard>
          <h2 className="text-xl font-semibold mb-6">Trading Settings</h2>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="gas-limit">Gas Limit</Label>
              <Input
                id="gas-limit"
                value={gasLimit}
                onChange={(e) => setGasLimit(e.target.value)}
                disabled={!wallet?.connected}
              />
              <p className="text-xs text-muted-foreground">
                Maximum gas units to use for transactions
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="slippage">Slippage Tolerance (%)</Label>
              <Input
                id="slippage"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                disabled={!wallet?.connected}
              />
              <p className="text-xs text-muted-foreground">
                Maximum price change allowed for transactions
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="min-profit">Minimum Profit Threshold (ETH)</Label>
              <Input
                id="min-profit"
                value={minProfit}
                onChange={(e) => setMinProfit(e.target.value)}
                disabled={!wallet?.connected}
              />
              <p className="text-xs text-muted-foreground">
                Minimum profit required to execute arbitrage
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="network">Network</Label>
              <Select
                disabled={!wallet?.connected}
                value={network}
                onValueChange={setNetwork}
              >
                <SelectTrigger id="network">
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethereum">Ethereum Mainnet</SelectItem>
                  <SelectItem value="arbitrum">Arbitrum</SelectItem>
                  <SelectItem value="optimism">Optimism</SelectItem>
                  <SelectItem value="polygon">Polygon</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Blockchain network to use for transactions
              </p>
            </div>
          </div>
        </GlassCard>
        
        <GlassCard>
          <h2 className="text-xl font-semibold mb-6">Application Settings</h2>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto-execution" className="block mb-1">
                  Auto-Execute Arbitrage
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically execute profitable arbitrage opportunities
                </p>
              </div>
              <Switch
                id="auto-execution"
                checked={autoExecution}
                onCheckedChange={setAutoExecution}
                disabled={!wallet?.connected}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="notifications" className="block mb-1">
                  Enable Notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Receive notifications for important events
                </p>
              </div>
              <Switch
                id="notifications"
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
              />
            </div>
            
            <div className="pt-6 mt-6 border-t">
              <h3 className="text-lg font-medium mb-4">Coinbase AI Framework</h3>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="api-key">API Key</Label>
                  <div className="flex items-center">
                    {isApiKeyChanged && (
                      <span className="text-xs text-amber-500 flex items-center mr-2">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Unsaved changes
                      </span>
                    )}
                    {getApiKeyStatusIcon()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Enter your Coinbase API key"
                    value={apiKey}
                    onChange={handleApiKeyChange}
                    className="flex-grow"
                    disabled={!wallet?.connected}
                  />
                  <Button 
                    onClick={validateApiKey} 
                    disabled={!wallet?.connected || !apiKey || apiKeyStatus === 'validating'}
                    variant="outline"
                  >
                    Validate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  API key for Coinbase's AI trading framework (ID: 2353bcc1-8f9a-44cb-923d-3acc8a661d9b)
                </p>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
      
      <div className="flex justify-end">
        <Button 
          onClick={saveSettings} 
          disabled={!wallet?.connected}
          className="px-6"
        >
          <Save className="mr-2 h-4 w-4" />
          Save Settings
        </Button>
      </div>
      
      {!wallet?.connected && (
        <GlassCard className="bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30 mr-4">
              <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-yellow-800 dark:text-yellow-200">Wallet Connection Required</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Please connect your wallet to access and modify settings.
              </p>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export default Settings;
