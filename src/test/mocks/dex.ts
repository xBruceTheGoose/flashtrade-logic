
import { ethers } from 'ethers';
import { Token, DEX } from '@/types';
import { IDEXAdapter, TradeRoute, SwapOptions } from '@/utils/dex/interfaces';

export class MockDEXAdapter implements IDEXAdapter {
  private dexId: string;
  private dexName: string;
  
  constructor(dexId: string, dexName: string) {
    this.dexId = dexId;
    this.dexName = dexName;
  }
  
  getDexId(): string {
    return this.dexId;
  }
  
  getDexName(): string {
    return this.dexName;
  }
  
  async getTokenPrice(tokenA: Token, tokenB: Token): Promise<number> {
    return 1000.0;
  }
  
  async calculateExpectedOutput(
    tokenIn: Token,
    tokenOut: Token,
    amountIn: string
  ): Promise<{
    amountOut: string;
    priceImpact: number;
  }> {
    const numericAmount = parseFloat(amountIn);
    return {
      amountOut: (numericAmount * 0.98).toString(),
      priceImpact: 2.0,
    };
  }
  
  async executeSwap(
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
    return {
      success: true,
      transactionHash: '0xmocktransactionhash',
      amountOut: (parseFloat(amountIn) * 0.98).toString(),
    };
  }
  
  async getLiquidity(tokenA: Token, tokenB: Token): Promise<{
    token0Reserves: string;
    token1Reserves: string;
    totalLiquidityUSD: number;
  }> {
    return {
      token0Reserves: '1000000',
      token1Reserves: '1000',
      totalLiquidityUSD: 2000000,
    };
  }
}

export const mockUniswapAdapter = new MockDEXAdapter('uniswap-v2', 'Uniswap V2');
export const mockSushiswapAdapter = new MockDEXAdapter('sushiswap', 'SushiSwap');

export const mockDexes: DEX[] = [
  { id: 'uniswap-v2', name: 'Uniswap V2', active: true, logo: '' },
  { id: 'sushiswap', name: 'SushiSwap', active: true, logo: '' },
];

export const mockTokens: Token[] = [
  {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    price: 2000,
    balance: '10.0',
  },
  {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    price: 1,
    balance: '20000.0',
  },
];
