
import { PriceHistory, PricePoint } from './types';

// In-memory storage for price history
class PriceHistoryStorage {
  private priceHistories: Map<string, PriceHistory> = new Map();
  private maxHistoryLength: number = 1000;

  setMaxHistoryLength(length: number): void {
    this.maxHistoryLength = length;
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
    
    // Trim if exceeding max length
    if (history.pricePoints.length > this.maxHistoryLength) {
      history.pricePoints = history.pricePoints.slice(-this.maxHistoryLength);
    }
  }

  getPriceHistory(tokenAddress: string): PriceHistory | null {
    const key = tokenAddress.toLowerCase();
    return this.priceHistories.get(key) || null;
  }

  getLatestPrice(tokenAddress: string, dexId?: string): number | null {
    const history = this.getPriceHistory(tokenAddress);
    
    if (!history || history.pricePoints.length === 0) {
      return null;
    }
    
    if (dexId) {
      // Find latest price from specific DEX
      const dexPrices = history.pricePoints
        .filter(pp => pp.dexId === dexId)
        .sort((a, b) => b.timestamp - a.timestamp);
        
      return dexPrices.length > 0 ? dexPrices[0].price : null;
    }
    
    // Find latest price from any DEX
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
      }
    });
  }
}

// Export singleton instance
export const priceHistoryStorage = new PriceHistoryStorage();
