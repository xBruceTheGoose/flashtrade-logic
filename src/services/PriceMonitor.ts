import { ethers } from 'ethers';
import { LRUCache } from 'lru-cache';
import { trackMetric } from '../config/monitoring';

interface PriceData {
  price: ethers.BigNumber;
  timestamp: number;
  source: string;
}

interface PriceUpdate {
  pair: string;
  data: PriceData;
}

// Circular buffer for price history
class PriceHistory {
  private buffer: PriceData[];
  private head: number = 0;
  private size: number = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(data: PriceData): void {
    this.buffer[this.head] = data;
    this.head = (this.head + 1) % this.capacity;
    this.size = Math.min(this.size + 1, this.capacity);
  }

  getRecent(count: number): PriceData[] {
    const result: PriceData[] = [];
    let current = (this.head - 1 + this.capacity) % this.capacity;
    
    for (let i = 0; i < Math.min(count, this.size); i++) {
      result.push(this.buffer[current]);
      current = (current - 1 + this.capacity) % this.capacity;
    }
    
    return result;
  }
}

export class PriceMonitor {
  private priceCache: LRUCache<string, PriceData>;
  private priceHistory: Map<string, PriceHistory>;
  private subscribers: Map<string, Set<(update: PriceUpdate) => void>>;
  private worker: Worker;

  constructor(
    private readonly provider: ethers.providers.Provider,
    private readonly maxHistorySize: number = 1000
  ) {
    // Initialize LRU cache with max 1000 items
    this.priceCache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60, // 1 minute TTL
      updateAgeOnGet: true
    });

    this.priceHistory = new Map();
    this.subscribers = new Map();
    
    // Initialize WebWorker for price calculations
    this.worker = new Worker(new URL('../workers/price.worker.ts', import.meta.url));
    this.setupWorker();
  }

  private setupWorker(): void {
    this.worker.onmessage = (event) => {
      const { pair, analysis } = event.data;
      this.notifySubscribers(pair, analysis);
    };
  }

  async monitorPrice(pair: string): Promise<void> {
    if (!this.priceHistory.has(pair)) {
      this.priceHistory.set(pair, new PriceHistory(this.maxHistorySize));
    }

    try {
      const price = await this.fetchPrice(pair);
      this.updatePrice(pair, price);
    } catch (error) {
      console.error(`Error monitoring price for ${pair}:`, error);
      trackMetric('price_monitor_error', 1);
    }
  }

  private async fetchPrice(pair: string): Promise<PriceData> {
    // Check cache first
    const cached = this.priceCache.get(pair);
    if (cached && Date.now() - cached.timestamp < 1000) { // 1 second cache
      return cached;
    }

    // Implement actual price fetching logic here
    const price = ethers.BigNumber.from(0); // Placeholder
    const data: PriceData = {
      price,
      timestamp: Date.now(),
      source: 'dex'
    };

    this.priceCache.set(pair, data);
    return data;
  }

  private updatePrice(pair: string, data: PriceData): void {
    const history = this.priceHistory.get(pair);
    if (history) {
      history.push(data);
      
      // Offload analysis to WebWorker
      this.worker.postMessage({
        type: 'analyze',
        pair,
        history: history.getRecent(100)
      });
    }
  }

  subscribe(pair: string, callback: (update: PriceUpdate) => void): () => void {
    if (!this.subscribers.has(pair)) {
      this.subscribers.set(pair, new Set());
    }
    
    this.subscribers.get(pair)!.add(callback);
    
    return () => {
      const subs = this.subscribers.get(pair);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(pair);
        }
      }
    };
  }

  private notifySubscribers(pair: string, data: PriceData): void {
    const subs = this.subscribers.get(pair);
    if (subs) {
      const update: PriceUpdate = { pair, data };
      subs.forEach(callback => callback(update));
    }
  }

  // Memory management
  cleanup(): void {
    this.priceCache.clear();
    this.priceHistory.clear();
    this.subscribers.clear();
    this.worker.terminate();
  }
}
