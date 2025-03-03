
import { ethers, BigNumber } from 'ethers';
import { toast } from '@/hooks/use-toast';
import { blockchain } from './service';
import { GasPriceStrategy, EnhancedTransactionReceipt, RetryConfig, DEFAULT_RETRY_CONFIG } from './types';

// Approve token spending
export async function approveToken(
  tokenAddress: string,
  spenderAddress: string,
  amount: string,
  decimals: number = 18
): Promise<EnhancedTransactionReceipt> {
  if (!blockchain.getSigner()) {
    throw new Error('Wallet not connected');
  }
  
  // ERC20 standard ABI for approve
  const abi = ['function approve(address spender, uint256 amount) returns (bool)'];
  
  const tokenContract = new ethers.Contract(tokenAddress, abi, blockchain.getSigner());
  
  const amountInWei = ethers.utils.parseUnits(amount, decimals);
  
  // Estimate gas to confirm the transaction can succeed
  const gasEstimate = await tokenContract.estimateGas.approve(spenderAddress, amountInWei);
  
  // Add a buffer to the gas estimate
  const bufferedGas = gasEstimate.mul(120).div(100); // 20% buffer
  
  const tx = await tokenContract.approve(spenderAddress, amountInWei, {
    gasLimit: bufferedGas,
  });
  
  toast({
    title: "Transaction Submitted",
    description: "Approving token for spending...",
  });
  
  return await waitForTransaction(tx.hash);
}

// Send a transaction
export async function sendTransaction(
  to: string,
  value: string,
  data: string = '0x',
  gasPriceStrategy: GasPriceStrategy = 'standard'
): Promise<EnhancedTransactionReceipt> {
  if (!blockchain.getSigner()) {
    throw new Error('Wallet not connected');
  }
  
  const valueInWei = ethers.utils.parseEther(value);
  
  // Get the optimal gas price based on the selected strategy
  const gasPrice = await getOptimalGasPrice(gasPriceStrategy);
  
  // Create transaction object
  const txObject = {
    to,
    value: valueInWei,
    data,
    gasPrice,
  };
  
  // Estimate gas limit
  const estimatedGas = await blockchain.getCurrentProvider().estimateGas(txObject);
  
  // Add a buffer to the gas estimate for safety
  const gasLimit = estimatedGas.mul(120).div(100); // 20% buffer
  
  // Send the transaction
  const tx = await blockchain.getSigner()!.sendTransaction({
    ...txObject,
    gasLimit,
  });
  
  toast({
    title: "Transaction Submitted",
    description: "Processing your transaction...",
  });
  
  return await waitForTransaction(tx.hash);
}

// Call a smart contract method (read-only)
export async function callContractMethod(
  contractAddress: string,
  abi: ethers.ContractInterface,
  methodName: string,
  params: any[] = []
): Promise<any> {
  const provider = blockchain.getCurrentProvider();
  const contract = new ethers.Contract(contractAddress, abi, provider);
  
  try {
    return await contract[methodName](...params);
  } catch (error) {
    console.error(`Error calling ${methodName}:`, error);
    throw error;
  }
}

