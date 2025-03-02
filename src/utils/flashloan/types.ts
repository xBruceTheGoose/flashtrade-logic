
import { ethers } from 'ethers';
import { Token } from '@/types';

export type FlashloanProvider = 'aave' | 'uniswap';

export interface FlashloanOptions {
  provider: FlashloanProvider;
  token: Token;
  amount: string;
  recipient: string;
  callbackData?: string;
  referralCode?: number;
}

export interface FlashloanResult {
  success: boolean;
  transactionHash?: string;
  fee?: string;
  error?: string;
  borrowed?: string;
  repaid?: string;
}

export interface FlashloanFeeInfo {
  provider: FlashloanProvider;
  token: Token;
  amount: string;
  feePercentage: number;
  feeAmount: string;
  totalRequired: string;
}

export interface IFlashloanProvider {
  name: FlashloanProvider;
  supportedTokens: string[];
  getFee(token: Token, amount: string): Promise<FlashloanFeeInfo>;
  executeFlashloan(options: FlashloanOptions): Promise<FlashloanResult>;
  isTokenSupported(tokenAddress: string): boolean;
}
