
import { priceMonitoringService } from '../PriceMonitorService';
import { monitoringConfig } from '../config';
import { opportunityManager } from '../opportunityManager';
import { arbitrageScanner } from '../scanner';
import { wsConnector } from '../wsConnector';
import { webSocketManager } from '../ws';
import { blockchain } from '@/utils/blockchain';
import { availableDEXes } from '@/utils/dex';
import { toast } from '@/hooks/use-toast';

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

// Mock setInterval and clearInterval
const mockSetInterval = jest.spyOn(global, 'setInterval');
mockSetInterval.mockImplementation((fn, ms) => 123 as unknown as NodeJS.Timeout);

const mockClearInterval = jest.spyOn(global, 'clearInterval');
mockClearInterval.mockImplementation(jest.fn());

describe('PriceMonitoringService', () => {
  const mockTokenA = {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
  };
  
  const mockTokenB = {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    priceMonitoringService.stopMonitoring();
    priceMonitoringService.clearMonitoredPairs();
  });

  it('should start monitoring', async () => {
    const result = await priceMonitoringService.startMonitoring();
    
    expect(result).toBe(true);
    expect(wsConnector.connectToDexes).toHaveBeenCalled();
    expect(mockSetInterval).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Price Monitoring Started' })
    );
  });

  it('should stop monitoring', () => {
    priceMonitoringService.startMonitoring();
    priceMonitoringService.stopMonitoring();
    
    expect(mockClearInterval).toHaveBeenCalled();
    expect(webSocketManager.disconnectAll).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Price Monitoring Stopped' })
    );
  });

  it('should add and remove token pairs', () => {
    const result = priceMonitoringService.addPairToMonitor(mockTokenA, mockTokenB);
    expect(result).toBe(true);
    
    const pairs = priceMonitoringService.getMonitoredPairs();
    expect(pairs.length).toBe(1);
    expect(pairs[0].tokenA).toEqual(mockTokenA);
    expect(pairs[0].tokenB).toEqual(mockTokenB);
    
    // Try to add the same pair again
    const result2 = priceMonitoringService.addPairToMonitor(mockTokenA, mockTokenB);
    expect(result2).toBe(false);
    
    // Remove the pair
    const removed = priceMonitoringService.removePairFromMonitor(mockTokenA, mockTokenB);
    expect(removed).toBe(true);
    expect(priceMonitoringService.getMonitoredPairs().length).toBe(0);
    
    // Clear pairs
    priceMonitoringService.addPairToMonitor(mockTokenA, mockTokenB);
    priceMonitoringService.clearMonitoredPairs();
    expect(priceMonitoringService.getMonitoredPairs().length).toBe(0);
  });

  it('should force scan for arbitrage opportunities', async () => {
    await priceMonitoringService.forceScanForArbitrageOpportunities();
    expect(arbitrageScanner.scanForOpportunities).toHaveBeenCalled();
    expect(opportunityManager.getPendingOpportunities).toHaveBeenCalled();
  });
});
