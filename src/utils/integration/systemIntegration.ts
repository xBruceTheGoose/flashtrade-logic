
import { aiService } from '../ai/aiService';
import { tradeExecutor } from '../arbitrage/tradeExecutor';
import { priceMonitoringService } from '../blockchain/priceMonitoring/PriceMonitorService';
import { blockchain } from '../blockchain';
import { arbitrageExecutorService } from '../contracts/arbitrageExecutor';
import { logger } from '../monitoring/loggingService';
import { toast } from '@/hooks/use-toast';

/**
 * System Integration Service
 * 
 * Coordinates interactions between different modules of the application:
 * - AI Service: For strategy optimization and opportunity evaluation
 * - Trade Executor: For executing trades and managing configuration
 * - Price Monitoring: For detecting arbitrage opportunities
 * - Blockchain: For blockchain interaction and transaction management
 * - Smart Contracts: For on-chain execution of trades
 */
export class SystemIntegrationService {
  private isInitialized = false;
  private moduleStatuses: Record<string, boolean> = {
    ai: false,
    blockchain: false,
    priceMonitoring: false,
    tradeExecution: false,
    smartContracts: false
  };

  /**
   * Initialize the entire system
   */
  async initialize(): Promise<boolean> {
    try {
      logger.info('system', 'Initializing system integration service');
      
      // Initialize blockchain service first (others depend on it)
      await this.initializeBlockchainService();
      
      // Initialize other services in parallel
      await Promise.all([
        this.initializeAIService(),
        this.initializePriceMonitoring(),
        this.initializeTradeExecution(),
        this.initializeSmartContracts()
      ]);
      
      this.isInitialized = true;
      
      // Log system state after initialization
      logger.info('system', 'System initialization complete', this.getSystemStatus());
      
      return true;
    } catch (error) {
      logger.error('system', 'System initialization failed', { error });
      toast({
        title: "System Initialization Failed",
        description: "One or more components failed to initialize. Check logs for details.",
        variant: "destructive"
      });
      return false;
    }
  }

  /**
   * Initialize blockchain service
   */
  private async initializeBlockchainService(): Promise<void> {
    try {
      // Blockchain initialization happens automatically
      this.moduleStatuses.blockchain = true;
      logger.info('system', 'Blockchain service initialized');
    } catch (error) {
      logger.error('system', 'Blockchain service initialization failed', { error });
      throw error;
    }
  }

  /**
   * Initialize AI service
   */
  private async initializeAIService(): Promise<void> {
    try {
      // AI service initialization already happens in constructor
      this.moduleStatuses.ai = aiService.isInitializedAndReady();
      logger.info('system', 'AI service initialization status', { initialized: this.moduleStatuses.ai });
    } catch (error) {
      logger.warn('system', 'AI service initialization failed, continuing without AI', { error });
      // Don't throw - AI is optional for system operation
    }
  }

  /**
   * Initialize price monitoring service
   */
  private async initializePriceMonitoring(): Promise<void> {
    try {
      // No explicit initialization needed for price monitoring
      this.moduleStatuses.priceMonitoring = true;
      logger.info('system', 'Price monitoring service initialized');
    } catch (error) {
      logger.error('system', 'Price monitoring service initialization failed', { error });
      throw error;
    }
  }

  /**
   * Initialize trade execution service
   */
  private async initializeTradeExecution(): Promise<void> {
    try {
      // No explicit initialization needed for trade executor
      this.moduleStatuses.tradeExecution = true;
      logger.info('system', 'Trade execution service initialized');
    } catch (error) {
      logger.error('system', 'Trade execution service initialization failed', { error });
      throw error;
    }
  }

  /**
   * Initialize smart contract interfaces
   */
  private async initializeSmartContracts(): Promise<void> {
    try {
      // Smart contract initialization happens when methods are called
      // We'll just check if the blockchain is available
      this.moduleStatuses.smartContracts = blockchain.isConnectedToNetwork();
      logger.info('system', 'Smart contracts initialization status', { initialized: this.moduleStatuses.smartContracts });
    } catch (error) {
      logger.warn('system', 'Smart contracts initialization failed, continuing without on-chain execution', { error });
      // Don't throw - direct smart contract interaction is optional
    }
  }

  /**
   * Process an arbitrage opportunity with AI evaluation
   * This shows how different modules work together in the system
   */
  async processOpportunityWithAI(opportunityId: string): Promise<boolean> {
    if (!this.isInitialized) {
      logger.warn('system', 'Cannot process opportunity - system not initialized');
      return false;
    }
    
    try {
      logger.info('system', 'Processing opportunity with AI assistance', { opportunityId });
      
      // Get opportunity details from price monitoring service
      const opportunity = priceMonitoringService.getOpportunity(opportunityId);
      if (!opportunity) {
        logger.warn('system', 'Opportunity not found', { opportunityId });
        return false;
      }
      
      // Use AI to evaluate the opportunity (if available)
      if (this.moduleStatuses.ai && aiService.isInitializedAndReady()) {
        const evaluation = await aiService.evaluateArbitrageOpportunity(opportunity);
        
        logger.info('system', 'AI evaluation complete', { 
          opportunityId, 
          recommendation: evaluation.recommendation,
          confidence: evaluation.confidence 
        });
        
        // Skip if AI doesn't recommend execution
        if (evaluation.recommendation !== 'execute') {
          logger.info('system', 'AI recommended skipping opportunity', { 
            opportunityId,
            reason: evaluation.reasoning 
          });
          return false;
        }
      } else {
        logger.info('system', 'Skipping AI evaluation - AI service not available');
      }
      
      // Execute trade (with auto-execution in trade executor)
      const result = await tradeExecutor.autoExecuteTrade(opportunity);
      
      if (result) {
        logger.info('system', 'Opportunity successfully executed', { opportunityId });
      } else {
        logger.warn('system', 'Opportunity execution failed or skipped', { opportunityId });
      }
      
      return result;
    } catch (error) {
      logger.error('system', 'Error processing opportunity with AI', { opportunityId, error });
      return false;
    }
  }

  /**
   * Get system status
   */
  getSystemStatus(): {
    isInitialized: boolean;
    moduleStatuses: Record<string, boolean>;
  } {
    return {
      isInitialized: this.isInitialized,
      moduleStatuses: { ...this.moduleStatuses }
    };
  }

  /**
   * Check if system can execute trades
   */
  canExecuteTrades(): boolean {
    return this.isInitialized &&
      this.moduleStatuses.blockchain &&
      this.moduleStatuses.priceMonitoring &&
      this.moduleStatuses.tradeExecution;
  }

  /**
   * Check if AI assistance is available
   */
  isAIAssistanceAvailable(): boolean {
    return this.moduleStatuses.ai && aiService.isInitializedAndReady();
  }
}

// Export singleton instance
export const systemIntegration = new SystemIntegrationService();
