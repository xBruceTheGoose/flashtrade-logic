
export type ExecutionStrategyType = 'sequential' | 'concurrent' | 'priority';

export interface ExecutionOptions {
  strategy: ExecutionStrategyType;
  priority: 'high' | 'medium' | 'low';
  useFlashloan: boolean;
  flashloanProvider: 'aave' | 'uniswap';
  maxGasPrice: string;
  gasPriceMultiplier: number;
  maxRetries: number;
  retryDelay: number;
  slippageTolerance: number;
}

export type ExecutionStatus =
  | 'pending'
  | 'preparing'
  | 'simulating'
  | 'simulation_failed'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rate_limited'
  | 'validation_failed'
  | 'circuit_breaker';

export interface ExecutionResult {
  success: boolean;
  status: ExecutionStatus;
  transactionHash?: string;
  executionTime?: number;
  error?: string;
}

export interface TradeExecutionRecord {
  id: string;
  opportunityId: string;
  timestamp: number;
  tokenIn: string;
  tokenOut: string;
  tokenInSymbol: string;
  tokenOutSymbol: string;
  sourceDex: string;
  targetDex: string;
  tradeSize: string;
  expectedProfit: string;
  status: ExecutionStatus;
  success: boolean;
  transactionHash?: string;
  actualProfit?: string;
  executionTime?: number;
  error?: string;
  amountIn: string;
  // Additional properties needed by components
  profitAmount?: string;
  profitPercentage?: string;
  gasUsed?: string;
  txHash?: string; // Alias for transactionHash for backward compatibility
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  backoffFactor: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffFactor: 2,
};

export type CircuitBreakerType = 
  | 'price_deviation' 
  | 'gas_price_spike' 
  | 'liquidity_change' 
  | 'slippage_exceeded' 
  | 'tx_failure' 
  | 'manual';

export interface CircuitBreakerEvent {
  type: CircuitBreakerType;
  timestamp: number;
  reason: string;
  data?: any;
}

export interface SecurityConfig {
  enableCircuitBreaker: boolean;
  enableSimulation: boolean;
  maxApprovalAmount: string;
  allowRisky: boolean;
  allowFlashloan: boolean;
  maxTradeAttempts: number;
}

export type ValidationResult = {
  valid: boolean;
  errors?: string[];
};

// Add to existing ExecutionResult type
export interface EnhancedExecutionResult extends ExecutionResult {
  simulationDetails?: {
    gasUsed: string;
    expectedOutcome: string;
    actualOutcome: string;
  };
  securityChecks?: {
    validationPassed: boolean;
    simulationPassed: boolean;
    circuitBreakerStatus: string;
  };
}

// Add missing type
export interface ExecutionConfig {
  minProfitPercentage: number;
  maxTradeSize: number;
  slippageTolerance: number;
  gasPrice: string;
  autoExecute: boolean;
  riskTolerance: 'low' | 'medium' | 'high';
  executionStrategy: ExecutionStrategyType;
  maxConcurrentTrades: number;
}
