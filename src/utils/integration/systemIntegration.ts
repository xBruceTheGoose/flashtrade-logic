import { BlockchainService, blockchainService } from '../blockchain/blockchainService';
import { appState, AppState } from './stateManagement';
import { ErrorHandler, ErrorSeverity } from './errorHandling';
import { logger } from '../monitoring/loggingService';

export class SystemIntegration {
  private blockchainService: BlockchainService;
  
  constructor(blockchainService: BlockchainService) {
    this.blockchainService = blockchainService;
  }
  
  async initialize(): Promise<void> {
    try {
      appState.setState(AppState.INITIALIZING);
      
      // Check system dependencies
      const blockchainConnected = await this.checkBlockchainConnectivity();
      
      if (!blockchainConnected) {
        throw new Error('Blockchain connectivity failed');
      }
      
      // Transition to ready state
      appState.setState(AppState.READY);
      logger.info('system', 'System initialization completed');
    } catch (error) {
      ErrorHandler.handleError(
        error as Error,
        { module: 'system', operation: 'initialize' },
        ErrorSeverity.CRITICAL
      );
      appState.setState(AppState.ERROR);
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
}

// Export singleton instance
export const systemIntegration = new SystemIntegration(blockchainService);
