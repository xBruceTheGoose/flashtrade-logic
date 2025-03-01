
import { DEX, Token } from '@/types';

// Mock DEX data
export const availableDEXes: DEX[] = [
  {
    id: 'uniswap',
    name: 'Uniswap',
    icon: 'uniswap.svg',
    active: true
  },
  {
    id: 'sushiswap',
    name: 'SushiSwap',
    icon: 'sushiswap.svg',
    active: true
  },
  {
    id: 'curve',
    name: 'Curve',
    icon: 'curve.svg',
    active: true
  },
  {
    id: 'balancer',
    name: 'Balancer',
    icon: 'balancer.svg',
    active: false
  }
];

// Mock token data
export const commonTokens: Token[] = [
  {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    price: 3500
  },
  {
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    price: 64000
  },
  {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    price: 1
  },
  {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    price: 1
  }
];

// Mock function to get the price of a token on a specific DEX
export const getTokenPrice = async (
  dexId: string, 
  tokenAddress: string
): Promise<number> => {
  // Simulate API call to get the token price from a specific DEX
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // For simulation purposes, add a small random variation to the base price
  const token = commonTokens.find(t => t.address === tokenAddress);
  if (!token || !token.price) return 0;
  
  const variation = (Math.random() * 0.05) - 0.025; // ±2.5% variation
  return token.price * (1 + variation);
};

// Mock function to check for arbitrage opportunities
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
