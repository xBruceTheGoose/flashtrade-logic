
import { ethers } from 'ethers';
import { Token } from '@/types';
import { blockchain } from '@/utils/blockchain';

/**
 * Apply slippage tolerance to an amount
 */
export const applySlippage = (
  amount: string,
  slippageBps: number,
  decimals: number
): string => {
  const amountBN = ethers.utils.parseUnits(amount, decimals);
  const slippageFactor = 10000 - slippageBps; // e.g., 9950 for 0.5% slippage
  const minAmountBN = amountBN.mul(slippageFactor).div(10000);
  return ethers.utils.formatUnits(minAmountBN, decimals);
};

/**
 * Get the signer for transactions
 */
export const getSigner = (): ethers.Signer => {
  const signer = blockchain.getSigner();
  if (!signer) {
    throw new Error('No signer available');
  }
  return signer;
};

/**
 * Get WETH address for the current chain
 */
export const getWETHAddress = (chainId: number): string => {
  // WETH addresses for different chains
  const wethAddresses: Record<number, string> = {
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Ethereum Mainnet
    3: '0xc778417E063141139Fce010982780140Aa0cD5Ab', // Ropsten
    4: '0xc778417E063141139Fce010982780140Aa0cD5Ab', // Rinkeby
    5: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6', // Görli
    42: '0xd0A1E359811322d97991E03f863a0C30C2cF029C', // Kovan
    56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // BSC (WBNB)
    137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // Polygon (WMATIC)
    42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // Arbitrum
  };
  
  return wethAddresses[chainId] || wethAddresses[1]; // Default to Ethereum Mainnet
};
