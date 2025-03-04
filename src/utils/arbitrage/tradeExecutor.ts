import { ethers } from 'ethers';
import { ArbitrageOpportunity, DEX, Token, Transaction } from '@/types';
import { 
  ExecutionOptions, 
  DEFAULT_EXECUTION_OPTIONS, 
  ExecutionResult, 
  ExecutionStatus,
  TradeExecutionRecord,
  ExecutionQueueItem,
  ExecutionStrategy
} from './types';
import { tradeExecutionStorage } from './storage';
import { blockchain } from '../blockchain/service';
import { arbitrageExecutorService } from '../contracts/arbitrageExecutor';
import { flashloanService } from '../flashloan';
import { toast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { trackTransaction } from '../transactions';
import { sleep } from '../common/utils';

/**
 * Trade Execution Service
 * Handles execution of arbitrage opportunities
 */
class TradeExecutor {
  // Queue for concurrent trade execution
  private executionQueue: ExecutionQueueItem[] = [];
  
  // Flag to track if queue processing is active
  private isProcessingQueue = false;
  
  // Maximum concurrent executions
  private maxConcurrentExecutions = 2;
  
  // Currently executing trades
  private activeExecutions = 0;
  
  // Configuration
  private config = {
    // Whether to automatically execute trades
    autoExecute: false,
    
    // Minimum profit (in USD) to consider for auto-execution
    minProfitForAutoExecute: 10,
    
    // Minimum confidence score (0-100) for auto-execution
    minConfidenceForAutoExecute: 75,
    
    // Maximum trade size (in USD) for auto-execution
    maxAutoExecuteTradeSize: 1000,
    
    // Maximum gas price (in gwei) to allow for execution
    maxGasPrice: 100,
    
    // Queue processing interval (ms)
    queueProcessingInterval: 5000,
    
    // Maximum queue size
    maxQueueSize: 20,
    
    // Maximum queue age (ms) - items older than this will be removed
    maxQueueAge: 5 * 60 * 1000, // 5 minutes
  };

  constructor() {
    // Start processing queue periodically
    setInterval(() => this.processQueue(), this.config.queueProcessingInterval);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): typeof this.config {
    return { ...this.config };
  }

  /**
   * Add an opportunity to the execution queue
   */
  queueExecution(
    opportunity: ArbitrageOpportunity,
    options: Partial<ExecutionOptions> = {}
  ): string | null {
    try {
      // Check if wallet is connected
      if (!blockchain.isWalletConnected()) {
        toast({
          title: "Wallet Not Connected",
          description: "Please connect your wallet to execute trades.",
          variant: "destructive"
        });
        return null;
      }
      
      // Check if queue is full
      if (this.executionQueue.length >= this.config.maxQueueSize) {
        toast({
          title: "Queue Full",
          description: "Trade execution queue is full. Please try again later.",
          variant: "destructive"
        });
        return null;
      }
      
      // Check if opportunity is already in queue
      const existing = this.executionQueue.find(item => 
        item.opportunity.id === opportunity.id
      );
      
      if (existing) {
        toast({
          title: "Already Queued",
          description: "This opportunity is already in the execution queue.",
          variant: "default"
        });
        return null;
      }
      
      // Merge options with defaults
      const mergedOptions: ExecutionOptions = {
        ...DEFAULT_EXECUTION_OPTIONS,
        ...options
      };
      
      // Calculate priority score
      const priorityScore = this.calculatePriorityScore(opportunity, mergedOptions);
      
      // Create queue item
      const queueItem: ExecutionQueueItem = {
        opportunity,
        options: mergedOptions,
        priority: priorityScore,
        addedAt: Date.now(),
        executionAttempts: 0,
        status: 'pending'
      };
      
      // Add to queue
      this.executionQueue.push(queueItem);
      
      // Sort queue by priority
      this.sortQueue();
      
      // Create record
      const record = tradeExecutionStorage.addRecord({
        opportunityId: opportunity.id,
        timestamp: Date.now(),
        strategy: mergedOptions.strategy,
        useFlashloan: mergedOptions.useFlashloan,
        flashloanProvider: mergedOptions.flashloanProvider,
        tokenIn: opportunity.tokenIn.address,
        tokenInSymbol: opportunity.tokenIn.symbol,
        tokenOut: opportunity.tokenOut.address,
        tokenOutSymbol: opportunity.tokenOut.symbol,
        tradeSize: opportunity.tradeSize || '0',
        expectedProfit: opportunity.estimatedProfit,
        gasEstimate: opportunity.gasEstimate,
        status: 'pending',
        sourceDex: opportunity.sourceDex.id,
        targetDex: opportunity.targetDex.id,
        path: opportunity.path
      });
      
      toast({
        title: "Trade Queued",
        description: `Added arbitrage opportunity to execution queue.`
      });
      
      // Trigger queue processing if not already running
      if (!this.isProcessingQueue && this.activeExecutions < this.maxConcurrentExecutions) {
        this.processQueue();
      }
      
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
   * Sort the execution queue by priority
   */
  private sortQueue(): void {
    this.executionQueue.sort((a, b) => {
      // Sort by priority (descending)
      return b.priority - a.priority;
    });
  }

  /**
   * Calculate priority score for an opportunity
   */
  private calculatePriorityScore(
    opportunity: ArbitrageOpportunity,
    options: ExecutionOptions
  ): number {
    // Start with base score
    let score = 50;
    
    // Adjust based on profit
    const profitValue = parseFloat(opportunity.estimatedProfit.split(' ')[0]);
    score += profitValue * 10; // More profit = higher priority
    
    // Adjust based on strategy
    switch (options.strategy) {
      case 'aggressive':
        score += 20;
        break;
      case 'conservative':
        score -= 20;
        break;
    }
    
    // Adjust based on execution priority
    switch (options.priority) {
      case 'high':
        score += 30;
        break;
      case 'low':
        score -= 30;
        break;
    }
    
    // Adjust based on confidence score if available
    if (opportunity.confidenceScore !== undefined) {
      score += (opportunity.confidenceScore / 5); // 0-20 points based on confidence
    }
    
    // Adjust based on risk level if available
    if (opportunity.riskLevel) {
      switch (opportunity.riskLevel) {
        case 'low':
          score += 15;
          break;
        case 'high':
          score -= 15;
          break;
      }
    }
    
    return score;
  }

  /**
   * Process the execution queue
   */
  async processQueue(): Promise<void> {
    // Skip if already processing or no active wallet
    if (this.isProcessingQueue || !blockchain.isWalletConnected()) {
      return;
    }
    
    // Skip if queue is empty
    if (this.executionQueue.length === 0) {
      return;
    }
    
    // Set processing flag
    this.isProcessingQueue = true;
    
    try {
      // Clean up old queue items
      this.cleanupQueue();
      
      // If we're at max concurrent executions, wait
      if (this.activeExecutions >= this.maxConcurrentExecutions) {
        this.isProcessingQueue = false;
        return;
      }
      
      // Get next item from queue
      const item = this.executionQueue[0];
      
      if (!item) {
        this.isProcessingQueue = false;
        return;
      }
      
      // Remove from queue
      this.executionQueue.shift();
      
      // Increment active executions
      this.activeExecutions++;
      
      // Execute the trade
      this.executeTradeAsync(item.opportunity, item.options)
        .finally(() => {
          // Decrement active executions
          this.activeExecutions--;
          
          // Continue processing queue
          if (this.executionQueue.length > 0) {
            this.processQueue();
          }
        });
    } catch (error) {
      console.error('Error processing execution queue:', error);
    } finally {
      // Reset processing flag
      this.isProcessingQueue = false;
    }
  }

  /**
   * Clean up old items from the queue
   */
  private cleanupQueue(): void {
    const now = Date.now();
    
    // Remove old items
    this.executionQueue = this.executionQueue.filter(item => {
      return (now - item.addedAt) < this.config.maxQueueAge;
    });
  }

  /**
   * Execute a trade asynchronously
   */
  private async executeTradeAsync(
    opportunity: ArbitrageOpportunity,
    options: ExecutionOptions
  ): Promise<void> {
    try {
      await this.executeTrade(opportunity, options);
    } catch (error) {
      console.error('Error in async trade execution:', error);
    }
  }

  /**
   * Execute a trade directly (not via queue)
   */
  async executeTrade(
    opportunity: ArbitrageOpportunity,
    options: Partial<ExecutionOptions> = {}
  ): Promise<ExecutionResult> {
    // Merge options with defaults
    const mergedOptions: ExecutionOptions = {
      ...DEFAULT_EXECUTION_OPTIONS,
      ...options
    };
    
    // Create record
    const record = tradeExecutionStorage.addRecord({
      opportunityId: opportunity.id,
      timestamp: Date.now(),
      strategy: mergedOptions.strategy,
      useFlashloan: mergedOptions.useFlashloan,
      flashloanProvider: mergedOptions.flashloanProvider,
      tokenIn: opportunity.tokenIn.address,
      tokenInSymbol: opportunity.tokenIn.symbol,
      tokenOut: opportunity.tokenOut.address,
      tokenOutSymbol: opportunity.tokenOut.symbol,
      tradeSize: opportunity.tradeSize || '0',
      expectedProfit: opportunity.estimatedProfit,
      gasEstimate: opportunity.gasEstimate,
      status: 'preparing',
      sourceDex: opportunity.sourceDex.id,
      targetDex: opportunity.targetDex.id,
      path: opportunity.path
    });
    
    try {
      // Check if wallet is connected
      if (!blockchain.isWalletConnected()) {
        const result: ExecutionResult = {
          success: false,
          status: 'failed',
          error: 'Wallet not connected'
        };
        
        // Update record
        tradeExecutionStorage.updateRecord(record.id, {
          status: 'failed',
          error: result.error
        });
        
        return result;
      }
      
      // Update record status
      tradeExecutionStorage.updateRecord(record.id, {
        status: 'preparing'
      });
      
      // Verify user is authorized to use the executor contract
      const isAuthorized = await arbitrageExecutorService.isUserAuthorized();
      if (!isAuthorized) {
        const result: ExecutionResult = {
          success: false,
          status: 'failed',
          error: 'User not authorized to use arbitrage executor'
        };
        
        // Update record
        tradeExecutionStorage.updateRecord(record.id, {
          status: 'failed',
          error: result.error
        });
        
        toast({
          title: "Authorization Error",
          description: "Your wallet is not authorized to use the arbitrage executor contract.",
          variant: "destructive"
        });
        
        return result;
      }
      
      // Validate token is supported for flashloan
      if (mergedOptions.useFlashloan) {
        const tokenSupported = await arbitrageExecutorService.isTokenSupported(
          opportunity.tokenIn.address
        );
        
        if (!tokenSupported) {
          const result: ExecutionResult = {
            success: false,
            status: 'failed',
            error: `Token ${opportunity.tokenIn.symbol} not supported for flashloan`
          };
          
          // Update record
          tradeExecutionStorage.updateRecord(record.id, {
            status: 'failed',
            error: result.error
          });
          
          toast({
            title: "Token Not Supported",
            description: `${opportunity.tokenIn.symbol} is not supported for flashloan execution.`,
            variant: "destructive"
          });
          
          return result;
        }
      }
      
      // Calculate flashloan profitability if using flashloan
      if (mergedOptions.useFlashloan) {
        // Extract profit value
        const expectedProfitStr = opportunity.estimatedProfit.split(' ')[0];
        
        try {
          const profitabilityCheck = await flashloanService.calculateArbitrageProfitability(
            opportunity.tokenIn,
            opportunity.tradeSize || '0',
            expectedProfitStr,
            mergedOptions.flashloanProvider
          );
          
          if (!profitabilityCheck.isProfitable) {
            const result: ExecutionResult = {
              success: false,
              status: 'failed',
              error: 'Not profitable after flashloan fees'
            };
            
            // Update record
            tradeExecutionStorage.updateRecord(record.id, {
              status: 'failed',
              error: result.error
            });
            
            toast({
              title: "Not Profitable",
              description: "Trade would not be profitable after flashloan fees.",
              variant: "destructive"
            });
            
            return result;
          }
        } catch (error) {
          console.warn('Error checking flashloan profitability:', error);
          // Continue anyway since error might be temporary
        }
      }
      
      // Update record status
      tradeExecutionStorage.updateRecord(record.id, {
        status: 'estimating'
      });
      
      // Get current gas price
      const provider = blockchain.getCurrentProvider();
      const gasPrice = await provider.getGasPrice();
      const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
      
      // Check if gas price is too high
      if (
        mergedOptions.maxGasPrice && 
        gasPriceGwei > parseFloat(mergedOptions.maxGasPrice)
      ) {
        const result: ExecutionResult = {
          success: false,
          status: 'failed',
          error: `Gas price too high (${gasPriceGwei.toFixed(2)} gwei)`
        };
        
        // Update record
        tradeExecutionStorage.updateRecord(record.id, {
          status: 'failed',
          error: result.error
        });
        
        toast({
          title: "Gas Price Too High",
          description: `Current gas price (${gasPriceGwei.toFixed(2)} gwei) exceeds maximum.`,
          variant: "destructive"
        });
        
        return result;
      }
      
      // Adjust gas price strategy based on execution options
      let gasPriceStrategy = this.getGasPriceStrategy(mergedOptions.strategy);
      
      // Update record status
      tradeExecutionStorage.updateRecord(record.id, {
        status: 'ready'
      });
      
      // Execute the trade
      tradeExecutionStorage.updateRecord(record.id, {
        status: 'executing'
      });
      
      const startTime = Date.now();
      
      // Execute the arbitrage via the executor contract
      const executionResult = await arbitrageExecutorService.executeArbitrage(
        opportunity.sourceDex,
        opportunity.targetDex,
        opportunity.tokenIn,
        opportunity.tokenOut,
        opportunity.tradeSize || '0',
        opportunity.estimatedProfit.split(' ')[0],
        mergedOptions.useFlashloan && mergedOptions.flashloanProvider === 'aave'
      );
      
      const executionTime = Date.now() - startTime;
      
      if (executionResult.success) {
        const result: ExecutionResult = {
          success: true,
          status: 'completed',
          transactionHash: executionResult.transactionHash,
          executionTime
        };
        
        // Track transaction for monitoring
        if (executionResult.transactionHash) {
          trackTransaction(
            executionResult.transactionHash,
            'arbitrage',
            {
              opportunityId: opportunity.id,
              sourceDex: opportunity.sourceDex.name,
              targetDex: opportunity.targetDex.name,
              tokenIn: opportunity.tokenIn.symbol,
              tokenOut: opportunity.tokenOut.symbol,
              expectedProfit: opportunity.estimatedProfit
            }
          ).catch(console.error);
        }
        
        // Update record
        tradeExecutionStorage.updateRecord(record.id, {
          status: 'completed',
          transactionHash: executionResult.transactionHash,
          executionTime
        });
        
        toast({
          title: "Trade Executed",
          description: "Arbitrage trade executed successfully.",
        });
        
        return result;
      } else {
        const result: ExecutionResult = {
          success: false,
          status: 'failed',
          error: executionResult.error || 'Unknown error',
          transactionHash: executionResult.transactionHash,
          executionTime
        };
        
        // Update record
        tradeExecutionStorage.updateRecord(record.id, {
          status: 'failed',
          error: result.error,
          transactionHash: executionResult.transactionHash,
          executionTime
        });
        
        toast({
          title: "Trade Failed",
          description: executionResult.error || "Unknown error executing trade.",
          variant: "destructive"
        });
        
        return result;
      }
    } catch (error: any) {
      console.error('Error executing trade:', error);
      
      const result: ExecutionResult = {
        success: false,
        status: 'failed',
        error: error.message || 'Unknown error'
      };
      
      // Update record
      tradeExecutionStorage.updateRecord(record.id, {
        status: 'failed',
        error: result.error
      });
      
      toast({
        title: "Execution Error",
        description: error.message || "Unknown error executing trade.",
        variant: "destructive"
      });
      
      return result;
    }
  }

  /**
   * Get appropriate gas price strategy based on execution strategy
   */
  private getGasPriceStrategy(strategy: ExecutionStrategy): 'standard' | 'fast' | 'aggressive' {
    switch (strategy) {
      case 'aggressive':
        return 'aggressive';
      case 'conservative':
        return 'standard';
      default:
        return 'fast';
    }
  }

  /**
   * Get all queued trades
   */
  getQueuedTrades(): ExecutionQueueItem[] {
    return [...this.executionQueue];
  }

  /**
   * Remove a trade from the queue
   */
  cancelQueuedTrade(opportunityId: string): boolean {
    const initialLength = this.executionQueue.length;
    
    this.executionQueue = this.executionQueue.filter(
      item => item.opportunity.id !== opportunityId
    );
    
    const removed = initialLength > this.executionQueue.length;
    
    if (removed) {
      toast({
        title: "Trade Canceled",
        description: "Removed trade from execution queue."
      });
    }
    
    return removed;
  }

  /**
   * Auto-execute a trade if it meets criteria
   */
  async autoExecuteTrade(opportunity: ArbitrageOpportunity): Promise<boolean> {
    // Skip if auto-execute is disabled
    if (!this.config.autoExecute) {
      return false;
    }
    
    // Skip if wallet is not connected
    if (!blockchain.isWalletConnected()) {
      return false;
    }
    
    // Extract profit value in USD
    const profitUsd = parseFloat(opportunity.estimatedProfit.split(' ')[0]);
    
    // Check minimum profit threshold
    if (profitUsd < this.config.minProfitForAutoExecute) {
      return false;
    }
    
    // Check confidence score if available
    if (
      opportunity.confidenceScore !== undefined &&
      opportunity.confidenceScore < this.config.minConfidenceForAutoExecute
    ) {
      return false;
    }
    
    // Check trade size if available
    if (opportunity.tradeSize) {
      const tradeSizeValue = parseFloat(opportunity.tradeSize);
      const tradeSizeUsd = tradeSizeValue * (opportunity.tokenIn.price || 0);
      
      if (tradeSizeUsd > this.config.maxAutoExecuteTradeSize) {
        return false;
      }
    }
    
    // Queue the trade for execution
    const recordId = this.queueExecution(opportunity);
    
    return !!recordId;
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
export const tradeExecutor = new TradeExecutor();
