
import { Token } from '@/types';
import { IDEXAdapter, SwapOptions } from '../interfaces';
import { applySlippage, getSigner } from './common';

/**
 * Execute a swap on the specified DEX adapter
 */
export const executeSwap = async (
  adapter: IDEXAdapter,
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  options: SwapOptions
): Promise<{
  success: boolean;
  transactionHash?: string;
  amountOut?: string;
  error?: string;
}> => {
  if (!adapter) {
    return {
      success: false,
      error: `DEX adapter not found`
    };
  }
  
  try {
    // Get expected output
    const { amountOut } = await adapter.getExpectedOutput(tokenIn, tokenOut, amountIn);
    
    // Calculate minimum output with slippage
    const minAmountOut = applySlippage(amountOut, options.slippageTolerance, tokenOut.decimals);
    
    // Get recipient address
    const recipient = options.recipient || (await getSigner().getAddress());
    
    // Execute swap
    return adapter.executeSwap(
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      recipient,
      options.deadline
    );
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error during swap execution'
    };
  }
};

/**
 * Execute a swap using the best available route
 */
export const executeBestSwap = async (
  findBestRoute: () => Promise<{ dexId: string; } | null>,
  getAdapter: (dexId: string) => IDEXAdapter | undefined,
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  options: SwapOptions
): Promise<{
  success: boolean;
  dexId?: string;
  transactionHash?: string;
  amountOut?: string;
  error?: string;
}> => {
  // Find best trade route
  const bestRoute = await findBestRoute();
  
  if (!bestRoute) {
    return {
      success: false,
      error: 'No valid trade route found'
    };
  }
  
  const adapter = getAdapter(bestRoute.dexId);
  
  if (!adapter) {
    return {
      success: false,
      error: `DEX not found: ${bestRoute.dexId}`
    };
  }
  
  // Execute swap on the best DEX
  const result = await executeSwap(
    adapter,
    tokenIn,
    tokenOut,
    amountIn,
    options
  );
  
  return {
    ...result,
    dexId: bestRoute.dexId
  };
};
