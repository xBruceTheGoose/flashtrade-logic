
import { ArbitrageOpportunity, DEX, Token, Transaction } from '@/types';

// Strategy for executing trades
export type ExecutionStrategy = 'standard' | 'aggressive' | 'conservative';

// Priority level for trade execution
export type ExecutionPriority = 'high' | 'medium' | 'low';

// Status of a trade execution
export type ExecutionStatus = 
  | 'pending'    // Initial state
  | 'preparing'  // Preparing transaction data
  | 'estimating' // Estimating gas
  | 'ready'      // Ready to execute
  | 'executing'  // Transaction sent
  | 'completed'  // Successfully executed
  | 'failed'     // Failed to execute
  | 'canceled';  // Canceled by user or system

// Options for trade execution
export interface ExecutionOptions {
  strategy: ExecutionStrategy;
  priority: ExecutionPriority;
  maxGasPrice?: string;
  slippageTolerance: number; // In percentage (e.g., 0.5 for 0.5%)
  deadline: number; // Unix timestamp
  useFlashloan: boolean;
  flashloanProvider?: 'aave' | 'uniswap';
  autoAdjustGas: boolean;
  maxRetries: number;
}

// Default execution options
export const DEFAULT_EXECUTION_OPTIONS: ExecutionOptions = {
  strategy: 'standard',
  priority: 'medium',
  slippageTolerance: 0.5,
  deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from now
  useFlashloan: true,
  flashloanProvider: 'aave',
  autoAdjustGas: true,
  maxRetries: 3
};

// Detailed execution result
export interface ExecutionResult {
  success: boolean;
  transactionHash?: string;
  status: ExecutionStatus;
  error?: string;
  gasUsed?: string;
  effectiveGasPrice?: string;
  totalCost?: string;
  profit?: string;
  executionTime?: number; // In milliseconds
  blockNumber?: number;
}

// Trade execution record for analysis
export interface TradeExecutionRecord {
  id: string;
  opportunityId: string;
  timestamp: number;
  strategy: ExecutionStrategy;
  useFlashloan: boolean;
  flashloanProvider?: string;
  tokenIn: string;
  tokenInSymbol: string;
  tokenOut: string;
  tokenOutSymbol: string;
  tradeSize: string;
  expectedProfit: string;
  actualProfit?: string;
  gasEstimate: string;
  actualGasUsed?: string;
  transactionHash?: string;
  status: ExecutionStatus;
  error?: string;
  executionTime?: number;
  sourceDex: string;
  targetDex: string;
  path?: string[];
}

// Queue item for concurrent execution
export interface ExecutionQueueItem {
  opportunity: ArbitrageOpportunity;
  options: ExecutionOptions;
  priority: number; // Calculated priority score
  addedAt: number;
  executionAttempts: number;
  status: ExecutionStatus;
  error?: string;
}