// Execute a smart contract transaction (write)
export async function executeContractTransaction(
  contractAddress: string,
  abi: ethers.ContractInterface,
  methodName: string,
  params: any[] = [],
  value: string = '0',
  gasPriceStrategy: GasPriceStrategy = 'standard',
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<EnhancedTransactionReceipt> {
  if (!blockchain.getSigner()) {
    throw new Error('Wallet not connected');
  }
  
  const contract = new ethers.Contract(contractAddress, abi, blockchain.getSigner());
  const valueInWei = ethers.utils.parseEther(value);
  
  // Get the optimal gas price based on the selected strategy
  const gasPrice = await getOptimalGasPrice(gasPriceStrategy);
  
  // Prepare the transaction options
  const txOptions: {
    gasPrice: BigNumber;
    value: BigNumber;
    gasLimit?: BigNumber;
  } = {
    gasPrice,
    value: valueInWei,
  };
  
  // Try to estimate gas limit
  try {
    const estimatedGas = await contract.estimateGas[methodName](...params, txOptions);
    txOptions.gasLimit = estimatedGas.mul(120).div(100); // 20% buffer
  } catch (error) {
    console.warn('Gas estimation failed, using default limit:', error);
    txOptions.gasLimit = ethers.BigNumber.from(300000); // Default gas limit
  }
  
  // Function to execute the transaction
  const executeTransaction = async (): Promise<EnhancedTransactionReceipt> => {
    try {
      const tx = await contract[methodName](...params, txOptions);
      
      toast({
        title: "Transaction Submitted",
        description: `Executing ${methodName}...`,
      });
      
      return await waitForTransaction(tx.hash);
    } catch (error: any) {
      // Check if this is a transaction error that can be retried
      if (
        error.code === 'UNPREDICTABLE_GAS_LIMIT' ||
        error.code === 'REPLACEMENT_UNDERPRICED' ||
        error.code === 'INSUFFICIENT_FUNDS' ||
        error.message?.includes('transaction underpriced')
      ) {
        throw error; // Propagate the error for retry logic
      }
      
      console.error(`Transaction error in ${methodName}:`, error);
      throw error;
    }
  };
  
  // Implement retry logic with exponential backoff
  let lastError: Error | null = null;
  let delay = retryConfig.initialDelayMs;
  
  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      return await executeTransaction();
    } catch (error: any) {
      console.warn(`Attempt ${attempt} failed:`, error);
      lastError = error;
      
      if (attempt < retryConfig.maxAttempts) {
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = delay * retryConfig.backoffFactor;
        
        // Adjust gas price for certain errors
        if (
          error.code === 'REPLACEMENT_UNDERPRICED' ||
          error.message?.includes('transaction underpriced')
        ) {
          // Increase gas price for next attempt
          console.log('Increasing gas price for next attempt');
          txOptions.gasPrice = txOptions.gasPrice.mul(120).div(100); // 20% increase
        }
      }
    }
  }
  
  // If we've exhausted all attempts, throw the last error
  throw lastError || new Error('Transaction failed after retries');
}

// Watch a transaction for confirmation
export async function waitForTransaction(
  txHash: string, 
  confirmations: number = 1
): Promise<EnhancedTransactionReceipt> {
  const provider = blockchain.getCurrentProvider();
  
  toast({
    title: "Waiting for Confirmation",
    description: `Transaction ${txHash.substring(0, 10)}... pending`,
  });
  
  try {
    const receipt = await provider.waitForTransaction(txHash, confirmations);
    
    const network = blockchain.getNetworkConfig(1); // Use current chainId instead of hardcoded 1
    const explorerUrl = `${network.explorer}/tx/${txHash}`;
    
    const enhancedReceipt: EnhancedTransactionReceipt = {
      ...receipt,
      explorerUrl,
      networkName: network.name,
    };
    
    if (receipt.status === 1) {
      toast({
        title: "Transaction Confirmed",
        description: "Your transaction has been confirmed!",
        variant: "default",
      });
    } else {
      toast({
        title: "Transaction Failed",
        description: "Your transaction has failed. Please check the details.",
        variant: "destructive",
      });
    }
    
    return enhancedReceipt;
  } catch (error) {
    console.error('Error waiting for transaction:', error);
    
    toast({
      title: "Transaction Error",
      description: "There was an error with your transaction.",
      variant: "destructive",
    });
    
    throw error;
  }
}

// Get optimal gas price based on strategy
export async function getOptimalGasPrice(strategy: GasPriceStrategy): Promise<BigNumber> {
  const provider = blockchain.getCurrentProvider();
  const gasPrice = await provider.getGasPrice();
  
  // Adjust based on strategy
  switch (strategy) {
    case 'fast':
      return gasPrice.mul(120).div(100); // 20% more than standard
    case 'aggressive':
      return gasPrice.mul(150).div(100); // 50% more than standard
    case 'standard':
    default:
      return gasPrice;
  }
}
