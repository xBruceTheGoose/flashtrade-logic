
import { BlockchainService, blockchainService } from '../blockchain/blockchainService';
import { appState, AppState } from './stateManagement';
import { ErrorHandler, ErrorSeverity } from './errorHandling';
import { logger } from '../monitoring/loggingService';

interface SystemStatus {
  moduleStatuses: {
    ai: boolean;
    blockchain: boolean;
    priceMonitoring: boolean;
    tradeExecution: boolean;
    smartContracts: boolean;
  };
  errors: {
    blockchain?: string;
    ai?: string;
    general?: string;
  };
}

export class SystemIntegration {
  private blockchainService: BlockchainService;
  private status: SystemStatus;
  
  constructor(blockchainService: BlockchainService) {
    this.blockchainService = blockchainService;
    this.status = {
      moduleStatuses: {
        ai: false,
        blockchain: false,
        priceMonitoring: false,
        tradeExecution: false,
        smartContracts: false,
      },
      errors: {}
    };
  }
  
  async initialize(): Promise<boolean> {
    try {
      appState.setState(AppState.INITIALIZING);
      logger.info('system', 'Starting system initialization');
      
      // Initialize components in order of dependency
      await this.initializeBlockchain();
      
      // Try to initialize other modules even if blockchain failed
      await this.initializeAI();
      await this.initializePriceMonitoring();
      
      // If all critical components are initialized, set to READY
      if (this.status.moduleStatuses.blockchain) {
        appState.setState(AppState.READY);
        logger.info('system', 'System initialization completed successfully');
        return true;
      } else {
        // System can partially function with failed blockchain
        appState.setState(AppState.PAUSED);
        logger.warn('system', 'System initialization completed with warnings', 
          { status: this.status });
        return false;
      }
    } catch (error) {
      ErrorHandler.handleError(
        error as Error,
        { module: 'system', operation: 'initialize' },
        ErrorSeverity.HIGH
      );
      
      this.status.errors.general = (error as Error).message;
      appState.setState(AppState.ERROR);
      logger.error('system', 'System initialization failed', { error });
      return false;
    }
  }
  
  private async initializeBlockchain(): Promise<boolean> {
    try {
      logger.info('system', 'Initializing blockchain connectivity');
      const blockchainConnected = await this.checkBlockchainConnectivity();
      
      this.status.moduleStatuses.blockchain = blockchainConnected;
      
      if (!blockchainConnected) {
        this.status.errors.blockchain = 'Failed to connect to blockchain network. Please check your wallet connection or network status.';
        logger.warn('system', 'Blockchain initialization failed', 
          { error: this.status.errors.blockchain });
        return false;
      }
      
      logger.info('system', 'Blockchain connectivity initialized successfully');
      return true;
    } catch (error) {
      this.status.errors.blockchain = (error as Error).message;
      logger.error('system', 'Blockchain initialization error', { error });
      return false;
    }
  }
  
  private async initializeAI(): Promise<boolean> {
    try {
      // Mock AI service initialization - in a real app this would connect to AI services
      logger.info('system', 'Initializing AI services');
      
      // For demo purposes, we'll set AI as available even if blockchain fails
      this.status.moduleStatuses.ai = true;
      
      return true;
    } catch (error) {
      this.status.errors.ai = (error as Error).message;
      logger.error('system', 'AI service initialization error', { error });
      return false;
    }
  }
  
  private async initializePriceMonitoring(): Promise<boolean> {
    try {
      // Only initialize price monitoring if blockchain is connected
      if (!this.status.moduleStatuses.blockchain) {
        logger.warn('system', 'Price monitoring initialization skipped due to blockchain connectivity issues');
        return false;
      }
      
      // For demo purposes we'll just mark it as initialized
      this.status.moduleStatuses.priceMonitoring = true;
      
      return true;
    } catch (error) {
      logger.error('system', 'Price monitoring initialization error', { error });
      return false;
    }
  }
  
  async checkBlockchainConnectivity(): Promise<boolean> {
    try {
      if (!this.blockchainService) {
        logger.error('system', 'Blockchain service not initialized');
        return false;
      }
      
      // Check if blockchain service is correctly connected
      const isConnected = await this.blockchainService.isProviderConnected();
      
      if (!isConnected) {
        logger.warn(
          'system',
          'Blockchain connectivity issues detected',
          { service: 'blockchain' }
        );
      }
      
      return isConnected;
    } catch (error) {
      logger.error(
        'system',
        'Failed to check blockchain connectivity',
        { error }
      );
      return false;
    }
  }

  getSystemStatus(): SystemStatus {
    return this.status;
  }

  canExecuteTrades(): boolean {
    return this.status.moduleStatuses.blockchain && 
           this.status.moduleStatuses.tradeExecution;
  }

  isAIAssistanceAvailable(): boolean {
    return this.status.moduleStatuses.ai;
  }
  
  getBlockchainErrorMessage(): string {
    return this.status.errors.blockchain || 'No blockchain errors detected';
  }
}

// Export singleton instance
export const systemIntegration = new SystemIntegration(blockchainService);
