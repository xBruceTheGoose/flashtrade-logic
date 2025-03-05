
import { scanForArbitrageOpportunities, executeArbitrage } from '@/utils/arbitrage';
import { mockDexes, mockTokens } from '@/test/mocks/dex';
import { blockchain } from '@/utils/blockchain';
import { flashloanService } from '@/utils/flashloan';
import { arbitrageExecutorService } from '@/utils/contracts/arbitrageExecutor';

// Set timeout to a larger value for E2E tests
jest.setTimeout(30000);

// Mock blockchain
jest.mock('@/utils/blockchain', () => ({
  blockchain: {
    getCurrentProvider: jest.fn().mockReturnValue({
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
    }),
    getSigner: jest.fn().mockReturnValue({
      getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
    }),
    isWalletConnected: jest.fn().mockReturnValue(true),
  },
}));

// Mock flashloan service
jest.mock('@/utils/flashloan', () => ({
  flashloanService: {
    calculateArbitrageProfitability: jest.fn().mockResolvedValue({
      isProfitable: true,
      netProfit: '0.02 ETH',
      feeAmount: '0.01 ETH',
      bestProvider: 'aave',
    }),
    executeFlashloan: jest.fn().mockResolvedValue({
      success: true,
      transactionHash: '0xmockflashloantx',
    }),
  },
}));

// Mock arbitrage executor service
jest.mock('@/utils/contracts/arbitrageExecutor', () => ({
  arbitrageExecutorService: {
    isUserAuthorized: jest.fn().mockResolvedValue(true),
    executeArbitrage: jest.fn().mockImplementation(() => Promise.resolve({
      success: true,
      transactionHash: '0xmockarbitragetx',
    })),
  },
}));

// Mock findArbitrageOpportunities
jest.mock('@/utils/dex', () => ({
  findArbitrageOpportunities: jest.fn().mockResolvedValue({
    hasOpportunity: true,
    profitPercentage: 2.5,
  }),
  availableDEXes: [
    { id: 'uniswap-v2', name: 'Uniswap V2', active: true, logo: '', supportedChainIds: [1, 4, 5] },
    { id: 'sushiswap', name: 'SushiSwap', active: true, logo: '', supportedChainIds: [1, 4, 5] },
  ]
}));

// Mock toast
jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn(),
}));

describe('Arbitrage End-to-End Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should scan for opportunities and execute trades', async () => {
    // 1. Scan for opportunities
    const opportunities = await scanForArbitrageOpportunities(mockDexes, mockTokens);
    
    // Should find opportunities
    expect(opportunities.length).toBeGreaterThan(0);
    expect(opportunities[0]).toMatchObject({
      id: expect.any(String),
      sourceDex: expect.any(Object),
      targetDex: expect.any(Object),
      tokenIn: expect.any(Object),
      tokenOut: expect.any(Object),
      profitPercentage: expect.any(Number),
      estimatedProfit: expect.any(String),
      gasEstimate: expect.any(String),
      tradeSize: expect.any(String),
      timestamp: expect.any(Number),
      status: 'pending',
    });
    
    // 2. Execute the first opportunity
    const result = await executeArbitrage(opportunities[0]);
    
    // Should be successful
    expect(result).toEqual({
      success: true,
      txHash: expect.any(String),
    });
    
    // Should have called the arbitrage executor
    expect(arbitrageExecutorService.executeArbitrage).toHaveBeenCalledWith(
      opportunities[0].sourceDex,
      opportunities[0].targetDex,
      opportunities[0].tokenIn,
      opportunities[0].tokenOut,
      opportunities[0].tradeSize,
      opportunities[0].estimatedProfit,
      expect.any(Boolean)
    );
  });

  it('should handle errors during execution', async () => {
    // Mock failure for this test only
    (arbitrageExecutorService.executeArbitrage as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        success: false,
        error: 'Execution failed due to price movement',
      })
    );
    
    // 1. Scan for opportunities
    const opportunities = await scanForArbitrageOpportunities(mockDexes, mockTokens);
    
    // 2. Execute the first opportunity
    const result = await executeArbitrage(opportunities[0]);
    
    // Should report failure
    expect(result).toEqual({
      success: false,
      error: 'Execution failed due to price movement',
    });
  });
  
  it('should handle wallet not connected', async () => {
    // Mock wallet not connected for this test only
    (blockchain.isWalletConnected as jest.Mock).mockImplementationOnce(() => false);
    
    // 1. Scan for opportunities
    const opportunities = await scanForArbitrageOpportunities(mockDexes, mockTokens);
    
    // 2. Execute the first opportunity
    const result = await executeArbitrage(opportunities[0]);
    
    // Should report failure
    expect(result).toEqual({
      success: false,
      error: 'Wallet not connected. Please connect your wallet first.',
    });
  });
});
