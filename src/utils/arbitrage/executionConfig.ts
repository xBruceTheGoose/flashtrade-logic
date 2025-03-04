
import { ExecutionConfig } from './types';
import { toast } from '@/hooks/use-toast';

// Default execution configuration
const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  minProfitPercentage: 0.5,
  maxTradeSize: 1.0,
  slippageTolerance: 0.5,
  gasPrice: 'auto',
  autoExecute: false,
  riskTolerance: 'medium',
  executionStrategy: 'sequential',
  maxConcurrentTrades: 2
};

/**
 * Execution Configuration Manager
 * Handles storage and updates of trade execution configuration
 */
class ExecutionConfigManager {
  private config: ExecutionConfig = { ...DEFAULT_EXECUTION_CONFIG };

  /**
   * Get the current execution configuration
   */
  getExecutionConfig(): ExecutionConfig {
    return { ...this.config };
  }

  /**
   * Update execution configuration
   */
  updateExecutionConfig(updates: Partial<ExecutionConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('Execution configuration updated:', this.config);
    
    toast({
      title: 'Configuration Updated',
      description: 'Trade execution settings have been updated'
    });
  }
}

// Export singleton instance
export const executionConfigManager = new ExecutionConfigManager();
