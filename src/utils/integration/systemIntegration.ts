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
      }
    };
  }
  
  async initialize(): Promise<boolean> {
    try {
      appState.setState(AppState.INITIALIZING);
      
      // Check system dependencies
      const blockchainConnected = await this.checkBlockchainConnectivity();
      
      if (!blockchainConnected) {
        throw new Error('Blockchain connectivity failed');
      }
      
      // Update blockchain status
      this.status.moduleStatuses.blockchain = true;
      
      // Transition to ready state
      appState.setState(AppState.READY);
      logger.info('system', 'System initialization completed');
      return true;
    } catch (error) {
      ErrorHandler.handleError(
        error as Error,
        { module: 'system', operation: 'initialize' },
        ErrorSeverity.CRITICAL
      );
      appState.setState(AppState.ERROR);
      return false;
    }
  }
  
  async checkBlockchainConnectivity(): Promise<boolean> {
    try {
      // Check if blockchain service is correctly connected
      // Note: We're removing the incorrect property isConnectedToNetwork
      // and replacing it with a more generic connectivity check
      
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
}

// Export singleton instance
export const systemIntegration = new SystemIntegration(blockchainService);
