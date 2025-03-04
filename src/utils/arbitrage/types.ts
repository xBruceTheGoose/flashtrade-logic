
import { ArbitrageOpportunity, DEX, Token } from '@/types';

export type ExecutionStrategyType = 'sequential' | 'concurrent' | 'priority';

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
  amountIn: string;
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
