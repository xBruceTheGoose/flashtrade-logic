
import { PriceHistory, PricePoint } from './types';

// In-memory storage for price history with efficient indexing
class PriceHistoryStorage {
  private priceHistories: Map<string, PriceHistory> = new Map();
  private dexPriceIndex: Map<string, Map<string, PricePoint>> = new Map(); // dexId -> tokenAddress -> latest price
  private maxHistoryLength: number = 1000;
  private cacheExpiryMs: number = 60000; // 1 minute cache expiry
  private lastCleanup: number = Date.now();

  setMaxHistoryLength(length: number): void {
    this.maxHistoryLength = length;
  }

  setCacheExpiry(expiryMs: number): void {
    this.cacheExpiryMs = expiryMs;
  }

  addPricePoint(tokenAddress: string, pricePoint: PricePoint): void {
    const key = tokenAddress.toLowerCase();
    
    if (!this.priceHistories.has(key)) {
      this.priceHistories.set(key, {
        tokenAddress: key,
        pricePoints: [],
      });
    }
    
    const history = this.priceHistories.get(key)!;
    
    // Add new price point
    history.pricePoints.push(pricePoint);
    
    // Update dex price index for fast lookups
    if (!this.dexPriceIndex.has(pricePoint.dexId)) {
      this.dexPriceIndex.set(pricePoint.dexId, new Map());
    }
    
    // Update the latest price point in the index
    this.dexPriceIndex.get(pricePoint.dexId)!.set(key, pricePoint);
    
    // Trim if exceeding max length
    if (history.pricePoints.length > this.maxHistoryLength) {
      history.pricePoints = history.pricePoints.slice(-this.maxHistoryLength);
    }
    
    // Perform cleanup if needed
    const now = Date.now();
    if (now - this.lastCleanup > 300000) { // Cleanup every 5 minutes
      this.lastCleanup = now;
      this.clearOldData(24 * 3600 * 1000); // Clear data older than 24 hours
    }
  }

  getPriceHistory(tokenAddress: string): PriceHistory | null {
    const key = tokenAddress.toLowerCase();
    return this.priceHistories.get(key) || null;
  }

  getLatestPrice(tokenAddress: string, dexId?: string): number | null {
    const key = tokenAddress.toLowerCase();
    
    if (dexId) {
      // Fast lookup from index for specific DEX
      const dexMap = this.dexPriceIndex.get(dexId);
      if (dexMap && dexMap.has(key)) {
        return dexMap.get(key)!.price;
      }
      
      // Fallback to full search if not in index
      const history = this.getPriceHistory(key);
      if (!history || history.pricePoints.length === 0) {
        return null;
      }
      
      const dexPrices = history.pricePoints
        .filter(pp => pp.dexId === dexId)
        .sort((a, b) => b.timestamp - a.timestamp);
        
      return dexPrices.length > 0 ? dexPrices[0].price : null;
    }
    
    // Get latest price from any DEX using the indices
    const latestPrices: PricePoint[] = [];
    for (const dexMap of this.dexPriceIndex.values()) {
      if (dexMap.has(key)) {
        latestPrices.push(dexMap.get(key)!);
      }
    }
    
    if (latestPrices.length > 0) {
      // Find the most recent price
      return latestPrices.sort((a, b) => b.timestamp - a.timestamp)[0].price;
    }
    
    // Fallback to full search if not in index
    const history = this.getPriceHistory(key);
    if (!history || history.pricePoints.length === 0) {
      return null;
    }
    
    const latestPoint = history.pricePoints
      .sort((a, b) => b.timestamp - a.timestamp)[0];
      
    return latestPoint ? latestPoint.price : null;
  }

  getPriceVolatility(tokenAddress: string, timeWindowMs: number = 3600000): number {
    const history = this.getPriceHistory(tokenAddress);
    
    if (!history || history.pricePoints.length < 2) {
      return 0;
    }
    
    const now = Date.now();
    const relevantPoints = history.pricePoints
      .filter(pp => (now - pp.timestamp) <= timeWindowMs)
      .map(pp => pp.price);
      
    if (relevantPoints.length < 2) {
      return 0;
    }
    
    const min = Math.min(...relevantPoints);
    const max = Math.max(...relevantPoints);
    const avg = relevantPoints.reduce((sum, price) => sum + price, 0) / relevantPoints.length;
    
    // Calculate volatility as (max-min)/avg as a percentage
    return (max - min) / avg * 100;
  }

  clearOldData(maxAgeMs: number): void {
    const cutoffTime = Date.now() - maxAgeMs;
    
    this.priceHistories.forEach((history, key) => {
      history.pricePoints = history.pricePoints.filter(
        pp => pp.timestamp >= cutoffTime
      );
      
      // Remove entries with no price points
      if (history.pricePoints.length === 0) {
        this.priceHistories.delete(key);
        
        // Also clean up the indices
        for (const dexMap of this.dexPriceIndex.values()) {
          dexMap.delete(key);
        }
      }
    });
    
    // Clean up empty DEX maps from the index
    for (const [dexId, dexMap] of this.dexPriceIndex.entries()) {
      if (dexMap.size === 0) {
        this.dexPriceIndex.delete(dexId);
      }
    }
  }
}

// Export singleton instance
export const priceHistoryStorage = new PriceHistoryStorage();
