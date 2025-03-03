
import { ethers } from 'ethers';

// Gas price strategy options
export type GasPriceStrategy = 'standard' | 'fast' | 'aggressive';

// Transaction retry configuration
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  backoffFactor: number;
}

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffFactor: 1.5,
};

// Transaction receipt with enhanced information
export interface EnhancedTransactionReceipt extends ethers.providers.TransactionReceipt {
  explorerUrl: string;
  networkName: string;
  value?: string; // Add optional value property
}
