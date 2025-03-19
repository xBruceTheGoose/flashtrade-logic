import { JsonRpcProvider, parseEther, Wallet } from 'ethers';
import { BigNumber } from 'bignumber.js';
import { SystemOrchestrator } from '../../core/SystemOrchestrator';
import { MemoryManager } from '../../services/MemoryManager';
import { PriceMonitor } from '../../services/PriceMonitor';
import { Transaction, UserPreferences, MarketConditions, NetworkState } from '../../types';
import '@types/node';

export interface TestContext {
  provider: JsonRpcProvider;
  wallet: Wallet;
  systemOrchestrator: SystemOrchestrator;
  priceMonitor: PriceMonitor;
  memoryManager: MemoryManager;
}

export interface TestConfig {
  networkUrl?: string;
  privateKey?: string;
  userPreferences?: Partial<UserPreferences>;
  contracts?: {
    securityManager?: string;
    arbitrageExecutor?: string;
  };
}

export class IntegrationTest {
  protected context: TestContext;
  protected transactions: Transaction[] = [];
  private testConfig: TestConfig;

  constructor(config: TestConfig = {}) {
    this.testConfig = {
      networkUrl: process.env.TEST_RPC_URL || 'http://localhost:8545',
      privateKey: process.env.TEST_PRIVATE_KEY,
      ...config
    };
  }

  async setup(): Promise<void> {
    const provider = new JsonRpcProvider(this.testConfig.networkUrl);
    let wallet: Wallet;
    
    if (this.testConfig.privateKey) {
      wallet = new Wallet(this.testConfig.privateKey).connect(provider);
    } else {
      const randomWallet = Wallet.createRandom();
      wallet = new Wallet(randomWallet.privateKey).connect(provider);
    }

    const memoryManager = MemoryManager.getInstance();
    const priceMonitor = new PriceMonitor(provider);

    const defaultPreferences: UserPreferences = {
      riskTolerance: 0.7,
      minProfitThreshold: parseEther('0.05').toString(),
      maxSlippage: 0.5,
      gasOptimizationPriority: 0.8,
      tradeSizePreference: 'medium',
      networkPreferences: {
        preferredNetworks: ['ethereum', 'polygon'],
        gasThresholds: {
          ethereum: parseEther('0.01').toString(),
          polygon: parseEther('0.001').toString()
        }
      }
    };

    const systemOrchestrator = new SystemOrchestrator(
      provider,
      {
        ...defaultPreferences,
        ...this.testConfig.userPreferences
      },
      {
        securityManager: this.testConfig.contracts?.securityManager || process.env.SECURITY_MANAGER_ADDRESS!,
        arbitrageExecutor: this.testConfig.contracts?.arbitrageExecutor || process.env.ARBITRAGE_EXECUTOR_ADDRESS!
      }
    );

    await systemOrchestrator.initialize();

    this.context = {
      provider,
      wallet,
      systemOrchestrator,
      priceMonitor,
      memoryManager
    };
  }

  async teardown(): Promise<void> {
    this.context.memoryManager.dispose();
    this.transactions = [];
  }

  public async createMarketConditions(overrides: Partial<MarketConditions> = {}): Promise<MarketConditions> {
    const defaultLiquidityDepth = {
      'uniswap': {
        token0: new BigNumber('1000000'),
        token1: new BigNumber('1000000'),
        priceImpact: 0.01
      },
      'sushiswap': {
        token0: new BigNumber('800000'),
        token1: new BigNumber('800000'),
        priceImpact: 0.015
      }
    };

    return {
      volatility: 0.2,
      volume24h: parseEther('1000000').toString(),
      priceChange24h: 2.5,
      liquidityDepth: defaultLiquidityDepth,
      spreadAnalysis: {
        bestBid: new BigNumber('1000'),
        bestAsk: new BigNumber('1002'),
        averageSpread: 0.2
      },
      networkCongestion: 'medium',
      timestamp: Date.now(),
      ...overrides
    };
  }

  public async createNetworkState(overrides: Partial<NetworkState> = {}): Promise<NetworkState> {
    const block = await this.context.provider.getBlock('latest');
    const gasPrice = await this.context.provider.getFeeData();

    return {
      network: 'ethereum',
      blockNumber: block?.number || 0,
      timestamp: Date.now(),
      averageGasPrice: gasPrice.gasPrice?.toString() || '0',
      blockTime: 15, // Average Ethereum block time in seconds
      congestionLevel: 50, // Default medium congestion (0-100 scale)
      lastBlockTimestamp: block?.timestamp || 0,
      pendingTransactions: 0, // Would need mempool access for accurate count
      ...overrides
    };
  }

  protected async executeTransaction(tx: Promise<any>): Promise<Transaction> {
    try {
      const result = await tx;
      const receipt = await result.wait();
      
      const transaction: Transaction = {
        id: receipt.hash,
        hash: receipt.hash,
        type: 'arbitrage',
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        timestamp: Date.now(),
        value: receipt.value?.toString() || '0',
        gasUsed: receipt.gasUsed?.toString(),
        from: receipt.from,
        to: receipt.to,
        details: receipt
      };

      this.transactions.push(transaction);
      return transaction;
    } catch (error) {
      const failedTx: Transaction = {
        id: 'failed-' + Date.now(),
        hash: '',
        type: 'arbitrage',
        status: 'failed',
        timestamp: Date.now(),
        value: '0',
        from: this.context.wallet.address,
        to: '',
        details: error
      };

      this.transactions.push(failedTx);
      throw error;
    }
  }

  protected async waitForBalance(address: string, expectedBalance: bigint): Promise<void> {
    let attempts = 0;
    const maxAttempts = 10;
    const delay = 1000; // 1 second

    while (attempts < maxAttempts) {
      const balance = await this.context.provider.getBalance(address);
      if (balance >= expectedBalance) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      attempts++;
    }

    throw new Error(`Balance check timeout: Expected ${expectedBalance}, got ${await this.context.provider.getBalance(address)}`);
  }

  public getTransactions(): Transaction[] {
    return [...this.transactions];
  }

  public async getTransactionCount(): Promise<number> {
    return this.transactions.length;
  }

  public async getSuccessfulTransactions(): Promise<Transaction[]> {
    return this.transactions.filter(tx => tx.status === 'confirmed');
  }

  public async getFailedTransactions(): Promise<Transaction[]> {
    return this.transactions.filter(tx => tx.status === 'failed');
  }

  public getContext(): TestContext {
    return this.context;
  }
}
