
// Export all arbitrage functionality
export * from './types';
export * from './storage';
export * from './tradeExecutor';

// Add utility functions for arbitrage
import { ethers } from 'ethers';
import { blockchain } from '../blockchain/service';

/**
 * Estimate gas cost for an arbitrage transaction
 */
export const estimateGasCost = async (
  numHops: number = 1,
  useFlashloan: boolean = true
): Promise<{
  gasUnits: number;
  gasPriceGwei: number;
  gasCostETH: number;
  gasCostUSD: number;
}> => {
  // Base gas for a single swap
  const baseGas = 120000;
  
  // Additional gas per hop
  const gasPerHop = 60000;
  
  // Additional gas for flashloan
  const flashloanGas = useFlashloan ? 90000 : 0;
  
  // Calculate total gas units
  const gasUnits = baseGas + (numHops - 1) * gasPerHop + flashloanGas;
  
  // Get current gas price
  const provider = blockchain.getCurrentProvider();
  let gasPriceGwei = 50; // Fallback value
  
  try {
    const gasPrice = await provider.getGasPrice();
    gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
  } catch (error) {
    console.warn('Failed to get gas price, using default:', error);
  }
  
  // Calculate gas cost in ETH
  const gasCostETH = gasUnits * gasPriceGwei / 1e9;
  
  // Calculate gas cost in USD (using a hardcoded ETH price for simplicity)
  // In a real implementation, this would use the current market price
  const ethPriceUSD = 3500;
  const gasCostUSD = gasCostETH * ethPriceUSD;
  
  return {
    gasUnits,
    gasPriceGwei,
    gasCostETH,
    gasCostUSD
  };
};

/**
 * Calculate flashloan profitability
 */
export const calculateFlashloanProfitability = (
  borrowAmount: number,
  profitAmount: number,
  feePercentage: number = 0.09
): {
  feeAmount: number;
  netProfit: number;
  isProfitable: boolean;
  breakEvenProfitPercentage: number;
} => {
  // Calculate fee amount
  const feeAmount = borrowAmount * (feePercentage / 100);
  
  // Calculate net profit
  const netProfit = profitAmount - feeAmount;
  
  // Determine if profitable
  const isProfitable = netProfit > 0;
  
  // Calculate break-even profit percentage
  const breakEvenProfitPercentage = (feeAmount / borrowAmount) * 100;
  
  return {
    feeAmount,
    netProfit,
    isProfitable,
    breakEvenProfitPercentage
  };
};
