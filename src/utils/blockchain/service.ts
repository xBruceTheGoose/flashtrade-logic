
import { ethers } from 'ethers';
import { networks } from './networks';
import { logger } from '@/utils/monitoring/loggingService';
import { analyticsService } from '@/utils/monitoring/analyticsService';

// Types for the blockchain service
export type NetworkConfig = {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorer: string;
  currencySymbol: string;
};

// Blockchain service for managing connections and interactions
class BlockchainService {
  private provider?: ethers.providers.Web3Provider;
  private networks: Record<number, NetworkConfig>;
  private signer?: ethers.Signer;
  private walletAddress?: string;
  private balance?: string;
  private currentChainId?: number;
  private connectionListeners: Array<(connected: boolean) => void> = [];
  
  constructor() {
    // Initialize with supported networks
    this.networks = networks;
    
    // Check if window.ethereum exists
    this.setupProvider();
    
    // Log the service initialization
    logger.info('blockchain', 'Blockchain service initialized');
  }
  
  private setupProvider() {
    if (typeof window !== 'undefined' && window.ethereum) {
      this.provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
      
      // Listen for account changes
      window.ethereum.on('accountsChanged', this.handleAccountsChanged.bind(this));
      
      // Listen for chain changes
      window.ethereum.on('chainChanged', this.handleChainChanged.bind(this));
    } else {
      console.warn('No ethereum provider found in window');
      logger.warn('blockchain', 'No ethereum provider found in window');
    }
  }
  
  private handleAccountsChanged(accounts: string[]) {
    if (accounts.length === 0) {
      this.walletAddress = undefined;
      this.signer = undefined;
      this.balance = undefined;
      
      this.notifyConnectionListeners(false);
      logger.info('blockchain', 'Wallet disconnected', { reason: 'accountsChanged' });
      
      analyticsService.recordMetric({
        category: 'blockchain',
        name: 'wallet_connected',
        value: 0
      });
    } else if (accounts[0] !== this.walletAddress) {
      this.walletAddress = accounts[0];
      this.setupSigner();
      this.updateBalance();
      
      this.notifyConnectionListeners(true);
      logger.info('blockchain', 'Wallet account changed', { newAddress: accounts[0] });
      
      analyticsService.recordMetric({
        category: 'blockchain',
        name: 'wallet_connected',
        value: 1
      });
    }
  }
  
  private handleChainChanged(chainIdHex: string) {
    // Parse chain ID from hex to decimal
    const chainId = parseInt(chainIdHex, 16);
    this.currentChainId = chainId;
    
    logger.info('blockchain', 'Chain changed', { chainId });
    
    // Reset provider and signer
    this.setupProvider();
    this.setupSigner();
    
    analyticsService.recordMetric({
      category: 'blockchain',
      name: 'chain_changed',
      value: 1,
      metadata: { chainId }
    });
  }
  
  private setupSigner() {
    if (this.provider) {
      this.signer = this.provider.getSigner();
    }
  }
  
  // Connect wallet
  async connectWallet(): Promise<string | undefined> {
    try {
      if (!this.provider) {
        this.setupProvider();
      }
      
      if (!this.provider) {
        logger.error('blockchain', 'Failed to connect wallet: No provider available');
        throw new Error('No Ethereum provider found');
      }
      
      const accounts = await this.provider.send('eth_requestAccounts', []);
      this.walletAddress = accounts[0];
      this.setupSigner();
      await this.updateBalance();
      
      // Get current chain ID
      const network = await this.provider.getNetwork();
      this.currentChainId = network.chainId;
      
      this.notifyConnectionListeners(true);
      logger.info('blockchain', 'Wallet connected', { address: this.walletAddress });
      
      analyticsService.recordMetric({
        category: 'blockchain',
        name: 'wallet_connected',
        value: 1,
        metadata: { address: this.walletAddress }
      });
      
      return this.walletAddress;
    } catch (error) {
      logger.error('blockchain', 'Failed to connect wallet', { error });
      console.error('Error connecting wallet:', error);
      this.notifyConnectionListeners(false);
      throw error;
    }
  }
  
