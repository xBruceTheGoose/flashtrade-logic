
import { ArbitrageOpportunity } from '@/types';
import { 
  ExecutionOptions, 
  TradeExecutionRecord
} from './types';
import { tradeExecutionStorage } from './storage';
import { toast } from '@/hooks/use-toast';
import { DEFAULT_EXECUTION_OPTIONS } from './executionService';

/**
 * Queue Management Service
 * Handles queuing of arbitrage opportunities for execution
 */
class QueueManager {
  /**
   * Queue an arbitrage opportunity for execution
   */
  queueExecution(
    opportunity: ArbitrageOpportunity,
    options: Partial<ExecutionOptions> = {}
  ): string | null {
    try {
      // Create a minimal implementation that adds a record
      const record = tradeExecutionStorage.addRecord({
        opportunityId: opportunity.id,
        timestamp: Date.now(),
        tokenIn: opportunity.tokenIn.address,
        tokenOut: opportunity.tokenOut.address,
        tokenInSymbol: opportunity.tokenIn.symbol,
        tokenOutSymbol: opportunity.tokenOut.symbol,
        sourceDex: opportunity.sourceDex.id,
        targetDex: opportunity.targetDex.id,
        tradeSize: opportunity.tradeSize || '0',
        expectedProfit: opportunity.estimatedProfit,
        status: 'pending',
        success: false
      });
      
      toast({
        title: "Trade Queued",
        description: `Added arbitrage opportunity to execution queue.`
      });
      
      return record.id;
    } catch (error) {
      console.error('Error queueing trade execution:', error);
      toast({
        title: "Queue Error",
        description: "Failed to queue trade for execution.",
        variant: "destructive"
      });
      return null;
    }
  }

  /**
   * Get all execution records
   */
  getExecutionRecords(): TradeExecutionRecord[] {
    return tradeExecutionStorage.getRecords();
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return tradeExecutionStorage.getPerformanceStats();
  }
}

// Export singleton instance
export const queueManager = new QueueManager();
