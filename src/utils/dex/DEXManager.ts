
import { ethers } from 'ethers';
import { Token, DEX } from '@/types';
import { IDEXAdapter, DEXAdapterConfig, TradeRoute, SwapOptions } from './interfaces';
import { UniswapV2Adapter } from './UniswapV2Adapter';
import { SushiSwapAdapter } from './SushiSwapAdapter';
import { blockchain } from '@/utils/blockchain';
import { availableDEXes } from '@/utils/dex';
import { getWETHAddress } from './utils/common';
import { getBestPrice, findBestTradeRoute } from './utils/trades';
import { executeSwap, executeBestSwap } from './utils/swaps';

/**
 * Manager class for interacting with multiple DEXes
 */
export class DEXManager {
  private adapters: Map<string, IDEXAdapter> = new Map();
  private chainId: number;
  private ready: boolean = false;
  private activeAdapters: string[] = [];

  constructor(chainId: number = 1) {
    this.chainId = chainId;
    this.init();
  }

  /**
   * Initialize all DEX adapters
   */
  private async init(): Promise<void> {
    try {
      const provider = blockchain.getCurrentProvider();
      
      // Create adapter configs
      const config: DEXAdapterConfig = {
        chainId: this.chainId,
        providerOrSigner: provider
      };

      // Initialize adapters for each DEX
      // Uniswap V2
      const uniswapV2Adapter = new UniswapV2Adapter({
        ...config,
        additionalConfig: {
          wethAddress: getWETHAddress(this.chainId)
        }
      });
      this.adapters.set(uniswapV2Adapter.getDexId(), uniswapV2Adapter);
      
      // SushiSwap
      const sushiswapAdapter = new SushiSwapAdapter({
        ...config,
        additionalConfig: {
          wethAddress: getWETHAddress(this.chainId)
        }
      });
      this.adapters.set(sushiswapAdapter.getDexId(), sushiswapAdapter);
      
      // Set which DEXes are active by default
      this.updateActiveAdapters();
      
      this.ready = true;
    } catch (error) {
      console.error('Error initializing DEX manager:', error);
      this.ready = false;
    }
  }

  /**
   * Update which adapters are active based on availableDEXes
   */
  updateActiveAdapters(): void {
    this.activeAdapters = availableDEXes
      .filter(dex => dex.active)
      .map(dex => dex.id);
  }

  /**
   * Get an adapter by its ID
   */
  getAdapter(dexId: string): IDEXAdapter | undefined {
    return this.adapters.get(dexId);
  }

  /**
   * Get all available adapters
   */
  getAllAdapters(): IDEXAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get all active adapters
   */
  getActiveAdapters(): IDEXAdapter[] {
    return this.activeAdapters
      .map(id => this.adapters.get(id))
      .filter((adapter): adapter is IDEXAdapter => adapter !== undefined);
  }

  /**
   * Find the best price for a token pair across all active DEXes
   */
  async getBestPrice(
    tokenA: Token, 
    tokenB: Token
  ): Promise<{
    price: number;
    dexId: string;
    dexName: string;
  }> {
    return getBestPrice(this.getActiveAdapters(), tokenA, tokenB);
  }

  /**
   * Calculate expected output for a swap across all DEXes
   */
  async findBestTradeRoute(
    tokenIn: Token,
    tokenOut: Token,
    amountIn: string
  ): Promise<TradeRoute | null> {
    return findBestTradeRoute(this.getActiveAdapters(), tokenIn, tokenOut, amountIn);
  }

  /**
   * Execute a swap on the specified DEX
   */
  async executeSwap(
    dexId: string,
    tokenIn: Token,
    tokenOut: Token,
    amountIn: string,
    options: SwapOptions
  ): Promise<{
    success: boolean;
    transactionHash?: string;
    amountOut?: string;
    error?: string;
  }> {
    const adapter = this.getAdapter(dexId);
    
    if (!adapter) {
      return {
        success: false,
        error: `DEX not found: ${dexId}`
      };
    }
    
    return executeSwap(adapter, tokenIn, tokenOut, amountIn, options);
  }

  /**
   * Execute a swap using the best available route
   */
  async executeBestSwap(
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
  }> {
    return executeBestSwap(
      () => this.findBestTradeRoute(tokenIn, tokenOut, amountIn),
      (dexId) => this.getAdapter(dexId),
      tokenIn,
      tokenOut,
      amountIn,
      options
    );
  }

  /**
   * Get token price on a specific DEX
   */
  async getTokenPrice(dexId: string, tokenA: Token, tokenB: Token): Promise<number> {
    const adapter = this.getAdapter(dexId);
    
    if (!adapter) {
      throw new Error(`DEX not found: ${dexId}`);
    }
    
    return adapter.getTokenPrice(tokenA, tokenB);
  }

  /**
   * Get liquidity information on a specific DEX
   */
  async getLiquidity(dexId: string, tokenA: Token, tokenB: Token): Promise<{
    token0Reserves: string;
    token1Reserves: string;
    totalLiquidityUSD: number;
  }> {
    const adapter = this.getAdapter(dexId);
    
    if (!adapter) {
      throw new Error(`DEX not found: ${dexId}`);
    }
    
    return adapter.getLiquidity(tokenA, tokenB);
  }
}

// Export a singleton instance
export const dexManager = new DEXManager();
