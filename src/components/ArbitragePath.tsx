
import { ArbitrageOpportunity } from '@/types';
import { Badge } from "@/components/ui/badge";
import { ChevronRight, AlertTriangle, Shield, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ArbitragePathProps {
  opportunity: ArbitrageOpportunity;
  tokenMap: Record<string, { symbol: string; name: string; logoURI?: string }>;
  dexMap: Record<string, { name: string; logo?: string }>;
}

const ArbitragePath = ({ opportunity, tokenMap, dexMap }: ArbitragePathProps) => {
  // Show risk level badge
  const getRiskBadge = (riskLevel?: string) => {
    if (!riskLevel) return null;
    
    switch (riskLevel) {
      case 'low':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            <Shield className="h-3 w-3 mr-1" />
            Low Risk
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
            <Shield className="h-3 w-3 mr-1" />
            Medium Risk
          </Badge>
        );
      case 'high':
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
            <AlertTriangle className="h-3 w-3 mr-1" />
            High Risk
          </Badge>
        );
      default:
        return null;
    }
  };

  // If no path available, show simple path
  if (!opportunity.path || opportunity.path.length <= 2) {
    return (
      <div className="flex items-center overflow-x-auto py-2 space-x-1">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center border">
            {opportunity.tokenIn.logoURI ? (
              <img src={opportunity.tokenIn.logoURI} alt={opportunity.tokenIn.symbol} className="w-6 h-6 rounded-full" />
            ) : (
              <span className="text-xs font-bold">{opportunity.tokenIn.symbol.charAt(0)}</span>
            )}
          </div>
          <span className="mx-1 text-sm font-medium">{opportunity.tokenIn.symbol}</span>
        </div>
        
        <div className="flex items-center bg-muted/50 px-2 py-1 rounded text-xs">
          <span>{opportunity.sourceDex.name}</span>
          <ChevronRight className="h-3 w-3 mx-1" />
          <span>{opportunity.targetDex.name}</span>
        </div>
        
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center border">
            {opportunity.tokenOut.logoURI ? (
              <img src={opportunity.tokenOut.logoURI} alt={opportunity.tokenOut.symbol} className="w-6 h-6 rounded-full" />
            ) : (
              <span className="text-xs font-bold">{opportunity.tokenOut.symbol.charAt(0)}</span>
            )}
          </div>
          <span className="mx-1 text-sm font-medium">{opportunity.tokenOut.symbol}</span>
        </div>
        
        {getRiskBadge(opportunity.riskLevel)}
        
        {opportunity.confidenceScore !== undefined && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="cursor-help">
                <TrendingUp className="h-3 w-3 mr-1" />
                {opportunity.confidenceScore}/100
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Confidence score based on risk assessment</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }
  
  // Complex multi-hop path
  return (
    <div className="flex items-center overflow-x-auto py-2 space-x-1">
      {opportunity.path.map((tokenAddress, index) => {
        const isLast = index === opportunity.path!.length - 1;
        const token = tokenMap[tokenAddress] || { symbol: '???', name: 'Unknown Token' };
        const dexId = opportunity.dexPath?.[index];
        const dex = dexId ? dexMap[dexId] : null;
        
        return (
          <div key={`${tokenAddress}-${index}`} className="flex items-center flex-shrink-0">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center border">
                {token.logoURI ? (
                  <img src={token.logoURI} alt={token.symbol} className="w-6 h-6 rounded-full" />
                ) : (
                  <span className="text-xs font-bold">{token.symbol.charAt(0)}</span>
                )}
              </div>
              <span className="mx-1 text-sm font-medium">{token.symbol}</span>
            </div>
            
            {!isLast && dex && (
              <>
                <div className="bg-muted/50 px-2 py-1 rounded text-xs mx-1">
                  {dex.name}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
              </>
            )}
          </div>
        );
      })}
      
      {getRiskBadge(opportunity.riskLevel)}
      
      {opportunity.confidenceScore !== undefined && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="cursor-help">
              <TrendingUp className="h-3 w-3 mr-1" />
              {opportunity.confidenceScore}/100
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Confidence score based on risk assessment</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

export default ArbitragePath;
