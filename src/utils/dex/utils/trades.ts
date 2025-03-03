
import { Token } from '@/types';
import { IDEXAdapter, TradeRoute } from '../interfaces';

/**
 * Find the best price for a token pair across active DEX adapters
 */
export const getBestPrice = async (
  activeAdapters: IDEXAdapter[],
  tokenA: Token, 
  tokenB: Token
): Promise<{
  price: number;
  dexId: string;
  dexName: string;
}> => {
  if (activeAdapters.length === 0) {
    return { price: 0, dexId: '', dexName: '' };
  }
  
  const pricePromises = activeAdapters.map(async adapter => {
    try {
      const price = await adapter.getTokenPrice(tokenA, tokenB);
      return { price, dexId: adapter.getDexId(), dexName: adapter.getDexName() };
    } catch (error) {
      console.error(`Error getting price from ${adapter.getDexName()}:`, error);
      return { price: 0, dexId: adapter.getDexId(), dexName: adapter.getDexName() };
    }
  });
  
  const prices = await Promise.all(pricePromises);
  
  // Find the best price (highest output)
  return prices.reduce((best, current) => {
    return current.price > best.price ? current : best;
  }, { price: 0, dexId: '', dexName: '' });
};

/**
 * Calculate expected output for a swap across all DEXes
 */
export const findBestTradeRoute = async (
  activeAdapters: IDEXAdapter[],
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string
): Promise<TradeRoute | null> => {
  if (activeAdapters.length === 0) {
    return null;
  }
  
  const tradePromises = activeAdapters.map(async adapter => {
    try {
      const result = await adapter.getExpectedOutput(tokenIn, tokenOut, amountIn);
      return {
        dexId: adapter.getDexId(),
        path: [tokenIn, tokenOut],
        amountOut: result.amountOut,
        priceImpact: result.priceImpact
      };
    } catch (error) {
      console.error(`Error calculating trade on ${adapter.getDexName()}:`, error);
      return null;
    }
  });
  
  const trades = (await Promise.all(tradePromises)).filter((trade): trade is TradeRoute => trade !== null);
  
  if (trades.length === 0) {
    return null;
  }
  
  // Find the best trade (highest output)
  return trades.reduce((best, current) => {
    return parseFloat(current.amountOut) > parseFloat(best.amountOut) ? current : best;
  });
};
