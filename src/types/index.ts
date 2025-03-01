
export type WalletType = 'metamask' | 'coinbase' | 'walletconnect' | null;

export type WalletInfo = {
  address: string;
  balance: string;
  chainId: number;
  connected: boolean;
  type: WalletType;
};

export type DEX = {
  id: string;
  name: string;
  icon: string;
  active: boolean;
};

export type Token = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance?: string;
  price?: number;
  logoURI?: string;
};

export type ArbitrageOpportunity = {
  id: string;
  sourceDex: DEX;
  targetDex: DEX;
  tokenIn: Token;
  tokenOut: Token;
  profitPercentage: number;
  estimatedProfit: string;
  gasEstimate: string;
  timestamp: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
};

export type Transaction = {
  id: string;
  hash: string;
  type: 'swap' | 'approval' | 'flashloan' | 'arbitrage';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  value: string;
  gasUsed?: string;
  from: string;
  to: string;
  details?: any;
};

export type NotificationType = 'success' | 'error' | 'info' | 'warning';
