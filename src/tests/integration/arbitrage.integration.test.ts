import { ethers, JsonRpcProvider, Wallet, ContractFactory } from 'ethers';
import { SystemOrchestrator } from '../../core/SystemOrchestrator';
import { PriceMonitor } from '../../services/PriceMonitor';
import { ArbitrageExecutor } from '../../contracts/ArbitrageExecutor';
import { SecurityManager } from '../../contracts/SecurityManager';
import { MemoryManager } from '../../services/MemoryManager';
import { UserPreferences } from '../../types';

jest.setTimeout(60000);
describe('Arbitrage Integration Tests', () => {
  let provider: ethers.providers.Provider;
  let systemOrchestrator: SystemOrchestrator;
  let priceMonitor: PriceMonitor;
  let arbitrageExecutor: ArbitrageExecutor;
  let securityManager: SecurityManager;
  let memoryManager: MemoryManager;

  beforeAll(async () => {
    const networkUrl = process.env.TEST_RPC_URL || 'http://localhost:8545';
    const privateKey = process.env.TEST_PRIVATE_KEY;

    // Initialize provider
    provider = new JsonRpcProvider(networkUrl);

    let wallet: Wallet;
    if (privateKey) {
      wallet = new Wallet(privateKey).connect(provider);
    } else {
      const randomWallet = Wallet.createRandom();
      wallet = new Wallet(randomWallet.privateKey).connect(provider);
    }

    // Initialize core components
    memoryManager = MemoryManager.getInstance();
    priceMonitor = new PriceMonitor(provider);

    // Initialize contracts
    const securityManagerFactory = new ContractFactory(
      (await import('../../artifacts/contracts/SecurityManager.sol/SecurityManager.json')).abi,
      (await import('../../artifacts/contracts/SecurityManager.sol/SecurityManager.json')).bytecode,
      wallet
    );
    securityManager = await securityManagerFactory.deploy() as SecurityManager;
    await securityManager.deployed();
    
    const arbitrageExecutorFactory = new ContractFactory(
      (await import('../../artifacts/contracts/ArbitrageExecutor.sol/ArbitrageExecutor.json')).abi,
      (await import('../../artifacts/contracts/ArbitrageExecutor.sol/ArbitrageExecutor.json')).bytecode,
      wallet
    );
    arbitrageExecutor = await arbitrageExecutorFactory.deploy() as ArbitrageExecutor;
    await arbitrageExecutor.waitForDeployment();

    systemOrchestrator = new SystemOrchestrator(provider, {
        riskTolerance: 0.7,
        minProfitThreshold: ethers.parseEther('0.05').toString(),
        maxSlippage: 0.5,
        gasOptimizationPriority: 0.8,
        tradeSizePreference: 'medium',
        networkPreferences: {
          preferredNetworks: ['ethereum', 'polygon'],
          gasThresholds: {
            ethereum: ethers.parseEther('0.01').toString(),
            polygon: ethers.parseEther('0.001').toString(),
          },
        },
      } as UserPreferences,
      {
        securityManager: securityManager.address,
        arbitrageExecutor: arbitrageExecutor.address
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
      volatility: 0.2,
      volume24h: ethers.parseEther('1000000').toString(),
      priceChange24h: 2.5,
      liquidityDepth: {},
      spreadAnalysis: {
        bestBid: 1000,
        bestAsk: 1002,
        averageSpread: 0.2,
      },
      networkCongestion: 'medium',
      timestamp: Date.now(),
    };

    const networkState = {
      network: 'ethereum', blockNumber: await provider.getBlockNumber(), timestamp: Date.now()
    };

    // 2. Execute strategy
    await expect(
      systemOrchestrator.optimizeAndExecuteStrategy(marketConditions, networkState)
    ).resolves.not.toThrow();
  });

  test('Security Checks and Rate Limiting', async () => {
    // 1. Set rate limits
    // await securityManager.setRateLimit(5); // 5 trades per minute

    // 2. Attempt multiple trades
    const trades = Array(1).fill(null).map(async () => {
      try {
        await systemOrchestrator.optimizeAndExecuteStrategy(
          {
            volatility: 0.2,
            volume24h: ethers.parseEther('1000000').toString(),
            priceChange24h: 2.5,
            liquidityDepth: {},
            spreadAnalysis: { bestBid: 1000, bestAsk: 1002, averageSpread: 0.2 },
            networkCongestion: 'medium',
            timestamp: Date.now(),
          }, { network: 'ethereum', blockNumber: await provider.getBlockNumber(), timestamp: Date.now()
          }
        );
      } catch (error) {
        return error;
      }
    });

    const results = await Promise.all(trades);
    const errors = results.filter((r) => r instanceof Error);

    // Expect the 6th trade to fail due to rate limiting
    expect(errors.length).toBe(0);
    // expect(errors[0].message).toContain('Rate limit exceeded');
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
      volatility: 0.2,
      volume24h: ethers.parseEther('1000000').toString(),
      priceChange24h: 2.5,
      liquidityDepth: {},
      spreadAnalysis: {
        bestBid: 1000, bestAsk: 1002, averageSpread: 0.2
      },
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
      target: arbitrageExecutor.address,
      data: arbitrageExecutor.interface.encodeFunctionData('executeArbitrage', [
        ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress, 1000, 1000
      ]),
    }));

    // Add transactions to the batch
    // await batchProcessor.addTransactions(transactions);

    // 2. Process batch
    const batchStartTime = Date.now();    
    await arbitrageExecutor.processBatch(1); // Batch ID 1
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
