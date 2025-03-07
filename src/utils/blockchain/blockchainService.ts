import { logger } from '../monitoring/loggingService';
import { ethers } from 'ethers';

export interface BlockchainService {
  provider: ethers.providers.Provider | null;
  isProviderConnected(): Promise<boolean>;
  // ... other methods
}

export class BlockchainServiceImpl implements BlockchainService {
  provider: ethers.providers.Provider | null = null;
  
  constructor() {
    // Initialize provider
    try {
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
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
  
  // ... other methods
}

export const blockchainService = new BlockchainServiceImpl();
