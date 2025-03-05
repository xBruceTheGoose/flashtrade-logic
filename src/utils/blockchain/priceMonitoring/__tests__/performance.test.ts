
import { priceMonitoringService } from '../PriceMonitorService';
import { opportunityManager } from '../opportunityManager';
import { arbitrageScanner } from '../scanner';

// Set timeout to a larger value for performance tests
jest.setTimeout(30000);

// Mock dependencies
jest.mock('../opportunityManager', () => ({
  opportunityManager: {
    getPendingOpportunities: jest.fn().mockReturnValue([]),
    getOpportunity: jest.fn(),
    executeOpportunity: jest.fn(),
  },
}));

jest.mock('../scanner', () => ({
  arbitrageScanner: {
    shouldScan: jest.fn().mockReturnValue(true),
    scanForOpportunities: jest.fn(),
    getLastScanTime: jest.fn().mockReturnValue(Date.now()),
  },
}));

jest.mock('../wsConnector', () => ({
  wsConnector: {
    connectToDexes: jest.fn(),
    subscribeTokenPairs: jest.fn(),
  },
}));

jest.mock('../ws', () => ({
  webSocketManager: {
    disconnectAll: jest.fn(),
  },
}));

jest.mock('@/utils/blockchain', () => ({
  blockchain: {
    getCurrentProvider: jest.fn().mockReturnValue({
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1, name: 'mainnet' }),
    }),
  },
}));

jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn(),
}));

jest.mock('@/utils/dex', () => ({
  availableDEXes: [
    { id: 'uniswap-v2', name: 'Uniswap V2', active: true, logo: '' },
    { id: 'sushiswap', name: 'SushiSwap', active: true, logo: '' },
  ],
}));

// Mock setTimeout and performance.now
const originalSetTimeout = global.setTimeout;
const mockPerformanceNow = jest.spyOn(global.performance, 'now');

describe('Price Monitoring Performance', () => {
  const mockTokens = [
    {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
    },
    {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
    {
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    priceMonitoringService.stopMonitoring();
    priceMonitoringService.clearMonitoredPairs();
  });

  afterAll(() => {
    global.setTimeout = originalSetTimeout;
  });

  it('should measure performance when adding multiple token pairs', () => {
    const startTime = performance.now();
    
    // Add all combinations of token pairs
    for (let i = 0; i < mockTokens.length; i++) {
      for (let j = i + 1; j < mockTokens.length; j++) {
        priceMonitoringService.addPairToMonitor(mockTokens[i], mockTokens[j]);
      }
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`Adding ${mockTokens.length * (mockTokens.length - 1) / 2} token pairs took ${duration}ms`);
    expect(duration).toBeLessThan(500); // Should be very fast
    
    // Check that all pairs were added
    const pairs = priceMonitoringService.getMonitoredPairs();
    expect(pairs.length).toBe(mockTokens.length * (mockTokens.length - 1) / 2);
  });

  it('should measure scanning performance', async () => {
    // Add token pairs first
    for (let i = 0; i < mockTokens.length; i++) {
      for (let j = i + 1; j < mockTokens.length; j++) {
        priceMonitoringService.addPairToMonitor(mockTokens[i], mockTokens[j]);
      }
    }
    
    const startTime = performance.now();
    
    await priceMonitoringService.forceScanForArbitrageOpportunities();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`Scanning for arbitrage opportunities took ${duration}ms`);
    expect(duration).toBeLessThan(3000); // Should be reasonably fast
    expect(arbitrageScanner.scanForOpportunities).toHaveBeenCalled();
  });

  it('should measure startup performance', async () => {
    // Add token pairs first
    for (let i = 0; i < mockTokens.length; i++) {
      for (let j = i + 1; j < mockTokens.length; j++) {
        priceMonitoringService.addPairToMonitor(mockTokens[i], mockTokens[j]);
      }
    }
    
    const startTime = performance.now();
    
    await priceMonitoringService.startMonitoring();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`Starting monitoring with ${priceMonitoringService.getMonitoredPairs().length} pairs took ${duration}ms`);
    expect(duration).toBeLessThan(2000); // Should be reasonably fast
    
    // Clean up
    priceMonitoringService.stopMonitoring();
  });
});
