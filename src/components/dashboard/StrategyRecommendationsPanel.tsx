
import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Zap, 
  Clock, 
  Sliders, 
  Check, 
  X, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle,
  BarChart4,
  Info
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { strategyOptimizer, StrategyRecommendation } from '@/utils/ai/strategyOptimizer';

const StrategyRecommendationsPanel = () => {
  const [recommendation, setRecommendation] = useState<StrategyRecommendation | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [applySettings, setApplySettings] = useState({
    parameters: true,
    gasStrategy: true,
    riskTolerance: true
  });
  
  useEffect(() => {
    // Load the latest recommendation on mount
    const latestRec = strategyOptimizer.getLatestRecommendation();
    if (latestRec) {
      setRecommendation(latestRec);
      setLastRefresh(new Date(latestRec.timestamp));
    } else {
      // Generate a new recommendation if none exists
      generateRecommendation();
    }
  }, []);
  
  const generateRecommendation = async () => {
    setLoading(true);
    
    try {
      const newRecommendation = await strategyOptimizer.generateRecommendation();
      
      if (newRecommendation) {
        setRecommendation(newRecommendation);
        setLastRefresh(new Date());
        
        toast({
          title: "Strategy Recommendation",
          description: "New AI trading strategy recommendation available",
        });
      } else {
        toast({
          title: "Strategy Analysis",
          description: "Insufficient data for a meaningful recommendation. Execute more trades first.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to generate recommendation:', error);
      
      toast({
        title: "Recommendation Failed",
        description: "Unable to generate strategy recommendation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const applyRecommendation = () => {
    if (!recommendation) return;
    
    try {
      const result = strategyOptimizer.applyRecommendation(
        recommendation.id,
        applySettings.parameters,
        applySettings.gasStrategy,
        applySettings.riskTolerance
      );
      
      if (result) {
        toast({
          title: "Strategy Applied",
          description: "AI strategy recommendations have been applied",
        });
      } else {
        toast({
          title: "No Changes",
          description: "No changes were needed based on the recommendation",
        });
      }
    } catch (error) {
      console.error('Failed to apply recommendation:', error);
      
      toast({
        title: "Apply Failed",
        description: "Failed to apply strategy recommendations",
        variant: "destructive",
      });
    }
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleString();
  };
  
  if (!recommendation) {
    return (
      <GlassCard className="flex flex-col items-center justify-center p-6 h-full">
        <Brain className="w-10 h-10 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">AI Strategy Optimization</h3>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Not enough data to generate AI strategy recommendations yet.
          Execute more trades to enable this feature.
        </p>
        <Button onClick={generateRecommendation} disabled={loading}>
          {loading ? "Analyzing..." : "Analyze Now"}
        </Button>
      </GlassCard>
    );
  }
  
  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Brain className="w-5 h-5 mr-2" />
          <h2 className="text-xl font-semibold">AI Strategy Optimization</h2>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={generateRecommendation} 
          disabled={loading}
        >
          {loading ? "Analyzing..." : "Refresh"}
        </Button>
      </div>
      
      {lastRefresh && (
        <div className="text-xs text-muted-foreground mb-4">
          Last updated: {formatDate(lastRefresh)}
        </div>
      )}
      
      <div className="flex items-center mb-4">
        <div className="flex-1">
          <div className="flex items-center mb-1">
            <h3 className="text-md font-medium mr-2">Recommendation Confidence</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="w-[200px]">
                    Confidence score indicates how reliable the AI considers this recommendation based on available data.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Progress value={recommendation.confidence * 100} className="h-2" />
        </div>
        <div className="ml-4">
          <Badge variant={recommendation.confidence > 0.7 ? "default" : "outline"}>
            {(recommendation.confidence * 100).toFixed(0)}%
          </Badge>
        </div>
      </div>
      
      <div className="space-y-4 flex-grow">
        <div className="p-3 border rounded-md bg-card">
          <h3 className="text-sm font-medium mb-2 flex items-center">
            <Sliders className="h-4 w-4 mr-2" />
            Parameter Recommendations
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {recommendation.parameters.minProfitPercentage !== undefined && (
              <div>
                <span className="text-muted-foreground">Min Profit:</span>{' '}
                <span className="font-medium">{recommendation.parameters.minProfitPercentage}%</span>
              </div>
            )}
            
            {recommendation.parameters.maxTradeSize !== undefined && (
              <div>
                <span className="text-muted-foreground">Max Trade Size:</span>{' '}
                <span className="font-medium">{recommendation.parameters.maxTradeSize} ETH</span>
              </div>
            )}
            
            {recommendation.parameters.slippageTolerance !== undefined && (
              <div>
                <span className="text-muted-foreground">Slippage Tolerance:</span>{' '}
                <span className="font-medium">{recommendation.parameters.slippageTolerance}%</span>
              </div>
            )}
            
            {recommendation.parameters.gasStrategy && (
              <div>
                <span className="text-muted-foreground">Gas Strategy:</span>{' '}
                <span className="font-medium capitalize">{recommendation.parameters.gasStrategy}</span>
              </div>
            )}
            
            {recommendation.parameters.riskTolerance && (
              <div>
                <span className="text-muted-foreground">Risk Tolerance:</span>{' '}
                <span className="font-medium capitalize">{recommendation.parameters.riskTolerance}</span>
              </div>
            )}
          </div>
        </div>
        
        {recommendation.networkConditions && (
          <div className="p-3 border rounded-md bg-card">
            <h3 className="text-sm font-medium mb-2 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Network Conditions
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Gas Price:</span>{' '}
                <span className="font-medium">{recommendation.networkConditions.gasPrice}</span>
              </div>
              
              <div>
                <span className="text-muted-foreground">Congestion:</span>{' '}
                <Badge 
                  variant="outline" 
                  className={
                    recommendation.networkConditions.congestion === 'high' 
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' 
                      : recommendation.networkConditions.congestion === 'medium'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  }
                >
                  {recommendation.networkConditions.congestion.toUpperCase()}
                </Badge>
              </div>
              
              <div className="col-span-1 sm:col-span-2">
                <span className="text-muted-foreground">Recommended Action:</span>{' '}
                <span className="font-medium">{recommendation.networkConditions.recommendedAction}</span>
              </div>
            </div>
          </div>
        )}
        
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto">
              <span className="flex items-center text-sm">
                <Info className="h-4 w-4 mr-2" />
                Detailed Recommendations
              </span>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4 mt-4">
            {recommendation.recommendedTokenPairs && recommendation.recommendedTokenPairs.length > 0 && (
              <div className="p-3 border rounded-md bg-card">
                <h3 className="text-sm font-medium mb-2">Recommended Token Pairs</h3>
                <ul className="space-y-2 text-sm">
                  {recommendation.recommendedTokenPairs.map((pair, index) => (
                    <li key={index} className="flex justify-between items-center">
                      <span>{pair.tokenIn} → {pair.tokenOut}</span>
                      <Badge variant="outline">
                        {(pair.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {recommendation.recommendedDexes && recommendation.recommendedDexes.length > 0 && (
              <div className="p-3 border rounded-md bg-card">
                <h3 className="text-sm font-medium mb-2">Recommended DEXes</h3>
                <ul className="space-y-2 text-sm">
                  {recommendation.recommendedDexes.map((dex, index) => (
                    <li key={index} className="flex justify-between items-center">
                      <span>{dex.dexName}</span>
                      <Badge variant="outline">
                        {(dex.weight * 100).toFixed(0)}% weight
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {recommendation.optimalTradingHours && recommendation.optimalTradingHours.length > 0 && (
              <div className="p-3 border rounded-md bg-card">
                <h3 className="text-sm font-medium mb-2">Optimal Trading Hours (UTC)</h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {recommendation.optimalTradingHours.map((hour, index) => (
                    <Badge key={index} variant="outline" className="justify-center">
                      {hour.hour}:00
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {recommendation.improvementSuggestions && recommendation.improvementSuggestions.length > 0 && (
              <div className="p-3 border rounded-md bg-card">
                <h3 className="text-sm font-medium mb-2">Improvement Suggestions</h3>
                <ul className="space-y-2 text-sm">
                  {recommendation.improvementSuggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start">
                      <Zap className="h-4 w-4 mr-2 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
      
      <div className="mt-6 border-t pt-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              className="mr-2"
              checked={applySettings.parameters}
              onChange={(e) => setApplySettings({...applySettings, parameters: e.target.checked})}
            />
            Apply Parameters
          </label>
          
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              className="mr-2"
              checked={applySettings.gasStrategy}
              onChange={(e) => setApplySettings({...applySettings, gasStrategy: e.target.checked})}
            />
            Apply Gas Strategy
          </label>
          
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              className="mr-2"
              checked={applySettings.riskTolerance}
              onChange={(e) => setApplySettings({...applySettings, riskTolerance: e.target.checked})}
            />
            Apply Risk Tolerance
          </label>
        </div>
        
        <Button 
          className="w-full" 
          onClick={applyRecommendation}
          disabled={!Object.values(applySettings).some(v => v)}
        >
          <Zap className="mr-2 h-4 w-4" />
          Apply AI Recommendations
        </Button>
      </div>
    </GlassCard>
  );
};

export default StrategyRecommendationsPanel;
