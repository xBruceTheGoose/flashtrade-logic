
import { blockchain } from '../service';
import { ethers } from 'ethers';

// Mock ethers
jest.mock('ethers', () => {
  const original = jest.requireActual('ethers');
  return {
    ...original,
    providers: {
      ...original.providers,
      JsonRpcProvider: jest.fn().mockImplementation(() => ({
        getNetwork: jest.fn().mockResolvedValue({ chainId: 1, name: 'mainnet' }),
        getBalance: jest.fn().mockResolvedValue(ethers.BigNumber.from('10000000000000000000')),
      })),
    },
    Contract: jest.fn().mockImplementation(() => ({
      balanceOf: jest.fn().mockResolvedValue(ethers.BigNumber.from('100000000000000000000')),
      allowance: jest.fn().mockResolvedValue(ethers.BigNumber.from('50000000000000000000')),
      decimals: jest.fn().mockResolvedValue(18),
    })),
  };
});

describe('BlockchainService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get provider for a specific chain', () => {
    const provider = blockchain.getProvider(1);
    expect(provider).toBeDefined();
    expect(ethers.providers.JsonRpcProvider).toHaveBeenCalled();
  });

  it('should get the current provider', () => {
    const provider = blockchain.getCurrentProvider();
    expect(provider).toBeDefined();
  });

  it('should get network configuration by chain ID', () => {
    const network = blockchain.getNetworkConfig(1);
    expect(network).toBeDefined();
    expect(network.id).toBe(1);
  });

  it('should throw error for unsupported network', () => {
    expect(() => blockchain.getNetworkConfig(999)).toThrow('Unsupported network with chain ID: 999');
  });

  it('should get token balance', async () => {
    const balance = await blockchain.getTokenBalance(
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      '0x1234567890123456789012345678901234567890',
      18
    );
    expect(balance).toBe('100.0');
  });
});
