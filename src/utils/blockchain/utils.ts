
import { ethers, BigNumber } from 'ethers';
import { NETWORKS } from './networks';

// Format a number with commas and decimal places
export function formatNumber(value: string | number, decimals: number = 4): string {
  const number = typeof value === 'string' ? parseFloat(value) : value;
  return number.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

// Convert between units (e.g., wei to ether)
export function convertUnits(
  value: string | BigNumber,
  fromDecimals: number,
  toDecimals: number
): string {
  if (typeof value === 'string') {
    value = ethers.utils.parseUnits(value, fromDecimals);
  }
  
  // Convert to a decimal string with the new number of decimals
  return ethers.utils.formatUnits(value, toDecimals);
}

// Check if an address is valid
export function isValidAddress(address: string): boolean {
  return ethers.utils.isAddress(address);
}

// Get short address format
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  return `${address.substring(0, chars + 2)}...${address.substring(42 - chars)}`;
}

// Get transaction URL on block explorer
export function getTransactionUrl(txHash: string, chainId: number): string {
  try {
    const network = Object.values(NETWORKS).find(net => net.id === chainId);
    if (!network) {
      return `https://etherscan.io/tx/${txHash}`;
    }
    return `${network.explorer}/tx/${txHash}`;
  } catch (error) {
    return `https://etherscan.io/tx/${txHash}`;
  }
}
