
import { Transaction } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { blockchain, GasPriceStrategy, approveToken as approveTokenBlockchain, sendTransaction as sendTransactionBlockchain, executeContractTransaction as executeContractTransactionBlockchain, waitForTransaction } from './blockchain';
import { toast } from '@/hooks/use-toast';

// Mock transaction history (keep for demo purposes)
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

// New functions that utilize the blockchain service

// Create and send a transaction
export const sendTransaction = async (
  to: string,
  value: string,
  data: string = '0x',
  gasPriceStrategy: GasPriceStrategy = 'standard'
): Promise<Transaction> => {
  try {
    // Create a pending transaction record
    const pendingTx: Omit<Transaction, 'id'> = {
      hash: 'pending',
      type: 'swap', // Default type, should be changed based on the actual transaction
      status: 'pending',
      timestamp: Date.now(),
      value: value + ' ETH',
      from: 'your-address', // Should be the current wallet address
      to,
      details: {
        gasPriceStrategy,
        data: data.substring(0, 10) + '...' // First 10 chars of the data (function signature)
      }
    };
    
    // Add the pending transaction to history
    const transaction = addTransaction(pendingTx);
    
    // Send the transaction using the blockchain service
    const receipt = await blockchain.sendTransaction(to, value, data, gasPriceStrategy);
    
    // Update the transaction with the actual hash and status
    updateTransactionStatus(
      transaction.id,
      receipt.status === 1 ? 'confirmed' : 'failed',
      {
        hash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        explorerUrl: receipt.explorerUrl
      }
    );
    
    return transaction;
  } catch (error) {
    console.error('Error sending transaction:', error);
    
    toast({
      title: "Transaction Failed",
      description: "Failed to send transaction. Please try again.",
      variant: "destructive",
    });
    
    throw error;
  }
};

// Execute a contract method and track the transaction
export const executeContractMethod = async (
  contractAddress: string,
  abi: any[],
  methodName: string,
  params: any[],
  value: string = '0',
  type: Transaction['type'] = 'swap',
  gasPriceStrategy: GasPriceStrategy = 'standard'
): Promise<Transaction> => {
  try {
    // Create a pending transaction record
    const pendingTx: Omit<Transaction, 'id'> = {
      hash: 'pending',
      type,
      status: 'pending',
      timestamp: Date.now(),
      value: value + ' ETH',
      from: 'your-address', // Should be the current wallet address
      to: contractAddress,
      details: {
        method: methodName,
        params: JSON.stringify(params),
        gasPriceStrategy
      }
    };
    
    // Add the pending transaction to history
    const transaction = addTransaction(pendingTx);
    
    // Execute the contract method using the blockchain service
    const receipt = await blockchain.executeContractTransaction(
      contractAddress,
      abi,
      methodName,
      params,
      value,
      gasPriceStrategy
    );
    
    // Update the transaction with the actual hash and status
    updateTransactionStatus(
      transaction.id,
      receipt.status === 1 ? 'confirmed' : 'failed',
      {
        hash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        explorerUrl: receipt.explorerUrl
      }
    );
    
    return transaction;
  } catch (error) {
    console.error('Error executing contract method:', error);
    
    toast({
      title: "Transaction Failed",
      description: `Failed to execute ${methodName}. Please try again.`,
      variant: "destructive",
    });
    
    throw error;
  }
};

// Approve token spending and track the transaction
export const approveToken = async (
  tokenAddress: string,
  spenderAddress: string,
  amount: string,
  tokenSymbol: string,
  decimals: number = 18
): Promise<Transaction> => {
  try {
    // Create a pending transaction record
    const pendingTx: Omit<Transaction, 'id'> = {
      hash: 'pending',
      type: 'approval',
      status: 'pending',
      timestamp: Date.now(),
      value: '0 ETH',
      from: 'your-address', // Should be the current wallet address
      to: tokenAddress,
      details: {
        token: tokenSymbol,
        spender: spenderAddress,
        amount
      }
    };
    
    // Add the pending transaction to history
    const transaction = addTransaction(pendingTx);
    
    // Approve the token using the blockchain service
    const receipt = await blockchain.approveToken(
      tokenAddress,
      spenderAddress,
      amount,
      decimals
    );
    
    // Update the transaction with the actual hash and status
    updateTransactionStatus(
      transaction.id,
      receipt.status === 1 ? 'confirmed' : 'failed',
      {
        hash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        explorerUrl: receipt.explorerUrl
      }
    );
    
    return transaction;
  } catch (error) {
    console.error('Error approving token:', error);
    
    toast({
      title: "Approval Failed",
      description: `Failed to approve ${tokenSymbol}. Please try again.`,
      variant: "destructive",
    });
    
    throw error;
  }
};

// Track an existing transaction
export const trackTransaction = async (
  txHash: string,
  type: Transaction['type'],
  details?: any
): Promise<Transaction> => {
  try {
    // Create a pending transaction record
    const pendingTx: Omit<Transaction, 'id'> = {
      hash: txHash,
      type,
      status: 'pending',
      timestamp: Date.now(),
      value: '0 ETH', // Will be updated when the receipt is available
      from: 'tracking', // Will be updated when the receipt is available
      to: 'tracking', // Will be updated when the receipt is available
      details
    };
    
    // Add the pending transaction to history
    const transaction = addTransaction(pendingTx);
    
    // Wait for the transaction to be mined
    const receipt = await blockchain.waitForTransaction(txHash);
    
    // Update the transaction with the details from the receipt
    updateTransactionStatus(
      transaction.id,
      receipt.status === 1 ? 'confirmed' : 'failed',
      {
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        explorerUrl: receipt.explorerUrl,
        from: receipt.from,
        to: receipt.to,
        value: receipt.value ? `${receipt.value} ETH` : '0 ETH'
      }
    );
    
    return transaction;
  } catch (error) {
    console.error('Error tracking transaction:', error);
    
    toast({
      title: "Tracking Failed",
      description: `Failed to track transaction ${txHash.substring(0, 10)}...`,
      variant: "destructive",
    });
    
    throw error;
  }
};
