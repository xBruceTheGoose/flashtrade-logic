
import { ArbitrageOpportunity, DEX, Token } from '@/types';

export type ExecutionStrategyType = 'sequential' | 'concurrent' | 'priority';
export type ExecutionStrategy = 'conservative' | 'balanced' | 'aggressive';
export type ExecutionPriority = 'low' | 'medium' | 'high';
export type ExecutionStatus = 'pending' | 'preparing' | 'estimating' | 'ready' | 'executing' | 'completed' | 'failed';

export interface ExecutionConfig {
  // Minimum profit percentage required for trade execution
  minProfitPercentage: number;
  
  // Maximum amount of ETH (or equivalent) to use in a single trade
  maxTradeSize: number;
  
  // Slippage tolerance percentage
  slippageTolerance: number;
  
  // Gas price strategy: 'auto', 'low', 'medium', 'high', or a number in gwei
  gasPrice: string | number;
  
  // Whether to auto-execute trades
  autoExecute: boolean;
  
  // Risk tolerance level (affects various execution parameters)
  riskTolerance: 'low' | 'medium' | 'high';
  
  // Strategy for executing multiple trades
  executionStrategy: ExecutionStrategyType;
  
  // Maximum number of concurrent trades (only used with concurrent strategy)
  maxConcurrentTrades: number;
}

export const DEFAULT_EXECUTION_OPTIONS: ExecutionOptions = {
  strategy: 'balanced',
  priority: 'medium',
  useFlashloan: false,
  flashloanProvider: 'aave',
  maxGasPrice: '100',
  gasPriceMultiplier: 1.1,
  maxRetries: 2,
  retryDelay: 15000, // 15 seconds
  slippageTolerance: 0.5 // 0.5%
};

export interface ExecutionOptions {
  strategy: ExecutionStrategy;
  priority: ExecutionPriority;
  useFlashloan: boolean;
  flashloanProvider: 'aave' | 'uniswap' | 'dydx';
  maxGasPrice: string;
  gasPriceMultiplier: number;
  maxRetries: number;
  retryDelay: number;
  slippageTolerance: number;
}

export interface ExecutionResult {
  success: boolean;
  status: ExecutionStatus;
  transactionHash?: string;
  error?: string;
  executionTime?: number;
}

export interface TradeExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  profitAmount?: string;
  profitPercentage?: number;
  gasUsed?: string;
  executionTime?: number;
}

export interface TradeExecutionRecord {
  id: string;
  timestamp: number;
  tokenIn: string;
  tokenOut: string;
  amountIn?: string;  // Made optional
  amountOut?: string;
  sourceDex: string;
  targetDex: string;
  txHash?: string;
  success: boolean;
  error?: string;
  gasUsed?: string;
  gasPrice?: string;
  profitAmount?: string;
  profitPercentage?: string;
  executionTime?: number;
  strategyUsed?: string;
  
  // Additional fields needed for our application
  status: ExecutionStatus;
  opportunityId?: string;
  tokenInSymbol?: string;
  tokenOutSymbol?: string;
  tradeSize?: string;
  expectedProfit?: string;
  actualProfit?: string;
  transactionHash?: string;
  path?: string[];
  useFlashloan?: boolean;
  flashloanProvider?: string;
  strategy?: string;
}

export interface ExecutionQueueItem {
  opportunity: ArbitrageOpportunity;
  options: ExecutionOptions;
  priority: number;
  addedAt: number;
  executionAttempts: number;
  status: ExecutionStatus;
}

export interface ExecutionQueue {
  pending: ArbitrageOpportunity[];
  executing: string[];
  completed: TradeExecutionRecord[];
  failed: TradeExecutionRecord[];
}

export interface FlashloanRequest {
  token: Token;
  amount: string;
  targetContract: string;
  data: string;
  platform: 'aave' | 'uniswap' | 'dydx';
}

export interface GasStrategy {
  priorityFee?: number;
  maxFee?: number;
  gasLimit: number;
  type: 0 | 1 | 2;
}
