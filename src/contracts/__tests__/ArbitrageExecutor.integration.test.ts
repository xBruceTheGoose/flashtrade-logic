
import { ethers } from 'ethers';
import { arbitrageExecutorService } from '@/utils/contracts/arbitrageExecutor';
import { MockProvider, MockSigner } from '@/test/mocks/blockchain';
import { DEX, Token } from '@/types';

// Mock ethers
jest.mock('ethers', () => {
  const original = jest.requireActual('ethers');
  return {
    ...original,
    Contract: jest.fn().mockImplementation(() => ({
      authorizedUsers: jest.fn().mockResolvedValue(true),
      supportedTokens: jest.fn().mockResolvedValue(true),
      minProfitThreshold: jest.fn().mockResolvedValue(100),
      executeAaveArbitrage: jest.fn().mockResolvedValue({
        wait: jest.fn().mockResolvedValue({
          status: 1,
          transactionHash: '0xmockedarbitragetransaction',
        }),
      }),
      executeUniswapArbitrage: jest.fn().mockResolvedValue({
        wait: jest.fn().mockResolvedValue({
          status: 1,
          transactionHash: '0xmockedarbitragetransaction',
        }),
      }),
    })),
  };
});

// Mock blockchain service
jest.mock('@/utils/blockchain', () => ({
  blockchain: {
    getCurrentProvider: jest.fn().mockReturnValue(new MockProvider()),
    getSigner: jest.fn().mockReturnValue(new MockSigner()),
    isWalletConnected: jest.fn().mockReturnValue(true),
  },
}));

// Mock toast
jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn(),
}));

describe('ArbitrageExecutorService Integration', () => {
  const mockSourceDex: DEX = { 
    id: 'uniswap-v2', 
    name: 'Uniswap V2', 
    active: true, 
    logo: '',
    supportedChainIds: [1, 4, 5]
  };
  
  const mockTargetDex: DEX = { 
    id: 'sushiswap', 
    name: 'SushiSwap', 
    active: true, 
    logo: '',
    supportedChainIds: [1, 4, 5]
  };
  
  const mockToken: Token = {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    chainId: 1
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should check if user is authorized', async () => {
    const isAuthorized = await arbitrageExecutorService.isUserAuthorized();
    expect(isAuthorized).toBe(true);
  });

  it('should check if token is supported', async () => {
    const isSupported = await arbitrageExecutorService.isTokenSupported(mockToken.address);
    expect(isSupported).toBe(true);
  });

  it('should get minimum profit threshold', async () => {
    const threshold = await arbitrageExecutorService.getMinProfitThreshold();
    expect(threshold).toBe(100);
  });

  it('should execute arbitrage using Aave flashloan', async () => {
    const result = await arbitrageExecutorService.executeArbitrage(
      mockSourceDex,
      mockTargetDex,
      mockToken,
      mockToken,
      '1.0',
      '0.05',
      true
    );
    
    expect(result).toEqual({
      success: true,
      transactionHash: '0xmockedarbitragetransaction',
    });
  });

  it('should execute arbitrage using Uniswap flashloan', async () => {
    const result = await arbitrageExecutorService.executeArbitrage(
      mockSourceDex,
      mockTargetDex,
      mockToken,
      mockToken,
      '1.0',
      '0.05',
      false
    );
    
    expect(result).toEqual({
      success: true,
      transactionHash: '0xmockedarbitragetransaction',
    });
  });
});
