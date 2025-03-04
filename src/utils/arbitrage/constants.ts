
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

