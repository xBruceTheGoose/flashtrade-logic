
import { Token } from '@/types';
import { BigNumber } from 'ethers';

/**
 * Standard interface for DEX operations
 */
export interface IDEXAdapter {
  /**
   * Get the identifier for this DEX
   */
  getDexId(): string;
  
  /**
   * Get the name of this DEX
   */
  getDexName(): string;
  
  /**
   * Check if a token pair is supported on this DEX
   */
  isPairSupported(tokenA: Token, tokenB: Token): Promise<boolean>;
  
  /**
   * Get the price of tokenB in terms of tokenA
   */
  getTokenPrice(tokenA: Token, tokenB: Token): Promise<number>;
  
  /**
   * Calculate the expected output amount for a swap
   */
  getExpectedOutput(
    tokenIn: Token, 
    tokenOut: Token, 
    amountIn: string
  ): Promise<{
    amountOut: string;
    priceImpact: number;
    path?: string[];
  }>;
  
  /**
   * Execute a token swap
   */
  executeSwap(
    tokenIn: Token,
    tokenOut: Token,
    amountIn: string,
    minAmountOut: string,
    recipient: string,
    deadline?: number
  ): Promise<{
    success: boolean;
    transactionHash?: string;
    amountOut?: string;
    error?: string;
  }>;
  
  /**
   * Check the liquidity available for a token pair
   */
  getLiquidity(tokenA: Token, tokenB: Token): Promise<{
    token0Reserves: string;
    token1Reserves: string;
    totalLiquidityUSD: number;
  }>;
  
  /**
   * Get the swap fee percentage for this DEX (in basis points)
   */
  getSwapFee(tokenA: Token, tokenB: Token): Promise<number>;
  
  /**
   * Check if the adapter is ready to use
   */
  isReady(): Promise<boolean>;
}

/**
 * Configuration for initializing DEX adapters
 */
export interface DEXAdapterConfig {
  chainId: number;
  providerOrSigner: any; // ethers provider or signer
  routerAddress?: string;
  factoryAddress?: string;
  additionalConfig?: Record<string, any>;
}

/**
 * Structure of a potential trading route
 */
export interface TradeRoute {
  dexId: string;
  path: Token[];
  amountOut: string;
  priceImpact: number;
  gasEstimate?: BigNumber;
}

/**
 * Swap execution options
 */
export interface SwapOptions {
  slippageTolerance: number;  // in basis points (e.g., 50 = 0.5%)
  deadline?: number;          // timestamp
  recipient?: string;         // recipient address, defaults to sender
  gasLimit?: number;          // gas limit override
  gasPrice?: BigNumber;       // gas price override
}
