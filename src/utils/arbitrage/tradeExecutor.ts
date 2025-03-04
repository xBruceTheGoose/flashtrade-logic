
import { ArbitrageOpportunity } from '@/types';
import { 
  ExecutionOptions, 
  ExecutionResult,
  ExecutionConfig,
  TradeExecutionRecord
} from './types';
import { executionConfigManager } from './executionConfig';
import { executionService, DEFAULT_EXECUTION_OPTIONS } from './executionService';
import { queueManager } from './queueManager';

/**
 * Trade Executor Facade
 * Provides a unified interface to all execution related functionality
 */
class TradeExecutor {
  constructor() {
    console.log('Trade Executor initialized');
  }

  /**
   * Get the current execution configuration
   */
  getExecutionConfig(): ExecutionConfig {
    return executionConfigManager.getExecutionConfig();
  }

  /**
   * Update execution configuration
   */
  updateExecutionConfig(updates: Partial<ExecutionConfig>): void {
    executionConfigManager.updateExecutionConfig(updates);
  }

  /**
   * Queue an arbitrage opportunity for execution
   */
  queueExecution(
    opportunity: ArbitrageOpportunity,
    options: Partial<ExecutionOptions> = {}
  ): string | null {
    return queueManager.queueExecution(opportunity, options);
  }

  /**
   * Execute a trade directly
   */
  async executeTrade(
    opportunity: ArbitrageOpportunity,
    options: Partial<ExecutionOptions> = {}
  ): Promise<ExecutionResult> {
    return executionService.executeTrade(opportunity, options);
  }

  /**
   * Auto-execute a trade if it meets criteria
   */
  async autoExecuteTrade(opportunity: ArbitrageOpportunity): Promise<boolean> {
    return executionService.autoExecuteTrade(opportunity);
  }

  /**
   * Get all execution records
   */
  getExecutionRecords(): TradeExecutionRecord[] {
    return queueManager.getExecutionRecords();
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return queueManager.getPerformanceStats();
  }
}

// Export singleton instance
export const tradeExecutor = new TradeExecutor();
