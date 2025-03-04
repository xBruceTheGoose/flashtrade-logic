
import React, { useState, useEffect } from 'react';
import { tradeExecutor } from '@/utils/arbitrage/tradeExecutor';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/hooks/use-toast';

export function TradeExecutionSettings() {
  const [config, setConfig] = useState(tradeExecutor.getExecutionConfig());
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    // Refresh config
    setConfig(tradeExecutor.getExecutionConfig());
  }, []);

  const handleToggleAutoExecute = () => {
    const newConfig = {
      ...config,
      autoExecute: !config.autoExecute
    };
    
    setConfig(newConfig);
    tradeExecutor.updateExecutionConfig(newConfig);
    
    toast({
      title: config.autoExecute ? "Auto-Execution Disabled" : "Auto-Execution Enabled",
      description: config.autoExecute ? 
        "Trades will no longer be executed automatically." : 
        "Profitable trades will now be executed automatically."
    });
  };

  const handleSaveConfig = () => {
    try {
      tradeExecutor.updateExecutionConfig(config);
      setIsEditing(false);
      
      toast({
        title: "Settings Saved",
        description: "Trade execution settings have been updated."
      });
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save execution settings.",
        variant: "destructive"
      });
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof typeof config
  ) => {
    // Handle different input types
    const value = e.target.type === 'checkbox' 
      ? e.target.checked 
      : e.target.type === 'number'
        ? parseFloat(e.target.value)
        : e.target.value;
    
    setConfig({
      ...config,
      [field]: value
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Trade Execution Settings</CardTitle>
        <CardDescription>
          Configure how arbitrage trades are executed
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Auto-Execute Switch */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="auto-execute" className="text-base">Automatic Execution</Label>
            <p className="text-sm text-gray-500">
              Automatically execute profitable arbitrage opportunities
            </p>
          </div>
          <Switch 
            id="auto-execute" 
            checked={config.autoExecute}
            onCheckedChange={handleToggleAutoExecute}
          />
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200"></div>

        {/* Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Execution Parameters</h3>

          {/* Min Profit Threshold */}
          <div className="space-y-2">
            <Label htmlFor="min-profit">Minimum Profit Threshold (USD)</Label>
            <div className="flex items-center gap-4">
              <Slider
                id="min-profit"
                disabled={!isEditing}
                min={1}
                max={50}
                step={1}
                value={[config.minProfitPercentage]}
                onValueChange={(value) => setConfig({
                  ...config,
                  minProfitPercentage: value[0]
                })}
              />
              <Input
                type="number"
                disabled={!isEditing}
                value={config.minProfitPercentage}
                onChange={(e) => handleInputChange(e, 'minProfitPercentage')}
                className="w-20"
              />
            </div>
          </div>

          {/* Max Trade Size */}
          <div className="space-y-2">
            <Label htmlFor="max-trade-size">Maximum Trade Size (USD)</Label>
            <div className="flex items-center gap-4">
              <Slider
                id="max-trade-size"
                disabled={!isEditing}
                min={100}
                max={10000}
                step={100}
                value={[config.maxTradeSize]}
                onValueChange={(value) => setConfig({
                  ...config,
                  maxTradeSize: value[0]
                })}
              />
              <Input
                type="number"
                disabled={!isEditing}
                value={config.maxTradeSize}
                onChange={(e) => handleInputChange(e, 'maxTradeSize')}
                className="w-20"
              />
            </div>
          </div>

          {/* Slippage Tolerance */}
          <div className="space-y-2">
            <Label htmlFor="slippage">Slippage Tolerance (%)</Label>
            <div className="flex items-center gap-4">
              <Slider
                id="slippage"
                disabled={!isEditing}
                min={0.1}
                max={5.0}
                step={0.1}
                value={[config.slippageTolerance]}
                onValueChange={(value) => setConfig({
                  ...config,
                  slippageTolerance: value[0]
                })}
              />
              <Input
                type="number"
                disabled={!isEditing}
                value={config.slippageTolerance}
                onChange={(e) => handleInputChange(e, 'slippageTolerance')}
                className="w-20"
              />
            </div>
          </div>
          
          {/* Risk Tolerance */}
          <div className="space-y-2">
            <Label>Risk Tolerance</Label>
            <div className="grid grid-cols-3 gap-2">
              {['low', 'medium', 'high'].map((level) => (
                <Button
                  key={level}
                  type="button"
                  variant={config.riskTolerance === level ? "default" : "outline"}
                  disabled={!isEditing}
                  onClick={() => setConfig({
                    ...config,
                    riskTolerance: level as 'low' | 'medium' | 'high'
                  })}
                  className="w-full capitalize"
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-end space-x-2">
        {isEditing ? (
          <>
            <Button variant="outline" onClick={() => {
              setConfig(tradeExecutor.getExecutionConfig());
              setIsEditing(false);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig}>
              Save Changes
            </Button>
          </>
        ) : (
          <Button onClick={() => setIsEditing(true)}>
            Edit Settings
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
