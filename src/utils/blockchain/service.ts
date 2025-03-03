
import { ethers, BigNumber } from 'ethers';
import { WalletType } from '@/types';
import { getNetworkName } from '@/utils/wallet';
import { toast } from '@/hooks/use-toast';
import { NETWORKS } from './networks';
import { RetryConfig, DEFAULT_RETRY_CONFIG, EnhancedTransactionReceipt, GasPriceStrategy } from './types';

// Network providers cache
const providers: Record<number, ethers.providers.Provider> = {};

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
