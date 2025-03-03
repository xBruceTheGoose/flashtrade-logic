import { Address } from "viem";

declare global {
  // Add any global declarations here
}

// Wallet types
export type WalletType = 'metamask' | 'walletconnect' | 'coinbase' | null;

export interface Wallet {
  address: string;
  balance: string;
  chainId: number;
  connected: boolean;
  type: WalletType;
}

// Network types
export interface Network {
  id: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// Token types
export interface Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
  price?: number;
  balance?: string;
}

// DEX types
export interface DEX {
  id: string;
  name: string;
  logo?: string;
  active: boolean;
  supportedChainIds: number[];
  version?: string;
  factoryAddress?: string;
  routerAddress?: string;
  websocketUrl?: string;
}

// Arbitrage types
export interface ArbitrageOpportunity {
  id: string;
  sourceDex: DEX;
  targetDex: DEX;
  tokenIn: Token;
  tokenOut: Token;
  profitPercentage: number;
  estimatedProfit: string;
  gasEstimate: string;
  tradeSize?: string;
  timestamp: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  // New fields for enhanced detection
  path?: string[];          // Array of token addresses in path
  dexPath?: string[];       // Array of DEX IDs in path
  riskLevel?: 'low' | 'medium' | 'high';
  confidenceScore?: number; // 0-100 value indicating confidence
}

export {};
