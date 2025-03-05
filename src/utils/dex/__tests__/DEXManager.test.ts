
import { dexManager } from '../DEXManager';
import { mockTokens } from '@/test/mocks/dex';
import { blockchain } from '@/utils/blockchain';
import { IDEXAdapter } from '../interfaces';

// Mock adapters
jest.mock('../UniswapV2Adapter', () => ({
  UniswapV2Adapter: jest.fn().mockImplementation(() => ({
    getDexId: jest.fn().mockReturnValue('uniswap-v2'),
    getTokenPrice: jest.fn().mockResolvedValue(2000),
    calculateExpectedOutput: jest.fn().mockResolvedValue({
      amountOut: '1.96',
      priceImpact: 2.0,
    }),
    executeSwap: jest.fn().mockResolvedValue({
      success: true,
      transactionHash: '0xtx1',
      amountOut: '1.96',
    }),
    getLiquidity: jest.fn().mockResolvedValue({
      token0Reserves: '1000000',
      token1Reserves: '1000',
      totalLiquidityUSD: 2000000,
    }),
  })),
}));

jest.mock('../SushiSwapAdapter', () => ({
  SushiSwapAdapter: jest.fn().mockImplementation(() => ({
    getDexId: jest.fn().mockReturnValue('sushiswap'),
    getTokenPrice: jest.fn().mockResolvedValue(1980),
    calculateExpectedOutput: jest.fn().mockResolvedValue({
      amountOut: '1.95',
      priceImpact: 2.5,
    }),
    executeSwap: jest.fn().mockResolvedValue({
      success: true,
      transactionHash: '0xtx2',
      amountOut: '1.95',
    }),
    getLiquidity: jest.fn().mockResolvedValue({
      token0Reserves: '800000',
      token1Reserves: '800',
      totalLiquidityUSD: 1600000,
    }),
  })),
}));

jest.mock('@/utils/blockchain', () => ({
  blockchain: {
    getCurrentProvider: jest.fn().mockReturnValue({}),
  },
}));

jest.mock('@/utils/dex', () => ({
  availableDEXes: [
    { id: 'uniswap-v2', name: 'Uniswap V2', active: true, logo: '' },
    { id: 'sushiswap', name: 'SushiSwap', active: true, logo: '' },
  ],
}));

describe('DEXManager', () => {
  const [tokenA, tokenB] = mockTokens;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get all adapters', () => {
    const adapters = dexManager.getAllAdapters();
    expect(adapters.length).toBeGreaterThan(0);
  });

  it('should get active adapters', () => {
    const adapters = dexManager.getActiveAdapters();
    expect(adapters.length).toBeGreaterThan(0);
  });

  it('should get an adapter by ID', () => {
    const adapter = dexManager.getAdapter('uniswap-v2');
    expect(adapter).toBeDefined();
    expect(adapter?.getDexId()).toBe('uniswap-v2');
  });

  it('should find the best price for a token pair', async () => {
    const result = await dexManager.getBestPrice(tokenA, tokenB);
    expect(result).toEqual({
      price: 2000,
      dexId: 'uniswap-v2',
      dexName: expect.any(String),
    });
  });

  it('should find the best trade route', async () => {
    const route = await dexManager.findBestTradeRoute(tokenA, tokenB, '1.0');
    expect(route).toMatchObject({
      dexId: expect.any(String),
      amountIn: '1.0',
      expectedAmountOut: expect.any(String),
      priceImpact: expect.any(Number),
    });
  });

  it('should execute a swap on a specific DEX', async () => {
    const result = await dexManager.executeSwap(
      'uniswap-v2',
      tokenA,
      tokenB,
      '1.0',
      { slippageTolerance: 0.5, deadline: 20 }
    );
    
    expect(result).toEqual({
      success: true,
      transactionHash: '0xtx1',
      amountOut: '1.96',
    });
  });

  it('should execute the best swap', async () => {
    const result = await dexManager.executeBestSwap(
      tokenA,
      tokenB,
      '1.0',
      { slippageTolerance: 0.5, deadline: 20 }
    );
    
    expect(result).toEqual({
      success: true,
      dexId: expect.any(String),
      transactionHash: expect.any(String),
      amountOut: expect.any(String),
    });
  });
});
