import { Address } from "viem";
import { BigNumber } from "bignumber.js";

declare global {
  // Add any global declarations here
}

// Wallet types
export type WalletType = 'metamask' | 'walletconnect' | 'coinbase' | null;

export interface Wallet {
  address: string;
  balance: string;
  chainId: number;
  connected: boolean;
  type: WalletType;
}

// For backward compatibility with existing code
export type WalletInfo = Wallet;

// Network types
export interface Network {
  id: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// Token types
export interface Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
  price?: number;
  balance?: string;
}

// DEX types
export interface DEX {
  id: string;
  name: string;
  logo?: string;
  icon?: string; // Added for backward compatibility
  active: boolean;
  supportedChainIds: number[];
  version?: string;
  factoryAddress?: string;
  routerAddress?: string;
  websocketUrl?: string;
}

// Arbitrage types
export interface ArbitrageOpportunity {
  id: string;
  timestamp: number;
  profitability: number;
  confidence: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  details: {
    marketConditions: MarketConditions;
    networkState: NetworkState;
    estimatedGasCost: string;
  };
}

export interface ExecutionResult {
  success: boolean;
  profit: number;
  transaction?: any;
}

// Market types
export interface MarketConditions {
  volatility: number;
  volume24h: string;
  priceChange24h: number;
  liquidityDepth: {
    [dex: string]: {
      token0: BigNumber;
      token1: BigNumber;
      priceImpact: number;
    };
  };
  spreadAnalysis: {
    averageSpread: number;
    bestBid: BigNumber;
    bestAsk: BigNumber;
  };
  networkCongestion: 'low' | 'medium' | 'high';
  timestamp: number;
}

export interface NetworkState {
  network: string;
  blockNumber: number;
  timestamp: number;
  averageGasPrice: string;
  blockTime: number;
  congestionLevel: number; // 0-100 scale
  lastBlockTimestamp: number;
  pendingTransactions: number;
}

export interface NetworkPreferences {
  preferredNetworks: string[];
  gasThresholds: Record<string, string>;
}

export interface UserPreferences {
  riskTolerance: number;
  minProfitThreshold: string;
  maxSlippage: number;
  gasOptimizationPriority: number;
  tradeSizePreference: 'small' | 'medium' | 'large';
  networkPreferences: NetworkPreferences;
}

// Transaction types
export interface Transaction {
  id: string;
  hash: string;
  type: 'swap' | 'approval' | 'flashloan' | 'arbitrage';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  value: string;
  gasUsed?: string;
  from: string;
  to: string;
  details?: any;
}

// Trade history types
export interface TradeHistory {
  timestamp: number;
  dex: string;
  tokenPair: {
    token0: string;
    token1: string;
  };
  inputAmount: string;
  outputAmount: string;
  expectedOutput: string;
  actualSlippage: number;
  gasUsed: string;
  gasPrice: string;
  blockNumber: number;
  successful: boolean;
  profitLoss: string;
  executionTime: number;
  marketConditions: MarketConditions;
  networkState: NetworkState;
}

// Optimization result types
export interface OptimizationResult {
  recommendedTiming: number;
  recommendedSize: string;
  expectedMetrics: {
    expectedProfit: string;
    expectedSlippage: number;
    estimatedGas: string;
    confidence: number;
  };
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
  };
}

export {};
