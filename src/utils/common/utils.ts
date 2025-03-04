/**
 * Sleep for a specified number of milliseconds
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Format a number with commas for thousands
 */
export const formatWithCommas = (x: number | string): string => {
  const num = typeof x === 'string' ? parseFloat(x) : x;
  return num.toLocaleString();
};

/**
 * Format a timestamp as a readable date
 */
export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

/**
 * Truncate text to a specified length
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

/**
 * Truncate a hash (like transaction hash) for display
 */
export const truncateHash = (hash: string): string => {
  if (!hash) return '';
  if (hash.length <= 10) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
};

/**
 * Return a color based on status
 */
export const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'success':
      return 'text-green-500';
    case 'pending':
    case 'preparing':
    case 'estimating':
    case 'ready':
      return 'text-yellow-500';
    case 'executing':
      return 'text-blue-500';
    case 'failed':
    case 'error':
      return 'text-red-500';
    case 'canceled':
      return 'text-gray-500';
    default:
      return 'text-gray-800';
  }
};

/**
 * Parse a string with a unit into a number
 * e.g. "10.5 ETH" -> 10.5
 */
export const parseValueWithUnit = (valueString: string): number => {
  const match = valueString.match(/^([\d\.]+)/);
  if (!match) return 0;
  return parseFloat(match[1]);
};

/**
 * Format an amount of tokens with the appropriate number of decimal places
 */
export const formatTokenAmount = (
  amount: string | number,
  decimals: number = 18,
  maxDisplayDecimals: number = 4
): string => {
  // Convert to number
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // If value is very small, use scientific notation
  if (value > 0 && value < 0.0001) {
    return value.toExponential(2);
  }
  
  // Otherwise, format with fixed decimals
  return value.toFixed(Math.min(decimals, maxDisplayDecimals));
};
