import { logger } from '../monitoring/loggingService';
import { ethers } from 'ethers';

export interface BlockchainService {
  provider: ethers.providers.Provider | null;
  isProviderConnected(): Promise<boolean>;
  getProviderInfo(): Promise<{ name: string; network: string | null }>;
  // ... other methods
}

export class BlockchainServiceImpl implements BlockchainService {
  provider: ethers.providers.Provider | null = null;
  
  constructor() {
    // Initialize provider
    try {
      // Check if window.ethereum exists (MetaMask or other injected provider)
      if (typeof window !== 'undefined' && window.ethereum) {
        this.provider = new ethers.providers.Web3Provider(window.ethereum);
        logger.info('blockchain', 'Blockchain provider initialized successfully');
      } else {
        // Fallback to a public provider for read-only functionality
        this.provider = ethers.getDefaultProvider('mainnet');
        logger.warn('blockchain', 'No wallet detected, using fallback read-only provider');
      }
    } catch (error) {
      logger.error('blockchain', 'Failed to initialize blockchain provider', { error });
      this.provider = null;
    }
  }
  
  async isProviderConnected(): Promise<boolean> {
    if (!this.provider) return false;
    
    try {
      // Test the connection by requesting the network
      const network = await this.provider.getNetwork();
      return network.chainId > 0;
    } catch (error) {
      logger.error('blockchain', 'Provider connection check failed', { error });
      return false;
    }
  }
  
  async getProviderInfo(): Promise<{ name: string; network: string | null }> {
    if (!this.provider) {
      return { name: 'None', network: null };
    }
    
    try {
      const network = await this.provider.getNetwork();
      const networkName = network.name !== 'unknown' ? network.name : `Chain ID: ${network.chainId}`;
      
      // Determine provider type
      let providerName = 'Unknown';
      
      if (this.provider instanceof ethers.providers.Web3Provider) {
        // Check if MetaMask
        if (window.ethereum?.isMetaMask) {
          providerName = 'MetaMask';
        } else if (window.ethereum?.isCoinbaseWallet) {
          providerName = 'Coinbase Wallet';
        } else {
          providerName = 'Browser Wallet';
        }
      } else if (this.provider instanceof ethers.providers.JsonRpcProvider) {
        providerName = 'JSON RPC';
      } else if (this.provider instanceof ethers.providers.InfuraProvider) {
        providerName = 'Infura';
      } else if (this.provider instanceof ethers.providers.AlchemyProvider) {
        providerName = 'Alchemy';
      } else if (this.provider instanceof ethers.providers.FallbackProvider) {
        providerName = 'Fallback Provider';
      } else if (this.provider instanceof ethers.providers.IpcProvider) {
        providerName = 'IPC';
      } else if (this.provider instanceof ethers.providers.UrlJsonRpcProvider) {
        providerName = 'URL JSON RPC';
      }
      
      return { name: providerName, network: networkName };
    } catch (error) {
      logger.error('blockchain', 'Failed to get provider info', { error });
      return { name: 'Error', network: null };
    }
  }
  
  // ... other methods
}

export const blockchainService = new BlockchainServiceImpl();
