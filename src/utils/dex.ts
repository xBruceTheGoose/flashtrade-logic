
import { DEX, Token } from '@/types';
import { dexManager } from './dex/DEXManager';

// Mock DEX data
export const availableDEXes: DEX[] = [
  {
    id: 'uniswap_v2',
    name: 'Uniswap V2',
    logo: 'uniswap.svg',
    active: true,
    supportedChainIds: [1, 3, 4, 5]
  },
  {
    id: 'sushiswap',
    name: 'SushiSwap',
    logo: 'sushiswap.svg',
    active: true,
    supportedChainIds: [1, 3, 4, 5]
  },
  {
    id: 'curve',
    name: 'Curve',
    logo: 'curve.svg',
    active: true,
    supportedChainIds: [1, 3, 4, 5]
  },
  {
    id: 'balancer',
    name: 'Balancer',
    logo: 'balancer.svg',
    active: false,
    supportedChainIds: [1, 3, 4, 5]
  }
];

// Mock token data
export const commonTokens: Token[] = [
  {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    chainId: 1,
    price: 3500
  },
  {
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    chainId: 1,
    price: 64000
  },
  {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainId: 1,
    price: 1
  },
  {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    chainId: 1,
    price: 1
  }
];

// Get the price of a token on a specific DEX
export const getTokenPrice = async (
  dexId: string, 
  tokenAddress: string
): Promise<number> => {
  try {
    // Update the active adapters in the DEX manager
    dexManager.updateActiveAdapters();
    
    // Find the token in commonTokens
    const token = commonTokens.find(t => t.address === tokenAddress);
    if (!token || !token.price) return 0;
    
    // Get USDC token to use as a reference
    const usdcToken = commonTokens.find(t => t.symbol === 'USDC');
    if (!usdcToken) return 0;
    
    // Try to get the price from the DEX manager
    try {
      return await dexManager.getTokenPrice(dexId, usdcToken, token);
    } catch (error) {
      console.warn(`Error getting price from DEX manager, using mock price:`, error);
      
      // Fall back to mock price with random variation
      const variation = (Math.random() * 0.05) - 0.025; // ±2.5% variation
      return token.price * (1 + variation);
    }
  } catch (error) {
    console.error(`Error in getTokenPrice:`, error);
    return 0;
  }
};

// Find arbitrage opportunities
export const findArbitrageOpportunities = async (
  sourceDexId: string,
  targetDexId: string,
  tokenAddress: string
): Promise<{
  hasOpportunity: boolean;
  profitPercentage: number;
  sourcePrice: number;
  targetPrice: number;
}> => {
  const sourcePrice = await getTokenPrice(sourceDexId, tokenAddress);
  const targetPrice = await getTokenPrice(targetDexId, tokenAddress);
  
  const priceDiff = ((targetPrice - sourcePrice) / sourcePrice) * 100;
  const hasOpportunity = Math.abs(priceDiff) > 0.5; // Opportunity if diff > 0.5%
  
  return {
    hasOpportunity,
    profitPercentage: priceDiff,
    sourcePrice,
    targetPrice
  };
};

// Export additional DEX API functions
export { dexManager } from './dex/DEXManager';
export type { SwapOptions } from './dex/interfaces';
