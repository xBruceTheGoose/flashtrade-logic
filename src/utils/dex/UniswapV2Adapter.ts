
import { ethers } from 'ethers';
import { Token } from '@/types';
import { DEXAdapterConfig } from './interfaces';
import { BaseAdapter } from './BaseAdapter';

// Uniswap V2 ABIs
const UNISWAP_V2_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
  'function factory() view returns (address)'
];

const UNISWAP_V2_FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) view returns (address pair)',
  'function feeTo() view returns (address)'
];

const UNISWAP_V2_PAIR_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function totalSupply() view returns (uint)'
];

const WETH_ABI = [
  'function deposit() payable',
  'function withdraw(uint) public'
];

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
    const routerAddress = config.routerAddress || this.getDefaultRouterAddress();
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
      
      const pairAddress = await this.factory.getPair(tokenA.address, tokenB.address);
      return pairAddress !== ethers.constants.AddressZero;
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
      const path = [tokenA.address, tokenB.address];
      
      // Check if direct path exists
      const isPairSupported = await this.isPairSupported(tokenA, tokenB);
      
      if (!isPairSupported && this.wethAddress) {
        // Try path through WETH
        path.splice(1, 0, this.wethAddress);
      }
      
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
      
      // Parse input amount
      const amountInBN = this.parseUnits(amountIn, tokenIn.decimals);
      
      // Determine path
      let path = [tokenIn.address, tokenOut.address];
      const isPairSupported = await this.isPairSupported(tokenIn, tokenOut);
      
      if (!isPairSupported && this.wethAddress) {
        // Try path through WETH
        path = [tokenIn.address, this.wethAddress, tokenOut.address];
      }
      
      // Get expected output
      const amounts = await this.router.getAmountsOut(amountInBN, path);
      const amountOut = this.formatUnits(amounts[amounts.length - 1], tokenOut.decimals);
      
      // Calculate price impact
      // Get market price for 1 token (small amount won't have impact)
      const smallAmount = this.parseUnits('1', tokenIn.decimals);
      const marketAmounts = await this.router.getAmountsOut(smallAmount, path);
      const marketRate = parseFloat(this.formatUnits(marketAmounts[marketAmounts.length - 1], tokenOut.decimals));
      
      // Calculate execution price
      const executionRate = parseFloat(amountOut) / parseFloat(amountIn);
      
      // Calculate price impact
      const priceImpact = this.calculatePriceImpact(marketRate, executionRate);
      
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
      let path = [tokenIn.address, tokenOut.address];
      const isPairSupported = await this.isPairSupported(tokenIn, tokenOut);
      
      if (!isPairSupported && this.wethAddress) {
        // Try path through WETH
        path = [tokenIn.address, this.wethAddress, tokenOut.address];
      }
      
      // Parse amounts
      const amountInBN = this.parseUnits(amountIn, tokenIn.decimals);
      const minAmountOutBN = this.parseUnits(minAmountOut, tokenOut.decimals);
      
      // Check and approve token if needed
      await this.approveTokenIfNeeded(tokenIn, this.config.routerAddress, amountIn);
      
      // Execute swap
      let tx;
      
      // Handle different swap types (ETH <> Token)
      const isETHIn = tokenIn.address.toLowerCase() === this.wethAddress.toLowerCase();
      const isETHOut = tokenOut.address.toLowerCase() === this.wethAddress.toLowerCase();
      
      if (isETHIn) {
        // ETH -> Token
        tx = await routerWithSigner.swapExactETHForTokens(
          minAmountOutBN,
          path.slice(1), // Remove WETH from path
          recipient,
          deadline,
          { value: amountInBN }
        );
      } else if (isETHOut) {
        // Token -> ETH
        tx = await routerWithSigner.swapExactTokensForETH(
          amountInBN,
          minAmountOutBN,
          path.slice(0, -1), // Remove WETH from path
          recipient,
          deadline
        );
      } else {
        // Token -> Token
        tx = await routerWithSigner.swapExactTokensForTokens(
          amountInBN,
          minAmountOutBN,
          path,
          recipient,
          deadline
        );
      }
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Calculate output amount based on logs
      // This is complex to implement exactly here, so we'll return the minimum amount for now
      
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
      
      // Get pair address
      const pairAddress = await this.factory.getPair(tokenA.address, tokenB.address);
      
      if (pairAddress === ethers.constants.AddressZero) {
        return {
          token0Reserves: '0',
          token1Reserves: '0',
          totalLiquidityUSD: 0
        };
      }
      
      // Initialize pair contract
      const pairContract = new ethers.Contract(
        pairAddress,
        UNISWAP_V2_PAIR_ABI,
        this.providerOrSigner
      );
      
      // Get tokens in the pair to determine order
      const token0Address = await pairContract.token0();
      const token1Address = await pairContract.token1();
      
      // Get reserves
      const [reserve0, reserve1] = await pairContract.getReserves();
      
      // Format reserves according to decimals
      const token0 = token0Address.toLowerCase() === tokenA.address.toLowerCase() ? tokenA : tokenB;
      const token1 = token1Address.toLowerCase() === tokenA.address.toLowerCase() ? tokenA : tokenB;
      
      const token0Reserves = this.formatUnits(reserve0, token0.decimals);
      const token1Reserves = this.formatUnits(reserve1, token1.decimals);
      
      // Calculate total liquidity in USD if prices are available
      let totalLiquidityUSD = 0;
      if (token0.price && token1.price) {
        const reserve0USD = parseFloat(token0Reserves) * token0.price;
        const reserve1USD = parseFloat(token1Reserves) * token1.price;
        totalLiquidityUSD = reserve0USD + reserve1USD;
      }
      
      return {
        token0Reserves,
        token1Reserves,
        totalLiquidityUSD
      };
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

  /**
   * Get default router address based on chain ID
   */
  private getDefaultRouterAddress(): string {
    // Uniswap V2 router addresses for different chains
    const routers: Record<number, string> = {
      1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Ethereum Mainnet
      3: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Ropsten
      4: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Rinkeby
      5: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Görli
      42: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Kovan
      56: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // BSC
      137: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // Polygon
      42161: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // Arbitrum
    };
    
    return routers[this.chainId] || routers[1]; // Default to Ethereum Mainnet
  }
}
