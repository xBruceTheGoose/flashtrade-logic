
// Configuration constants
export const MIN_SLIPPAGE = 0.1;
export const MAX_SLIPPAGE = 5.0;
export const DEFAULT_MAX_FLASHLOAN = 5.0;
export const MAX_CONFIGS = 10;

// Time frames for historical data and monitoring
export const timeFrames = [
  { id: '1h', label: '1 Hour' },
  { id: '4h', label: '4 Hours' },
  { id: '1d', label: '1 Day' },
  { id: '1w', label: '1 Week' },
  { id: '1m', label: '1 Month' }
];

// Gas price levels
export const gasPriceLevels = {
  low: 'Slower, cheaper transactions',
  medium: 'Balanced speed and cost',
  high: 'Faster, more expensive transactions',
  auto: 'Automatically adjusted based on network conditions'
};

// Security constants
export const API_RATE_LIMITS = {
  priceCheck: { maxRequests: 30, timeWindowMs: 60000 }, // 30 requests per minute
  trade: { maxRequests: 5, timeWindowMs: 60000 }, // 5 trades per minute
  scan: { maxRequests: 10, timeWindowMs: 60000 }, // 10 scans per minute
  flashloan: { maxRequests: 3, timeWindowMs: 60000 } // 3 flashloans per minute
};

export const MAX_WALLET_APPROVAL = "2.0"; // Maximum approval amount in ETH
export const CIRCUIT_BREAKER_THRESHOLDS = {
  priceDeviation: 5.0, // 5% price deviation from expected
  gasPriceSpike: 300, // 300% increase in gas price
  slippageExceeded: 2.0 // 2x expected slippage
};

export const EMERGENCY_TIMELOCK_MS = 10000; // 10-second delay for emergency operations
export const MAX_RETRIES = 3; // Maximum retries for network operations
