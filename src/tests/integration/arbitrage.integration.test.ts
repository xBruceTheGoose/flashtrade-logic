import { ethers } from 'ethers';
import { SystemOrchestrator } from '../../core/SystemOrchestrator';
import { PriceMonitor } from '../../services/PriceMonitor';
import { BatchProcessor } from '../../contracts/BatchProcessor';
import { SecurityManager } from '../../contracts/security/SecurityManager';
import { ErrorHandler } from '../../core/ErrorHandler';
import { MemoryManager } from '../../services/MemoryManager';

describe('Arbitrage Integration Tests', () => {
  let provider: ethers.providers.Provider;
  let systemOrchestrator: SystemOrchestrator;
  let priceMonitor: PriceMonitor;
  let batchProcessor: BatchProcessor;
  let securityManager: SecurityManager;
  let memoryManager: MemoryManager;

  beforeAll(async () => {
    // Initialize provider
    provider = new ethers.providers.JsonRpcProvider(process.env.TEST_RPC_URL);
    
    // Initialize core components
    memoryManager = MemoryManager.getInstance();
    priceMonitor = new PriceMonitor(provider);
    
    // Initialize contracts
    const securityManagerFactory = await ethers.getContractFactory('SecurityManager');
    securityManager = await securityManagerFactory.deploy();
    await securityManager.deployed();

    const batchProcessorFactory = await ethers.getContractFactory('BatchProcessor');
    batchProcessor = await batchProcessorFactory.deploy();
    await batchProcessor.deployed();

    // Initialize system orchestrator
    systemOrchestrator = new SystemOrchestrator(
      provider,
      {
        riskTolerance: 0.7,
        minProfitThreshold: ethers.utils.parseEther('0.05'),
        maxSlippage: 0.5,
        gasOptimizationPriority: 0.8
      },
      {
        securityManager: securityManager.address,
        arbitrageExecutor: batchProcessor.address
      }
    );

    await systemOrchestrator.initialize();
  });

  afterAll(async () => {
    memoryManager.dispose();
  });

  test('Complete Arbitrage Flow', async () => {
    // 1. Setup market conditions
    const marketConditions = {
      gasPrice: ethers.utils.parseUnits('50', 'gwei'),
      networkCongestion: 'medium',
      timestamp: Date.now()
    };

    const networkState = {
      network: 'ethereum',
      blockNumber: await provider.getBlockNumber(),
      timestamp: Date.now()
    };

    // 2. Execute strategy
    await expect(
      systemOrchestrator.optimizeAndExecuteStrategy(marketConditions, networkState)
    ).resolves.not.toThrow();
  });

  test('Security Checks and Rate Limiting', async () => {
    // 1. Set rate limits
    await securityManager.setRateLimit(5); // 5 trades per minute
    
    // 2. Attempt multiple trades
    const trades = Array(6).fill(null).map(async () => {
      try {
        await systemOrchestrator.optimizeAndExecuteStrategy(
          {
            gasPrice: ethers.utils.parseUnits('50', 'gwei'),
            networkCongestion: 'medium',
            timestamp: Date.now()
          },
          {
            network: 'ethereum',
            blockNumber: await provider.getBlockNumber(),
            timestamp: Date.now()
          }
        );
      } catch (error) {
        return error;
      }
    });

    const results = await Promise.all(trades);
    const errors = results.filter(r => r instanceof Error);
    
    // Expect the 6th trade to fail due to rate limiting
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain('Rate limit exceeded');
  });

  test('Error Handling and Recovery', async () => {
    // 1. Force an error by setting invalid gas price
    const invalidMarketConditions = {
      gasPrice: ethers.utils.parseUnits('999999', 'gwei'), // Unrealistic gas price
      networkCongestion: 'high',
      timestamp: Date.now()
    };

    const networkState = {
      network: 'ethereum',
      blockNumber: await provider.getBlockNumber(),
      timestamp: Date.now()
    };

    // 2. Attempt trade with invalid conditions
    const errorPromise = systemOrchestrator.optimizeAndExecuteStrategy(
      invalidMarketConditions,
      networkState
    );

    // 3. Verify error is handled properly
    await expect(errorPromise).rejects.toThrow();
    
    // 4. Verify system can recover
    const validMarketConditions = {
      gasPrice: ethers.utils.parseUnits('50', 'gwei'),
      networkCongestion: 'medium',
      timestamp: Date.now()
    };

    await expect(
      systemOrchestrator.optimizeAndExecuteStrategy(validMarketConditions, networkState)
    ).resolves.not.toThrow();
  });

  test('Memory Management and Resource Cleanup', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // 1. Create memory pressure
    const largeData = Array(10000).fill({
      timestamp: Date.now(),
      data: Buffer.alloc(1024) // 1KB per item
    });

    // 2. Force cleanup
    await memoryManager.forceCleanup();
    
    // 3. Verify memory usage
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryDiff = finalMemory - initialMemory;
    
    // Memory difference should be reasonable
    expect(memoryDiff).toBeLessThan(1024 * 1024 * 50); // Less than 50MB growth
  });

  test('Batch Processing Optimization', async () => {
    // 1. Create multiple transactions
    const transactions = Array(10).fill(null).map((_, i) => ({
      target: batchProcessor.address,
      data: batchProcessor.interface.encodeFunctionData('addTransaction', [
        ethers.constants.AddressZero,
        '0x',
        500000,
        i
      ])
    }));

    // 2. Process batch
    const batchStartTime = Date.now();
    await batchProcessor.processBatch(1); // Batch ID 1
    const batchEndTime = Date.now();

    // 3. Verify batch processing time
    const processingTime = batchEndTime - batchStartTime;
    expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  test('Price Monitoring and Updates', async () => {
    // 1. Monitor price updates
    const priceUpdates: any[] = [];
    const unsubscribe = priceMonitor.subscribe('ETH/USDT', (update) => {
      priceUpdates.push(update);
    });

    // 2. Wait for price updates
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. Cleanup
    unsubscribe();

    // 4. Verify price monitoring
    expect(priceUpdates.length).toBeGreaterThan(0);
    priceUpdates.forEach(update => {
      expect(update).toHaveProperty('price');
      expect(update).toHaveProperty('timestamp');
    });
  });
});
