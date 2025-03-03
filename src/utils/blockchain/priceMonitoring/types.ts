
import { DEX, Token } from '@/types';

export interface PricePoint {
  timestamp: number;
  price: number;
  dexId: string;
}

export interface PriceHistory {
  tokenAddress: string;
  pricePoints: PricePoint[];
}

export interface MonitoringConfig {
  // How frequently to poll prices (in ms)
  pollingInterval: number;
  // Maximum number of requests per minute
  maxRequestsPerMinute: number;
  // Minimum profit percentage to consider (after fees)
  minProfitPercentage: number;
  // Whether to automatically execute trades on profitable opportunities
  autoExecuteTrades: boolean;
  // Maximum number of price points to store per token
  maxPriceHistoryLength: number;
}

export interface TokenPair {
  tokenA: Token;
  tokenB: Token;
}
