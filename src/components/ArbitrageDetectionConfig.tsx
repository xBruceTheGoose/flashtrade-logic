
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Settings, Activity, TrendingUp, Shield } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { priceMonitoringService } from '@/utils/blockchain/priceMonitoring';
import { arbitrageDetectionEngine } from '@/utils/blockchain/priceMonitoring/arbitrageDetection';

const ArbitrageDetectionConfig = () => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    // Price monitoring config
    pollingInterval: 30000,
    maxRequestsPerMinute: 60,
    minProfitPercentage: 0.5,
    autoExecuteTrades: false,
    
    // Arbitrage detection config
    minProfitUSD: 5,
    maxArbitragePathLength: 3,
    maxSlippagePercentage: 1,
    considerFlashloan: true,
    gasMultiplier: 1.2,
    riskAssessmentEnabled: true,
  });

  // Load current configuration on mount
  useEffect(() => {
    const monitorConfig = {
      pollingInterval: priceMonitoringService.getMonitoringStats().isRunning ? 
        config.pollingInterval : 30000,
      maxRequestsPerMinute: 60,
      minProfitPercentage: 0.5,
      autoExecuteTrades: false,
      maxArbitragePathLength: 3,
      minProfitUSD: 5,
    };
    
    const detectionConfig = arbitrageDetectionEngine.getConfig();
    
    setConfig({
      ...monitorConfig,
      minProfitUSD: detectionConfig.minProfitUSD,
      maxArbitragePathLength: detectionConfig.maxPathLength,
      maxSlippagePercentage: detectionConfig.maxSlippagePercentage,
      considerFlashloan: detectionConfig.considerFlashloan,
      gasMultiplier: detectionConfig.gasMultiplier,
      riskAssessmentEnabled: detectionConfig.riskAssessmentEnabled,
    });
  }, []);

  const handleSave = () => {
    setLoading(true);
    
    try {
      // Update price monitoring service config
      priceMonitoringService.updateConfig({
        pollingInterval: config.pollingInterval,
        maxRequestsPerMinute: config.maxRequestsPerMinute,
        minProfitPercentage: config.minProfitPercentage,
        autoExecuteTrades: config.autoExecuteTrades,
        maxArbitragePathLength: config.maxArbitragePathLength,
        minProfitUSD: config.minProfitUSD,
      });
      
      // Update arbitrage detection engine config
      arbitrageDetectionEngine.updateConfig({
        minProfitUSD: config.minProfitUSD,
        minProfitPercentage: config.minProfitPercentage,
        maxPathLength: config.maxArbitragePathLength,
        maxSlippagePercentage: config.maxSlippagePercentage,
        considerFlashloan: config.considerFlashloan,
        gasMultiplier: config.gasMultiplier,
        riskAssessmentEnabled: config.riskAssessmentEnabled,
      });
      
      toast({
        title: "Configuration Saved",
        description: "Arbitrage detection configuration has been updated",
      });
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: "Save Failed",
        description: "Failed to update configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setConfig({
      pollingInterval: 30000,
      maxRequestsPerMinute: 60,
      minProfitPercentage: 0.5,
      autoExecuteTrades: false,
      minProfitUSD: 5,
      maxArbitragePathLength: 3,
      maxSlippagePercentage: 1,
      considerFlashloan: true,
      gasMultiplier: 1.2,
      riskAssessmentEnabled: true,
    });
    
    toast({
      title: "Reset to Defaults",
      description: "Configuration reset to default values",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="mr-2 h-5 w-5" />
          Arbitrage Detection Configuration
        </CardTitle>
        <CardDescription>
          Configure how the arbitrage detection algorithm works
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="general">
          <TabsList className="mb-4">
            <TabsTrigger value="general">
              <TrendingUp className="mr-2 h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="advanced">
              <Activity className="mr-2 h-4 w-4" />
              Advanced
            </TabsTrigger>
            <TabsTrigger value="risk">
              <Shield className="mr-2 h-4 w-4" />
              Risk
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="minProfitPercentage">
                  Minimum Profit Percentage ({config.minProfitPercentage}%)
                </Label>
                <Slider 
                  id="minProfitPercentage"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={[config.minProfitPercentage]}
                  onValueChange={(values) => setConfig({...config, minProfitPercentage: values[0]})}
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label htmlFor="minProfitUSD">
                  Minimum Profit in USD (${config.minProfitUSD})
                </Label>
                <Slider 
                  id="minProfitUSD"
                  min={1}
                  max={50}
                  step={1}
                  value={[config.minProfitUSD]}
                  onValueChange={(values) => setConfig({...config, minProfitUSD: values[0]})}
                  className="mt-2"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="autoExecuteTrades">Auto-Execute Trades</Label>
                <Switch 
                  id="autoExecuteTrades"
                  checked={config.autoExecuteTrades}
                  onCheckedChange={(checked) => setConfig({...config, autoExecuteTrades: checked})}
                />
              </div>
              
              <div>
                <Label htmlFor="pollingInterval">
                  Polling Interval ({(config.pollingInterval / 1000).toFixed(0)}s)
                </Label>
                <Slider 
                  id="pollingInterval"
                  min={5000}
                  max={120000}
                  step={5000}
                  value={[config.pollingInterval]}
                  onValueChange={(values) => setConfig({...config, pollingInterval: values[0]})}
                  className="mt-2"
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="advanced" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="maxArbitragePathLength">
                  Max Path Length ({config.maxArbitragePathLength} hops)
                </Label>
                <Slider 
                  id="maxArbitragePathLength"
                  min={2}
                  max={5}
                  step={1}
                  value={[config.maxArbitragePathLength]}
                  onValueChange={(values) => setConfig({...config, maxArbitragePathLength: values[0]})}
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label htmlFor="maxSlippagePercentage">
                  Max Slippage ({config.maxSlippagePercentage}%)
                </Label>
                <Slider 
                  id="maxSlippagePercentage"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={[config.maxSlippagePercentage]}
                  onValueChange={(values) => setConfig({...config, maxSlippagePercentage: values[0]})}
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label htmlFor="maxRequestsPerMinute">
                  Rate Limit ({config.maxRequestsPerMinute} requests/minute)
                </Label>
                <Slider 
                  id="maxRequestsPerMinute"
                  min={20}
                  max={200}
                  step={10}
                  value={[config.maxRequestsPerMinute]}
                  onValueChange={(values) => setConfig({...config, maxRequestsPerMinute: values[0]})}
                  className="mt-2"
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="risk" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="considerFlashloan">Consider Flashloan Costs</Label>
                <Switch 
                  id="considerFlashloan"
                  checked={config.considerFlashloan}
                  onCheckedChange={(checked) => setConfig({...config, considerFlashloan: checked})}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="riskAssessmentEnabled">Enable Risk Assessment</Label>
                <Switch 
                  id="riskAssessmentEnabled"
                  checked={config.riskAssessmentEnabled}
                  onCheckedChange={(checked) => setConfig({...config, riskAssessmentEnabled: checked})}
                />
              </div>
              
              <div>
                <Label htmlFor="gasMultiplier">
                  Gas Price Buffer ({(config.gasMultiplier * 100 - 100).toFixed(0)}%)
                </Label>
                <Slider 
                  id="gasMultiplier"
                  min={1}
                  max={2}
                  step={0.1}
                  value={[config.gasMultiplier]}
                  onValueChange={(values) => setConfig({...config, gasMultiplier: values[0]})}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Buffer added to gas estimates to account for network congestion
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handleReset}
          disabled={loading}
        >
          Reset to Defaults
        </Button>
        <Button 
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ArbitrageDetectionConfig;
