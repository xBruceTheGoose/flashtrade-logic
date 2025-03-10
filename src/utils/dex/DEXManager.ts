
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
import { logger } from '@/utils/monitoring/loggingService';

// Cache for DEX operations
interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

/**
 * Manager class for interacting with multiple DEXes
 */
export class DEXManager {
  private adapters: Map<string, IDEXAdapter> = new Map();
  private chainId: number;
  private ready: boolean = false;
  private activeAdapters: string[] = [];
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly cacheTTL = 30000; // 30 seconds cache time
  private readonly cacheMaxSize = 200;
  private lastCacheCleanup = Date.now();
  private readonly cleanupInterval = 60000; // Cleanup every minute

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
      logger.info('dex', 'Initializing DEX manager');
      
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
      logger.info('dex', 'DEX manager initialized successfully');
    } catch (error) {
      logger.error('dex', 'Error initializing DEX manager:', error);
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
   * Add to cache
   */
  private addToCache<T>(key: string, value: T): void {
    // Clean cache if needed
    this.cleanCacheIfNeeded();
    
    // Enforce cache size limit
    if (this.cache.size >= this.cacheMaxSize) {
      // Remove oldest entry
      let oldestKey: string | null = null;
      let oldestTime = Date.now();
      
      for (const [k, entry] of this.cache.entries()) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = k;
        }
      }
      
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry is still valid
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  /**
   * Clean cache if needed
   */
  private cleanCacheIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastCacheCleanup > this.cleanupInterval) {
      this.lastCacheCleanup = now;
      
      // Remove expired entries
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.cacheTTL) {
          this.cache.delete(key);
        }
      }
    }
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
    // Check cache first
    const cacheKey = `best_price:${tokenA.address}:${tokenB.address}`;
    const cached = this.getFromCache<{
      price: number;
      dexId: string;
      dexName: string;
    }>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const result = await getBestPrice(this.getActiveAdapters(), tokenA, tokenB);
    
    // Cache the result
    this.addToCache(cacheKey, result);
    
    return result;
  }

  /**
   * Calculate expected output for a swap across all DEXes
   */
  async findBestTradeRoute(
    tokenIn: Token,
    tokenOut: Token,
    amountIn: string
  ): Promise<TradeRoute | null> {
    // Check cache first
    const cacheKey = `best_route:${tokenIn.address}:${tokenOut.address}:${amountIn}`;
    const cached = this.getFromCache<TradeRoute | null>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const result = await findBestTradeRoute(this.getActiveAdapters(), tokenIn, tokenOut, amountIn);
    
    // Cache the result for a shorter period since this is price sensitive
    if (result) {
      this.addToCache(cacheKey, result);
    }
    
    return result;
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
    
    // No caching for execution functions as they modify state
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
    
    // Check cache first
    const cacheKey = `token_price:${dexId}:${tokenA.address}:${tokenB.address}`;
    const cached = this.getFromCache<number>(cacheKey);
    
    if (cached !== null) {
      return cached;
    }
    
    const price = await adapter.getTokenPrice(tokenA, tokenB);
    
    // Cache the result
    this.addToCache(cacheKey, price);
    
    return price;
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
    
    // Check cache first
    const cacheKey = `liquidity:${dexId}:${tokenA.address}:${tokenB.address}`;
    const cached = this.getFromCache<{
      token0Reserves: string;
      token1Reserves: string;
      totalLiquidityUSD: number;
    }>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const liquidity = await adapter.getLiquidity(tokenA, tokenB);
    
    // Cache the result
    this.addToCache(cacheKey, liquidity);
    
    return liquidity;
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.lastCacheCleanup = Date.now();
    logger.info('dex', 'DEX manager cache cleared');
  }
  
  /**
   * Check if DEX manager is ready
   */
  isReady(): boolean {
    return this.ready;
  }
}

// Export a singleton instance
export const dexManager = new DEXManager();
