
import { Transaction } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Mock transaction history
const mockTransactions: Transaction[] = [
  {
    id: uuidv4(),
    hash: '0x8b91c47a6d0a57da7fcacd25d8debc4c82acfd23a35ed6d6b991c4fa26a5d4b1',
    type: 'approval',
    status: 'confirmed',
    timestamp: Date.now() - 3600000, // 1 hour ago
    value: '0 ETH',
    from: '0x1234...5678',
    to: '0xUniswapRouter',
    details: {
      token: 'USDC',
      spender: 'Uniswap V3 Router'
    }
  },
  {
    id: uuidv4(),
    hash: '0x7c91c47a6d0a57da7fcacd25d8debc4c82acfd23a35ed6d6b991c4fa26a5d4b2',
    type: 'swap',
    status: 'confirmed',
    timestamp: Date.now() - 3000000, // 50 minutes ago
    value: '0.5 ETH',
    from: '0x1234...5678',
    to: '0xUniswapRouter',
    details: {
      tokenIn: 'ETH',
      tokenOut: 'USDC',
      amountIn: '0.5 ETH',
      amountOut: '1750 USDC'
    }
  },
  {
    id: uuidv4(),
    hash: '0x6b91c47a6d0a57da7fcacd25d8debc4c82acfd23a35ed6d6b991c4fa26a5d4b3',
    type: 'flashloan',
    status: 'confirmed',
    timestamp: Date.now() - 1800000, // 30 minutes ago
    value: '10 ETH',
    from: 'Aave',
    to: '0x1234...5678',
    details: {
      protocol: 'Aave',
      amount: '10 ETH',
      fee: '0.0009 ETH'
    }
  },
  {
    id: uuidv4(),
    hash: '0x5c91c47a6d0a57da7fcacd25d8debc4c82acfd23a35ed6d6b991c4fa26a5d4b4',
    type: 'arbitrage',
    status: 'confirmed',
    timestamp: Date.now() - 1500000, // 25 minutes ago
    value: '10.5 ETH',
    from: '0x1234...5678',
    to: '0x1234...5678',
    details: {
      sourceDex: 'Uniswap',
      targetDex: 'SushiSwap',
      tokenIn: 'ETH',
      tokenOut: 'USDC',
      profit: '0.05 ETH'
    }
  },
  {
    id: uuidv4(),
    hash: '0x4d91c47a6d0a57da7fcacd25d8debc4c82acfd23a35ed6d6b991c4fa26a5d4b5',
    type: 'arbitrage',
    status: 'pending',
    timestamp: Date.now() - 300000, // 5 minutes ago
    value: '15 ETH',
    from: '0x1234...5678',
    to: '0x1234...5678',
    details: {
      sourceDex: 'Uniswap',
      targetDex: 'Curve',
      tokenIn: 'ETH',
      tokenOut: 'USDT',
      profit: 'Pending'
    }
  }
];

// Get transaction history
export const getTransactionHistory = async (): Promise<Transaction[]> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  return [...mockTransactions];
};

// Add a new transaction to history
export const addTransaction = (transaction: Omit<Transaction, 'id'>): Transaction => {
  const newTransaction = {
    ...transaction,
    id: uuidv4()
  };
  
  mockTransactions.unshift(newTransaction);
  return newTransaction;
};

// Update a transaction status
export const updateTransactionStatus = (
  id: string,
  status: Transaction['status'],
  details?: any
): Transaction | null => {
  const transaction = mockTransactions.find(t => t.id === id);
  
  if (transaction) {
    transaction.status = status;
    if (details) {
      transaction.details = {
        ...transaction.details,
        ...details
      };
    }
    return transaction;
  }
  
  return null;
};
