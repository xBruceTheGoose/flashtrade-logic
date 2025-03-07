import { logger } from '../monitoring/loggingService';
import { ethers } from 'ethers';

// Cache configuration
interface CacheConfig {
  maxAge: number; // milliseconds
  maxSize: number; // number of entries
}

// Cache entry
interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

// Request batch
interface RequestBatch<T> {
  promise: Promise<T>;
  timestamp: number;
  resolvers: ((value: T) => void)[];
  rejecters: ((reason: any) => void)[];
}

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
  private cacheConfig: CacheConfig = {
    maxAge: 10000, // 10 seconds default cache time
    maxSize: 100 // Maximum 100 entries in cache
  };
  private pendingBatches: Map<string, RequestBatch<any>> = new Map();
  private batchWindow: number = 50; // ms to batch requests
  private lastCacheCleanup: number = Date.now();
  private cleanupInterval: number = 60000; // Clean cache every minute
  
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
    
    // Clean up cache if needed
    this.cleanupCacheIfNeeded();
    
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
      
      // Cache the result
      this.addToCache(requestKey, result);
      
      // Resolve all promises
      batch.resolvers.forEach(resolve => resolve(result));
    } catch (error) {
      // Reject all promises
      batch.rejecters.forEach(reject => reject(error));
      logger.error('blockchain', `Batch execution failed for ${method}`, { error, params });
    }
  }
  
  // Cache management methods
  private addToCache<T>(key: string, value: T, customMaxAge?: number): void {
    // Enforce cache size limit
    if (this.cache.size >= this.cacheConfig.maxSize) {
      // Remove oldest entry
      let oldestKey: string | null = null;
      let oldestTime = Date.now();
      
      for (const [k, entry] of this.cache.entries()) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = k;
        }
      }
      
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now()
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
    
    return entry.value as T;
  }
  
  private cleanupCacheIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastCacheCleanup > this.cleanupInterval) {
      this.lastCacheCleanup = now;
      
      // Remove expired entries
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.cacheConfig.maxAge) {
          this.cache.delete(key);
        }
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
  }
  
  // ... other methods
}

export const blockchainService = new BlockchainServiceImpl();
