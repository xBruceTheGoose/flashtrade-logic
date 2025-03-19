import { JsonRpcProvider, parseEther } from 'ethers';
import { PerformanceTest } from './PerformanceTest';
import { ArbitrageOpportunity, DEX, Token, MarketConditions, NetworkState, UserPreferences } from '../../types';
import { SystemOrchestrator } from '../../core/SystemOrchestrator';
import '@types/node';

describe('Arbitrage Performance Tests', () => {
  let performanceTest: PerformanceTest;
  let provider: JsonRpcProvider;
  let systemOrchestrator: SystemOrchestrator;

  const mockToken: Token = {
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test Token',
    symbol: 'TEST',
    decimals: 18,
    chainId: 1
  };

  const mockDex: DEX = {
    id: 'test-dex',
    name: 'Test DEX',
    active: true,
    supportedChainIds: [1]
  };

  const mockOpportunity: ArbitrageOpportunity = {
    id: 'test-opportunity',
    sourceDex: mockDex,
    targetDex: mockDex,
    tokenIn: mockToken,
    tokenOut: mockToken,
    profitPercentage: 1.5,
    estimatedProfit: parseEther('0.1').toString(),
    gasEstimate: '500000',
    timestamp: Date.now(),
    status: 'pending',
    confidenceScore: 85,
    riskLevel: 'low'
  };

  const mockMarketConditions: MarketConditions = {
    volatility: 0.2,
    volume24h: parseEther('1000000').toString(),
    priceChange24h: 2.5,
    liquidityDepth: parseEther('5000000').toString(),
    spreadAnalysis: {
      averageSpread: 0.1,
      volatilityImpact: 0.05,
      trendAnalysis: 'stable'
    },
    networkCongestion: 'medium',
    timestamp: Date.now()
  };

  const mockNetworkState: NetworkState = {
    network: 'ethereum',
    blockNumber: 1000000,
    timestamp: Date.now()
  };

  const mockPreferences: UserPreferences = {
    riskTolerance: 0.7,
    minProfitThreshold: parseEther('0.05').toString(),
    maxSlippage: 0.5,
    gasOptimizationPriority: 0.8,
    tradeSizePreference: {
      min: parseEther('0.1').toString(),
      max: parseEther('10').toString(),
      default: parseEther('1').toString()
    },
    networkPreferences: {
      preferredNetworks: ['ethereum', 'polygon'],
      gasThresholds: {
        ethereum: parseEther('0.01').toString(),
        polygon: parseEther('0.001').toString()
      }
    }
  };

  beforeAll(async () => {
    provider = new JsonRpcProvider(process.env.TEST_RPC_URL);
    performanceTest = new PerformanceTest(provider);
    
    systemOrchestrator = new SystemOrchestrator(
      provider,
      mockPreferences,
      {
        securityManager: process.env.SECURITY_MANAGER_ADDRESS!,
        arbitrageExecutor: process.env.ARBITRAGE_EXECUTOR_ADDRESS!
      }
    );
    
    await systemOrchestrator.initialize();
  });

  test('Opportunity Detection Performance', async () => {
    const testCase = {
      name: 'Arbitrage Opportunity Detection',
      execute: async () => {
        await systemOrchestrator.optimizeAndExecuteStrategy(
          mockMarketConditions,
          mockNetworkState
        );
      },
      iterations: 10,
      concurrentUsers: 5
    };

    const metrics = await performanceTest.runTest(testCase);
    
    // Performance assertions
    expect(metrics.executionTime).toBeLessThan(5000); // 5 seconds max
    expect(metrics.successRate).toBeGreaterThan(95); // 95% success rate
    expect(metrics.averageLatency).toBeLessThan(2000); // 2 seconds max latency
  });

  test('Batch Transaction Processing Performance', async () => {
    const testCase = {
      name: 'Batch Transaction Processing',
      execute: async () => {
        const opportunities: ArbitrageOpportunity[] = Array(10)
          .fill(mockOpportunity)
          .map((opp, i) => ({
            ...opp,
            id: `test-opportunity-${i}`,
            estimatedProfit: parseEther((0.1 * (i + 1)).toString()).toString()
          }));

        for (const opportunity of opportunities) {
          await systemOrchestrator.optimizeAndExecuteStrategy(
            mockMarketConditions,
            mockNetworkState
          );
        }
      },
      iterations: 5,
      concurrentUsers: 3
    };

    const metrics = await performanceTest.runTest(testCase);
    
    // Performance assertions
    expect(metrics.executionTime).toBeLessThan(15000); // 15 seconds max
    expect(metrics.successRate).toBeGreaterThan(90); // 90% success rate
    expect(metrics.memoryUsage.peak).toBeLessThan(1024 * 1024 * 512); // 512MB max
  });

  test('Memory Management Under Load', async () => {
    const testCase = {
      name: 'Memory Management',
      execute: async () => {
        // Simulate heavy memory usage
        const largeDataSet = Array(10000).fill(mockOpportunity).map((opp, i) => ({
          ...opp,
          id: `test-opportunity-${i}`,
          timestamp: Date.now() + i
        }));

        for (let i = 0; i < 100; i++) {
          await systemOrchestrator.optimizeAndExecuteStrategy(
            mockMarketConditions,
            mockNetworkState
          );
        }
      },
      iterations: 3,
      concurrentUsers: 2
    };

    const metrics = await performanceTest.runTest(testCase);
    
    // Performance assertions
    expect(metrics.memoryUsage.peak).toBeLessThan(1024 * 1024 * 1024); // 1GB max
    expect(metrics.memoryUsage.after - metrics.memoryUsage.before)
      .toBeLessThan(1024 * 1024 * 100); // Max 100MB memory growth
  });
});
