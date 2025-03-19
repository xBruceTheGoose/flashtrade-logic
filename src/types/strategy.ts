import { BigNumber } from 'ethers';

export interface UserPreferences {
  riskTolerance: number; // 0-1, where 1 is highest risk tolerance
  minProfitThreshold: BigNumber;
  maxSlippage: number;
  gasOptimizationPriority: number; // 0-1, where 1 is highest priority
  tradeSizePreference: 'small' | 'medium' | 'large';
  networkPreferences: string[]; // List of preferred networks
}

export interface NetworkState {
  averageGasPrice: BigNumber;
  blockTime: number;
  congestionLevel: number; // 0-1, where 1 is most congested
  lastBlockTimestamp: number;
  pendingTransactions: number;
}

export interface MarketConditions {
  volatility: number;
  volume24h: BigNumber;
  priceChange24h: number;
  liquidityDepth: {
    [dex: string]: {
      token0: BigNumber;
      token1: BigNumber;
      priceImpact: number;
    };
  };
  spreadAnalysis: {
    bestBid: BigNumber;
    bestAsk: BigNumber;
    averageSpread: number;
  };
}

export interface TradeHistory {
  timestamp: number;
  network: string;
  dex: string;
  tokenPair: [string, string];
  inputAmount: BigNumber;
  outputAmount: BigNumber;
  expectedOutput: BigNumber;
  actualSlippage: number;
  gasUsed: BigNumber;
  gasPrice: BigNumber;
  blockNumber: number;
  successful: boolean;
  profitLoss: BigNumber;
  executionTime: number;
  marketConditions: MarketConditions;
  networkState: NetworkState;
}

export interface OptimizationResult {
  recommendedTiming: {
    timestamp: number;
    confidence: number;
  };
  recommendedSize: {
    amount: BigNumber;
    confidence: number;
  };
  expectedMetrics: {
    projectedProfit: BigNumber;
    estimatedSlippage: number;
    gasEstimate: BigNumber;
    executionProbability: number;
  };
  riskAssessment: {
    riskScore: number; // 0-1, where 1 is highest risk
    confidenceInterval: [number, number];
    potentialDrawdown: number;
  };
}

export interface PerformanceMetrics {
  successRate: number;
  averageProfit: BigNumber;
  averageGasUsed: BigNumber;
  averageSlippage: number;
  profitConsistency: number; // Standard deviation of profits
  timeEfficiency: number; // Average execution time
  gasEfficiency: number; // Profit per gas used
  riskAdjustedReturn: number; // Sharpe ratio equivalent
}