  // Disconnect wallet
  disconnectWallet(): void {
    this.walletAddress = undefined;
    this.signer = undefined;
    this.balance = undefined;
    
    this.notifyConnectionListeners(false);
    logger.info('blockchain', 'Wallet disconnected', { reason: 'manual' });
    
    analyticsService.recordMetric({
      category: 'blockchain',
      name: 'wallet_connected',
      value: 0
    });
  }
  
  // Update wallet balance
  async updateBalance(): Promise<string | undefined> {
    try {
      if (!this.provider || !this.walletAddress) {
        return undefined;
      }
      
      const balance = await this.provider.getBalance(this.walletAddress);
      this.balance = ethers.utils.formatEther(balance);
      
      analyticsService.recordMetric({
        category: 'blockchain',
        name: 'wallet_balance',
        value: parseFloat(this.balance),
        unit: 'ETH'
      });
      
      logger.debug('blockchain', 'Wallet balance updated', { balance: this.balance });
      
      return this.balance;
    } catch (error) {
      logger.error('blockchain', 'Failed to update balance', { error });
      console.error('Error updating balance:', error);
      return undefined;
    }
  }
  
  // Get current provider
  getCurrentProvider(): ethers.providers.Provider {
    if (!this.provider) {
      // Fallback to JsonRpcProvider with mainnet
      logger.warn('blockchain', 'Using fallback JSON-RPC provider');
      return new ethers.providers.JsonRpcProvider(this.networks[1].rpcUrl);
    }
    return this.provider;
  }
  
  // Get signer
  getSigner(): ethers.Signer | undefined {
    return this.signer;
  }
  
  // Check if wallet is connected
  isWalletConnected(): boolean {
    return !!this.walletAddress && !!this.signer;
  }
  
  // Get wallet address
  getWalletAddress(): string | undefined {
    return this.walletAddress;
  }
  
  // Get wallet balance
  getWalletBalance(): string | undefined {
    return this.balance;
  }
  
  // Get current chain ID
  getCurrentChainId(): number | undefined {
    return this.currentChainId;
  }
  
  // Get network config for chain ID
  getNetworkConfig(chainId: number): NetworkConfig {
    return this.networks[chainId] || this.networks[1]; // Fallback to mainnet
  }
  
  // Add connection listener
  addConnectionListener(listener: (connected: boolean) => void): void {
    this.connectionListeners.push(listener);
  }
  
  // Remove connection listener
  removeConnectionListener(listener: (connected: boolean) => void): void {
    this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
  }
  
  // Notify all connection listeners
  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }
  
  // Switch network
  async switchNetwork(chainId: number): Promise<boolean> {
    try {
      if (!this.provider || !window.ethereum) {
        logger.error('blockchain', 'Cannot switch network: No provider');
        return false;
      }
      
      const network = this.networks[chainId];
      if (!network) {
        logger.error('blockchain', 'Cannot switch network: Unsupported chain ID', { chainId });
        return false;
      }
      
      const chainIdHex = '0x' + chainId.toString(16);
      
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        });
        
        this.currentChainId = chainId;
        logger.info('blockchain', 'Switched network', { chainId, network: network.name });
        
        analyticsService.recordMetric({
          category: 'blockchain',
          name: 'network_switched',
          value: chainId,
          metadata: { networkName: network.name }
        });
        
        return true;
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask.
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: chainIdHex,
                  chainName: network.name,
                  nativeCurrency: {
                    name: network.currencySymbol,
                    symbol: network.currencySymbol,
                    decimals: 18,
                  },
                  rpcUrls: [network.rpcUrl],
                  blockExplorerUrls: [network.explorer],
                },
              ],
            });
            
            this.currentChainId = chainId;
            logger.info('blockchain', 'Added and switched network', { 
              chainId, 
              network: network.name 
            });
            
            analyticsService.recordMetric({
              category: 'blockchain',
              name: 'network_added',
              value: chainId,
              metadata: { networkName: network.name }
            });
            
            return true;
          } catch (addError) {
            logger.error('blockchain', 'Failed to add network', { error: addError });
            console.error('Error adding chain:', addError);
            return false;
          }
        }
        
        logger.error('blockchain', 'Failed to switch network', { error: switchError });
        console.error('Error switching chain:', switchError);
        return false;
      }
    } catch (error) {
      logger.error('blockchain', 'Error in switchNetwork', { error });
      console.error('Error:', error);
      return false;
    }
  }
}

// Create and export a singleton instance
export const blockchain = new BlockchainService();
