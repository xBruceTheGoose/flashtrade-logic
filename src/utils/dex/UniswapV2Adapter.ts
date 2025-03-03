
import { ethers } from 'ethers';
import { Token } from '@/types';
import { DEXAdapterConfig } from './interfaces';
import { BaseAdapter } from './BaseAdapter';
import { 
  UNISWAP_V2_ROUTER_ABI, 
  UNISWAP_V2_FACTORY_ABI,
  getDefaultRouterAddress,
  checkPairSupported,
  buildTradingPath,
  getTokenReserves,
  calculateExpectedOutput,
  executeSwapTransaction
} from './utils';

/**
 * Adapter for Uniswap V2 protocol
 */
export class UniswapV2Adapter extends BaseAdapter {
  private router: ethers.Contract | null = null;
  private factory: ethers.Contract | null = null;
  private wethAddress: string;
  private swapFee: number = 30; // 0.3% in basis points

  constructor(config: DEXAdapterConfig) {
    super(config);
    
    // Define default addresses if not provided
    const routerAddress = config.routerAddress || getDefaultRouterAddress(this.chainId);
    const factoryAddress = config.factoryAddress || '';
    
    this.config.routerAddress = routerAddress;
    this.config.factoryAddress = factoryAddress;
    this.wethAddress = config.additionalConfig?.wethAddress || '';
    
    this.initContracts();
  }

  private async initContracts(): Promise<void> {
    try {
      // Initialize Router contract
      this.router = new ethers.Contract(
        this.config.routerAddress,
        UNISWAP_V2_ROUTER_ABI,
        this.providerOrSigner
      );
      
      // Get Factory address if not provided
      if (!this.config.factoryAddress) {
        const factoryAddress = await this.router.factory();
        this.config.factoryAddress = factoryAddress;
      }
      
      // Initialize Factory contract
      this.factory = new ethers.Contract(
        this.config.factoryAddress,
        UNISWAP_V2_FACTORY_ABI,
        this.providerOrSigner
      );
      
      this.ready = true;
    } catch (error) {
      console.error('Failed to initialize UniswapV2Adapter:', error);
      this.ready = false;
    }
  }

  getDexId(): string {
    return 'uniswap_v2';
  }

  getDexName(): string {
    return 'Uniswap V2';
  }

  /**
   * Check if a token pair is supported on Uniswap V2
   */
  async isPairSupported(tokenA: Token, tokenB: Token): Promise<boolean> {
    try {
      if (!this.factory) await this.initContracts();
      if (!this.factory) return false;
      
      return checkPairSupported(this.factory, tokenA, tokenB);
    } catch (error) {
      console.error('Error checking pair support:', error);
      return false;
    }
  }

  /**
   * Get the price of tokenB in terms of tokenA
   */
  async getTokenPrice(tokenA: Token, tokenB: Token): Promise<number> {
    try {
      if (!this.router) await this.initContracts();
      if (!this.router) throw new Error('Router not initialized');
      
      // Use 1 unit of tokenA as input
      const amountIn = this.parseUnits('1', tokenA.decimals);
      
      // Determine path
      const path = await buildTradingPath(this.factory, tokenA, tokenB, this.wethAddress);
      
      const amounts = await this.router.getAmountsOut(amountIn, path);
      const amountOut = this.formatUnits(amounts[amounts.length - 1], tokenB.decimals);
      return parseFloat(amountOut);
    } catch (error) {
      console.error('Error getting token price:', error);
      return 0;
    }
  }

  /**
   * Calculate the expected output amount for a swap
   */
  async getExpectedOutput(
    tokenIn: Token, 
    tokenOut: Token, 
    amountIn: string
  ): Promise<{
    amountOut: string;
    priceImpact: number;
    path?: string[];
  }> {
    try {
      if (!this.router) await this.initContracts();
      if (!this.router) throw new Error('Router not initialized');
      
      // Determine path
      const path = await buildTradingPath(this.factory, tokenIn, tokenOut, this.wethAddress);
      
      // Calculate expected output
      const { amountOut, priceImpact } = await calculateExpectedOutput(
        this.router,
        tokenIn,
        tokenOut,
        amountIn,
        path
      );
      
      return {
        amountOut,
        priceImpact,
        path
      };
    } catch (error) {
      return this.handleError('getExpectedOutput', error);
    }
  }

  /**
   * Execute a token swap
   */
  async executeSwap(
    tokenIn: Token,
    tokenOut: Token,
    amountIn: string,
    minAmountOut: string,
    recipient: string,
    deadline: number = Math.floor(Date.now() / 1000) + 20 * 60 // 20 minutes from now
  ): Promise<{
    success: boolean;
    transactionHash?: string;
    amountOut?: string;
    error?: string;
  }> {
    try {
      if (!this.router) await this.initContracts();
      if (!this.router) throw new Error('Router not initialized');
      
      const signer = this.getSigner();
      if (!signer) throw new Error('No signer available');
      
      // Get router with signer
      const routerWithSigner = this.router.connect(signer);
      
      // Determine path
      const path = await buildTradingPath(this.factory, tokenIn, tokenOut, this.wethAddress);
      
      // Parse amounts
      const amountInBN = this.parseUnits(amountIn, tokenIn.decimals);
      const minAmountOutBN = this.parseUnits(minAmountOut, tokenOut.decimals);
      
      // Check and approve token if needed
      await this.approveTokenIfNeeded(tokenIn, this.config.routerAddress, amountIn);
      
      // Execute swap
      const tx = await executeSwapTransaction(
        routerWithSigner,
        tokenIn,
        tokenOut,
        this.wethAddress,
        amountInBN,
        minAmountOutBN,
        path,
        recipient,
        deadline
      );
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        amountOut: minAmountOut
      };
    } catch (error) {
      console.error('Swap execution error:', error);
      let errorMessage = 'Unknown error';
      
      if (typeof error === 'object' && error !== null) {
        // @ts-ignore
        errorMessage = error.message || errorMessage;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Check the liquidity available for a token pair
   */
  async getLiquidity(tokenA: Token, tokenB: Token): Promise<{
    token0Reserves: string;
    token1Reserves: string;
    totalLiquidityUSD: number;
  }> {
    try {
      if (!this.factory) await this.initContracts();
      if (!this.factory) throw new Error('Factory not initialized');
      
      return getTokenReserves(this.providerOrSigner, this.factory, tokenA, tokenB);
    } catch (error) {
      console.error('Error getting liquidity:', error);
      return {
        token0Reserves: '0',
        token1Reserves: '0',
        totalLiquidityUSD: 0
      };
    }
  }

  /**
   * Get the swap fee percentage for this DEX (in basis points)
   */
  async getSwapFee(_tokenA: Token, _tokenB: Token): Promise<number> {
    return this.swapFee; // 0.3% fixed for Uniswap V2
  }
}
