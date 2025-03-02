
import { ethers } from 'ethers';
import { Token, DEX } from '@/types';
import { IDEXAdapter, DEXAdapterConfig, TradeRoute, SwapOptions } from './interfaces';
import { UniswapV2Adapter } from './UniswapV2Adapter';
import { SushiSwapAdapter } from './SushiSwapAdapter';
import { blockchain } from '@/utils/blockchain';
import { availableDEXes } from '@/utils/dex';

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
      // Here we're creating all adapters but in a real app, you might want to lazy-load them
      
      // Uniswap V2
      const uniswapV2Adapter = new UniswapV2Adapter({
        ...config,
        additionalConfig: {
          wethAddress: this.getWETHAddress()
        }
      });
      this.adapters.set(uniswapV2Adapter.getDexId(), uniswapV2Adapter);
      
      // SushiSwap
      const sushiswapAdapter = new SushiSwapAdapter({
        ...config,
        additionalConfig: {
          wethAddress: this.getWETHAddress()
        }
      });
      this.adapters.set(sushiswapAdapter.getDexId(), sushiswapAdapter);
      
      // TODO: Add more DEX adapters here
      
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
    const activeAdapters = this.getActiveAdapters();
    
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
    const bestPrice = prices.reduce((best, current) => {
      return current.price > best.price ? current : best;
    }, { price: 0, dexId: '', dexName: '' });
    
    return bestPrice;
  }

  /**
   * Calculate expected output for a swap across all DEXes
   */
  async findBestTradeRoute(
    tokenIn: Token,
    tokenOut: Token,
    amountIn: string
  ): Promise<TradeRoute | null> {
    const activeAdapters = this.getActiveAdapters();
    
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
    
    // Get expected output
    const { amountOut } = await adapter.getExpectedOutput(tokenIn, tokenOut, amountIn);
    
    // Calculate minimum output with slippage
    const minAmountOut = this.applySlippage(amountOut, options.slippageTolerance, tokenOut.decimals);
    
    // Get recipient address
    const recipient = options.recipient || (await this.getSigner().getAddress());
    
    // Execute swap
    return adapter.executeSwap(
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      recipient,
      options.deadline
    );
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
    // Find best trade route
    const bestRoute = await this.findBestTradeRoute(tokenIn, tokenOut, amountIn);
    
    if (!bestRoute) {
      return {
        success: false,
        error: 'No valid trade route found'
      };
    }
    
    // Execute swap on the best DEX
    const result = await this.executeSwap(
      bestRoute.dexId,
      tokenIn,
      tokenOut,
      amountIn,
      options
    );
    
    return {
      ...result,
      dexId: bestRoute.dexId
    };
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

  /**
   * Apply slippage tolerance to an amount
   */
  private applySlippage(
    amount: string,
    slippageBps: number,
    decimals: number
  ): string {
    const amountBN = ethers.utils.parseUnits(amount, decimals);
    const slippageFactor = 10000 - slippageBps; // e.g., 9950 for 0.5% slippage
    const minAmountBN = amountBN.mul(slippageFactor).div(10000);
    return ethers.utils.formatUnits(minAmountBN, decimals);
  }

  /**
   * Get the signer for transactions
   */
  private getSigner(): ethers.Signer {
    const signer = blockchain.getSigner();
    if (!signer) {
      throw new Error('No signer available');
    }
    return signer;
  }

  /**
   * Get WETH address for the current chain
   */
  private getWETHAddress(): string {
    // WETH addresses for different chains
    const wethAddresses: Record<number, string> = {
      1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Ethereum Mainnet
      3: '0xc778417E063141139Fce010982780140Aa0cD5Ab', // Ropsten
      4: '0xc778417E063141139Fce010982780140Aa0cD5Ab', // Rinkeby
      5: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6', // Görli
      42: '0xd0A1E359811322d97991E03f863a0C30C2cF029C', // Kovan
      56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // BSC (WBNB)
      137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // Polygon (WMATIC)
      42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // Arbitrum
    };
    
    return wethAddresses[this.chainId] || wethAddresses[1]; // Default to Ethereum Mainnet
  }
}

// Export a singleton instance
export const dexManager = new DEXManager();
