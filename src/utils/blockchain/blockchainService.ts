
import { logger } from '../monitoring/loggingService';
import { ethers } from 'ethers';
import { toast } from '@/hooks/use-toast';

// Cache configuration
interface CacheConfig {
  maxAge: number; // milliseconds
  maxSize: number; // number of entries
  cleanupInterval: number; // milliseconds
}

// Cache entry
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

// Request batch
interface RequestBatch<T> {
  promise: Promise<T>;
  timestamp: number;
  resolvers: ((value: T) => void)[];
  rejecters: ((reason: any) => void)[];
}

// Connection state
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface BlockchainService {
  provider: ethers.providers.Provider | null;
  isProviderConnected(): Promise<boolean>;
  getProviderInfo(): Promise<{ name: string; network: string | null }>;
  batchedCall<T>(method: string, params: any[]): Promise<T>;
  // ... other methods
}

export class BlockchainServiceImpl implements BlockchainService {
  provider: ethers.providers.Provider | null = null;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private pendingBatches: Map<string, RequestBatch<any>> = new Map();
  private connectionState: ConnectionState = 'disconnected';
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 3;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Configuration
  private cacheConfig: CacheConfig = {
    maxAge: 10000, // 10 seconds default cache time
    maxSize: 200, // Maximum 200 entries in cache
    cleanupInterval: 60000 // Clean cache every minute
  };
  private batchWindow: number = 50; // ms to batch requests
  private lastCacheCleanup: number = Date.now();
  
  constructor() {
    this.initializeProvider();
    
    // Set up periodic cache cleanup
    setInterval(() => this.cleanupCache(), this.cacheConfig.cleanupInterval);
  }
  
