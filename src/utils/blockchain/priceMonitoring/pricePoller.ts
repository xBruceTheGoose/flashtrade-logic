
import { Token, DEX } from '@/types';
import { RateLimiter } from './rateLimit';
import { priceHistoryStorage } from './storage';
import { dexManager } from '@/utils/dex/DEXManager';
import { TokenPair, PricePoint } from './types';

/**
 * Handles polling prices via REST APIs
 */
export class PricePoller {
  private rateLimiter: RateLimiter;
  
  constructor(maxRequestsPerMinute: number) {
    this.rateLimiter = new RateLimiter("PricePoller", maxRequestsPerMinute, 60000);
  }
  
  /**
   * Update the rate limiter settings
   */
  updateRateLimiter(maxRequestsPerMinute: number): void {
    this.rateLimiter = new RateLimiter("PricePoller", maxRequestsPerMinute, 60000);
  }
  
  /**
   * Get requests remaining before hitting rate limit
   */
  getRequestsRemaining(): number {
    return this.rateLimiter.getRequestsRemaining();
  }

  /**
   * Poll prices for all token pairs across all DEXes
   */
  async pollPrices(pairs: TokenPair[], activeDexes: DEX[]): Promise<void> {
    if (pairs.length === 0 || activeDexes.length === 0) {
      return;
    }
    
    try {
      for (const pair of pairs) {
        for (const dex of activeDexes) {
          // Check rate limits
          if (!this.rateLimiter.canMakeRequest()) {
            console.warn('Rate limit reached, skipping price poll');
            return;
          }
          
          try {
            this.rateLimiter.recordRequest();
            
            const adapter = dexManager.getAdapter(dex.id);
            if (!adapter) {
              continue;
            }
            
            // Get price from DEX
            const price = await adapter.getTokenPrice(pair.tokenA, pair.tokenB);
            
            // Store price data
            const pricePoint: PricePoint = {
              timestamp: Date.now(),
              price,
              dexId: dex.id,
            };
            
            priceHistoryStorage.addPricePoint(pair.tokenA.address, pricePoint);
          } catch (error) {
            console.error(`Error polling price for ${pair.tokenA.symbol}/${pair.tokenB.symbol} on ${dex.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error polling prices:', error);
    }
  }
}
