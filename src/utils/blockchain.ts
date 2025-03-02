import { ethers, BigNumber } from 'ethers';
import { WalletType } from '@/types';
import { getNetworkName } from '@/utils/wallet';
import { toast } from '@/hooks/use-toast';

// Network configurations for EVM-compatible chains
export const NETWORKS = {
  ETHEREUM: {
    id: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://mainnet.infura.io/v3/your-infura-id', // Replace in production
    explorer: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  POLYGON: {
    id: 137,
    name: 'Polygon Mainnet',
    rpcUrl: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
  BSC: {
    id: 56,
    name: 'Binance Smart Chain',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorer: 'https://bscscan.com',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
  },
  ARBITRUM: {
    id: 42161,
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  OPTIMISM: {
    id: 10,
    name: 'Optimism',
    rpcUrl: 'https://mainnet.optimism.io',
    explorer: 'https://optimistic.etherscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
};

// Network providers cache
const providers: Record<number, ethers.providers.Provider> = {};

// Gas price strategy options
export type GasPriceStrategy = 'standard' | 'fast' | 'aggressive';

// Transaction retry configuration
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  backoffFactor: number;
}

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffFactor: 1.5,
};

// Transaction receipt with enhanced information
export interface EnhancedTransactionReceipt extends ethers.providers.TransactionReceipt {
  explorerUrl: string;
  networkName: string;
  value?: string; // Add optional value property
}

// Blockchain service class
class BlockchainService {
  private currentWalletType: WalletType = null;
  private currentSigner: ethers.Signer | null = null;
  private currentProvider: ethers.providers.Provider | null = null;
  private currentChainId: number = 1; // Default to Ethereum Mainnet

  // Get provider for a specific chain
  public getProvider(chainId: number): ethers.providers.Provider {
    if (!providers[chainId]) {
      const network = this.getNetworkConfig(chainId);
      providers[chainId] = new ethers.providers.JsonRpcProvider(network.rpcUrl);
    }
    return providers[chainId];
  }

  // Get current provider
  public getCurrentProvider(): ethers.providers.Provider {
    if (!this.currentProvider) {
      this.currentProvider = this.getProvider(this.currentChainId);
    }
    return this.currentProvider;
  }

  // Get network configuration by chain ID
  public getNetworkConfig(chainId: number) {
    const network = Object.values(NETWORKS).find(net => net.id === chainId);
    if (!network) {
      throw new Error(`Unsupported network with chain ID: ${chainId}`);
    }
    return network;
  }

  // Set the wallet type and initialize a provider
  public async setWalletType(type: WalletType, chainId: number): Promise<void> {
    this.currentWalletType = type;
    this.currentChainId = chainId;
    
    // This is a simplified implementation. In a real application, you would:
    // 1. Initialize the appropriate provider based on wallet type (MetaMask, WalletConnect, etc.)
    // 2. Get a signer from that provider
    
    // For simulation purposes:
    this.currentProvider = this.getProvider(chainId);
    
    // For real wallet integration (example with window.ethereum):
    // if (type === 'metamask' && window.ethereum) {
    //   const provider = new ethers.providers.Web3Provider(window.ethereum);
    //   this.currentProvider = provider;
    //   this.currentSigner = provider.getSigner();
    // }
  }

  // Get the current signer
  public getSigner(): ethers.Signer | null {
    return this.currentSigner;
  }

  // Check if wallet is connected
  public isWalletConnected(): boolean {
    return this.currentSigner !== null;
  }

  // Get account balance
  public async getBalance(address: string): Promise<string> {
    const provider = this.getCurrentProvider();
    const balance = await provider.getBalance(address);
    const networkConfig = this.getNetworkConfig(this.currentChainId);
    return ethers.utils.formatUnits(balance, networkConfig.nativeCurrency.decimals);
  }

  // Get token balance
  public async getTokenBalance(
    tokenAddress: string,
    walletAddress: string,
    decimals: number = 18
  ): Promise<string> {
    const provider = this.getCurrentProvider();
    
    // ERC20 standard ABI for balanceOf
    const abi = [
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
    ];
    
    const tokenContract = new ethers.Contract(tokenAddress, abi, provider);
    
    try {
      // Try to get decimals from the contract
      try {
        decimals = await tokenContract.decimals();
      } catch (error) {
        console.warn('Could not get token decimals, using default:', decimals);
      }
      
      const balance = await tokenContract.balanceOf(walletAddress);
      return ethers.utils.formatUnits(balance, decimals);
    } catch (error) {
      console.error('Error getting token balance:', error);
      throw error;
    }
  }

  // Check token allowance
  public async getTokenAllowance(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string,
    decimals: number = 18
  ): Promise<string> {
    const provider = this.getCurrentProvider();
    
    // ERC20 standard ABI for allowance
    const abi = ['function allowance(address owner, address spender) view returns (uint256)'];
    
    const tokenContract = new ethers.Contract(tokenAddress, abi, provider);
    
    const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
    return ethers.utils.formatUnits(allowance, decimals);
  }

  // Approve token spending
  public async approveToken(
    tokenAddress: string,
    spenderAddress: string,
    amount: string,
    decimals: number = 18
  ): Promise<EnhancedTransactionReceipt> {
    if (!this.currentSigner) {
      throw new Error('Wallet not connected');
    }
    
    // ERC20 standard ABI for approve
    const abi = ['function approve(address spender, uint256 amount) returns (bool)'];
    
    const tokenContract = new ethers.Contract(tokenAddress, abi, this.currentSigner);
    
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
    
    return await this.waitForTransaction(tx.hash);
  }

  // Send a transaction
  public async sendTransaction(
    to: string,
    value: string,
    data: string = '0x',
    gasPriceStrategy: GasPriceStrategy = 'standard'
  ): Promise<EnhancedTransactionReceipt> {
    if (!this.currentSigner) {
      throw new Error('Wallet not connected');
    }
    
    const valueInWei = ethers.utils.parseEther(value);
    
    // Get the optimal gas price based on the selected strategy
    const gasPrice = await this.getOptimalGasPrice(gasPriceStrategy);
    
    // Create transaction object
    const txObject = {
      to,
      value: valueInWei,
      data,
      gasPrice,
    };
    
    // Estimate gas limit
    const estimatedGas = await this.currentProvider!.estimateGas(txObject);
    
    // Add a buffer to the gas estimate for safety
    const gasLimit = estimatedGas.mul(120).div(100); // 20% buffer
    
    // Send the transaction
    const tx = await this.currentSigner.sendTransaction({
      ...txObject,
      gasLimit,
    });
    
    toast({
      title: "Transaction Submitted",
      description: "Processing your transaction...",
    });
    
    return await this.waitForTransaction(tx.hash);
  }

  // Call a smart contract method (read-only)
  public async callContractMethod(
    contractAddress: string,
    abi: ethers.ContractInterface,
    methodName: string,
    params: any[] = []
  ): Promise<any> {
    const provider = this.getCurrentProvider();
    const contract = new ethers.Contract(contractAddress, abi, provider);
    
    try {
      return await contract[methodName](...params);
    } catch (error) {
      console.error(`Error calling ${methodName}:`, error);
      throw error;
    }
  }

  // Execute a smart contract transaction (write)
  public async executeContractTransaction(
    contractAddress: string,
    abi: ethers.ContractInterface,
    methodName: string,
    params: any[] = [],
    value: string = '0',
    gasPriceStrategy: GasPriceStrategy = 'standard',
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
  ): Promise<EnhancedTransactionReceipt> {
    if (!this.currentSigner) {
      throw new Error('Wallet not connected');
    }
    
    const contract = new ethers.Contract(contractAddress, abi, this.currentSigner);
    const valueInWei = ethers.utils.parseEther(value);
    
    // Get the optimal gas price based on the selected strategy
    const gasPrice = await this.getOptimalGasPrice(gasPriceStrategy);
    
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
        
        return await this.waitForTransaction(tx.hash);
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
    return this.withRetry(executeTransaction, retryConfig);
  }

  // Watch a transaction for confirmation
  public async waitForTransaction(
    txHash: string, 
    confirmations: number = 1
  ): Promise<EnhancedTransactionReceipt> {
    const provider = this.getCurrentProvider();
    
    toast({
      title: "Waiting for Confirmation",
      description: `Transaction ${txHash.substring(0, 10)}... pending`,
    });
    
    try {
      const receipt = await provider.waitForTransaction(txHash, confirmations);
      
      const network = this.getNetworkConfig(this.currentChainId);
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
  private async getOptimalGasPrice(strategy: GasPriceStrategy): Promise<BigNumber> {
    const provider = this.getCurrentProvider();
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

  // Retry a transaction with exponential backoff
  private async withRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = config.initialDelayMs;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        console.warn(`Attempt ${attempt} failed:`, error);
        lastError = error;
        
        if (attempt < config.maxAttempts) {
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = delay * config.backoffFactor;
          
          // Adjust gas price for certain errors
          if (
            error.code === 'REPLACEMENT_UNDERPRICED' ||
            error.message?.includes('transaction underpriced')
          ) {
            // Increase gas price for next attempt
            // This logic would be specific to your implementation
            console.log('Increasing gas price for next attempt');
          }
        }
      }
    }
    
    // If we've exhausted all attempts, throw the last error
    throw lastError || new Error('Transaction failed after retries');
  }
}

// Export singleton instance
export const blockchain = new BlockchainService();

// Helper Functions

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