  private async initializeProvider(): Promise<void> {
    try {
      this.connectionState = 'connecting';
      this.connectionAttempts++;
      
      logger.info('blockchain', 'Initializing blockchain provider...');
      
      // Check if window.ethereum exists (MetaMask or other injected provider)
      if (typeof window !== 'undefined' && window.ethereum) {
        this.provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // Set up event listeners for connection status
        window.ethereum.on('connect', () => {
          logger.info('blockchain', 'Provider connected');
          this.connectionState = 'connected';
          this.connectionAttempts = 0;
        });
        
        window.ethereum.on('disconnect', (error: any) => {
          logger.warn('blockchain', 'Provider disconnected', { error });
          this.connectionState = 'disconnected';
          this.scheduleReconnect();
        });
        
        window.ethereum.on('chainChanged', (_chainId: string) => {
          logger.info('blockchain', 'Network changed, reloading...');
          window.location.reload();
        });
        
        // Test connection
        const network = await this.provider.getNetwork();
        this.connectionState = 'connected';
        this.connectionAttempts = 0;
        
        logger.info('blockchain', 'Blockchain provider initialized successfully', { 
          network: network.name, 
          chainId: network.chainId 
        });
      } else {
        // Fallback to a public provider for read-only functionality
        this.provider = ethers.getDefaultProvider('mainnet');
        this.connectionState = 'connected';
        logger.warn('blockchain', 'No wallet detected, using fallback read-only provider');
      }
    } catch (error) {
      this.connectionState = 'error';
      logger.error('blockchain', 'Failed to initialize blockchain provider', { error });
      this.provider = null;
      
      this.scheduleReconnect();
    }
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Exponential backoff for reconnect attempts
    const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts - 1), 30000);
    
    if (this.connectionAttempts <= this.maxConnectionAttempts) {
      logger.info('blockchain', `Scheduling reconnect attempt ${this.connectionAttempts} in ${delay}ms`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.initializeProvider();
      }, delay);
    } else {
      logger.error('blockchain', 'Max reconnection attempts reached');
      
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to blockchain after multiple attempts. Please check your network connection.',
        variant: 'destructive',
      });
    }
  }
  
  async isProviderConnected(): Promise<boolean> {
    if (!this.provider) return false;
    
    try {
      // Test the connection by requesting the network
      const network = await this.provider.getNetwork();
      this.connectionState = 'connected';
      return network.chainId > 0;
    } catch (error) {
      this.connectionState = 'error';
      logger.error('blockchain', 'Provider connection check failed', { error });
      return false;
    }
  }
  
  async getProviderInfo(): Promise<{ name: string; network: string | null }> {
    if (!this.provider) {
      return { name: 'None', network: null };
    }
    
    try {
      // Use cached network info if available
      const cacheKey = 'provider_network_info';
      const cached = this.getFromCache<{ name: string; network: string | null }>(cacheKey);
      
      if (cached) {
        return cached;
      }
      
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
      
      const result = { name: providerName, network: networkName };
      
      // Cache the result
      this.addToCache(cacheKey, result, 30000); // Cache for 30 seconds
      
      return result;
    } catch (error) {
      logger.error('blockchain', 'Failed to get provider info', { error });
      return { name: 'Error', network: null };
    }
  }
  
  // Generic method to batch calls to the blockchain
  async batchedCall<T>(method: string, params: any[]): Promise<T> {
    if (!this.provider) {
      throw new Error('No provider available');
    }
    
    if (this.connectionState !== 'connected') {
      throw new Error('Provider not connected');
    }
    
    // Create a unique key for this request
    const requestKey = `${method}:${JSON.stringify(params)}`;
    
    // Check cache first
    const cachedResult = this.getFromCache<T>(requestKey);
    if (cachedResult !== null) {
      logger.debug('blockchain', 'Cache hit', { method, params });
      return cachedResult;
    }
    
    // Check if there's already a batch for this request
    const existingBatch = this.pendingBatches.get(requestKey);
    if (existingBatch) {
      // Add to existing batch
      return new Promise<T>((resolve, reject) => {
        existingBatch.resolvers.push(resolve);
        existingBatch.rejecters.push(reject);
      });
    }
    
    // Create a new batch
    let batchPromiseResolve: (value: T) => void;
    let batchPromiseReject: (reason: any) => void;
    
    const batchPromise = new Promise<T>((resolve, reject) => {
      batchPromiseResolve = resolve;
      batchPromiseReject = reject;
    });
    
    const batch: RequestBatch<T> = {
      promise: batchPromise,
      timestamp: Date.now(),
      resolvers: [batchPromiseResolve!],
      rejecters: [batchPromiseReject!]
    };
    
    this.pendingBatches.set(requestKey, batch);
    
    // Execute after batch window
    setTimeout(() => this.executeBatch(requestKey, method, params), this.batchWindow);
    
    return batchPromise;
  }
  
  private async executeBatch<T>(requestKey: string, method: string, params: any[]): Promise<void> {
    const batch = this.pendingBatches.get(requestKey);
    if (!batch) return;
    
    this.pendingBatches.delete(requestKey);
    
    try {
      // Execute the request
      const result = await (this.provider as any)[method](...params);
      
      // Cache the result - adjust TTL based on method type
      let cacheTTL = this.cacheConfig.maxAge;
      if (method.includes('getBlock') || method.includes('getTransaction')) {
        cacheTTL = 60000; // Cache blocks and txs longer (1 minute)
      } else if (method.includes('getCode') || method.includes('getStorageAt')) {
        cacheTTL = 300000; // Cache contract code and storage even longer (5 minutes)
      }
      
      this.addToCache(requestKey, result, cacheTTL);
      
      // Resolve all promises
      batch.resolvers.forEach(resolve => resolve(result));
    } catch (error) {
      // Reject all promises
      batch.rejecters.forEach(reject => reject(error));
      logger.error('blockchain', `Batch execution failed for ${method}`, { error, params });
      
      // If this is a connection error, update connection state
      if (
        error.message?.includes('connection') || 
        error.message?.includes('network') ||
        error.message?.includes('disconnected')
      ) {
        this.connectionState = 'disconnected';
        this.scheduleReconnect();
      }
    }
  }
  
  // Cache management methods
  private addToCache<T>(key: string, value: T, customMaxAge?: number): void {
    // Enforce cache size limit
    if (this.cache.size >= this.cacheConfig.maxSize) {
      this.pruneCache();
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 1
    });
  }
  
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    if (now - entry.timestamp > this.cacheConfig.maxAge) {
      // Entry expired
      this.cache.delete(key);
      return null;
    }
    
    // Increment hit count
    entry.hits++;
    
    return entry.value as T;
  }
  
  private pruneCache(): void {
    // Strategy: remove least recently used or least frequently used entries
    // We'll use a combination approach
    
    // First, remove expired entries
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheConfig.maxAge) {
        this.cache.delete(key);
      }
    }
    
    // If still over limit, remove least frequently used entries
    if (this.cache.size >= this.cacheConfig.maxSize) {
      // Sort entries by hit count
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].hits - b[1].hits);
      
      // Remove bottom 20%
      const toRemove = Math.ceil(this.cacheConfig.maxSize * 0.2);
      for (let i = 0; i < toRemove && i < entries.length; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }
  
  private cleanupCache(): void {
    const now = Date.now();
    this.lastCacheCleanup = now;
    
    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheConfig.maxAge) {
        this.cache.delete(key);
      }
    }
  }
  
  // Update cache configuration
  setCacheConfig(config: Partial<CacheConfig>): void {
    this.cacheConfig = { ...this.cacheConfig, ...config };
  }
  
  // Update batch window
  setBatchWindow(windowMs: number): void {
    this.batchWindow = windowMs;
  }
  
  // Clear cache
  clearCache(): void {
    this.cache.clear();
    this.lastCacheCleanup = Date.now();
    logger.info('blockchain', 'Cache cleared');
  }
  
  // Public getter for connection state
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }
  
  // Get current provider
  getCurrentProvider(): ethers.providers.Provider {
    if (!this.provider) {
      throw new Error('No provider available');
    }
    return this.provider;
  }
  
  // Get signer (if available)
  getSigner(): ethers.Signer | null {
    if (this.provider instanceof ethers.providers.Web3Provider) {
      try {
        return this.provider.getSigner();
      } catch (error) {
        logger.error('blockchain', 'Failed to get signer', { error });
        return null;
      }
    }
    return null;
  }
}

export const blockchainService = new BlockchainServiceImpl();
