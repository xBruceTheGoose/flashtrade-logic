
import { Token, DEX, ArbitrageOpportunity } from '@/types';
import { arbitrageDetectionEngine } from './arbitrageDetection';
import { opportunityManager } from './opportunityManager';
import { monitoringConfig } from './config';
import { toast } from '@/hooks/use-toast';

/**
 * Scanner for detecting arbitrage opportunities
 */
export class ArbitrageScanner {
  private lastScanTime: number = 0;
  private scanInterval: number = 60000; // 1 minute

  /**
   * Check if it's time to scan for opportunities
   */
  shouldScan(now: number = Date.now()): boolean {
    return now - this.lastScanTime >= this.scanInterval;
  }

  /**
   * Update the last scan time
   */
  updateLastScanTime(time: number = Date.now()): void {
    this.lastScanTime = time;
  }

  /**
   * Set the scan interval
   */
  setScanInterval(intervalMs: number): void {
    this.scanInterval = intervalMs;
  }

  /**
   * Get the last scan time
   */
  getLastScanTime(): number {
    return this.lastScanTime;
  }

  /**
   * Scan for arbitrage opportunities across DEXes
   */
  async scanForOpportunities(tokens: Token[], activeDexes: DEX[]): Promise<ArbitrageOpportunity[]> {
    if (activeDexes.length < 2) {
      return [];
    }
    
    try {
      // Use arbitrage detection engine to scan for opportunities
      const opportunities = await arbitrageDetectionEngine.scanForOpportunities(
        tokens,
        activeDexes
      );
      
      // Process new opportunities
      for (const opportunity of opportunities) {
        // Add to pending opportunities
        opportunityManager.addOpportunity(opportunity);
        
        // If auto-execute is enabled, execute the trade
        if (monitoringConfig.getConfig().autoExecuteTrades) {
          opportunityManager.executeOpportunity(opportunity);
        } else {
          // Notify user of opportunity
          toast({
            title: "Arbitrage Opportunity",
            description: `${opportunity.tokenIn.symbol}: ${opportunity.profitPercentage.toFixed(2)}% profit between ${opportunity.sourceDex.name} and ${opportunity.targetDex.name}`,
          });
        }
      }
      
      this.updateLastScanTime();
      return opportunities;
    } catch (error) {
      console.error('Error scanning for arbitrage opportunities:', error);
      return [];
    }
  }
}

// Export singleton instance
export const arbitrageScanner = new ArbitrageScanner();
