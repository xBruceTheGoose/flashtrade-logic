
import { logger } from '../../monitoring/loggingService';
import { SystemStatus } from './types';
import { BlockchainService } from '../../blockchain/blockchainService';
import { workerManager } from '../../blockchain/priceMonitoring/worker/workerManager';

export class ModuleInitializer {
  private blockchainService: BlockchainService;
  private status: SystemStatus;
  
  constructor(blockchainService: BlockchainService, status: SystemStatus) {
    this.blockchainService = blockchainService;
    this.status = status;
  }
  
  async initializeWebWorkers(): Promise<boolean> {
    try {
      logger.info('system', 'Initializing web workers');
      
      const workersSupported = workerManager.isReady();
      this.status.moduleStatuses.webWorkers = workersSupported;
      
      if (!workersSupported) {
        this.status.errors.webWorkers = 'Web Workers are not supported in this environment. Calculations will be slower.';
        logger.warn('system', 'Web Workers initialization failed', 
          { error: this.status.errors.webWorkers });
        return false;
      }
      
      logger.info('system', 'Web Workers initialized successfully');
      return true;
    } catch (error) {
      this.status.errors.webWorkers = (error as Error).message;
      logger.error('system', 'Web Workers initialization error', { error });
      return false;
    }
  }
  
  async initializeBlockchain(): Promise<boolean> {
    try {
      logger.info('system', 'Initializing blockchain connectivity');
      
      // We'll use the health check manager's method for this
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
  
  async initializeAI(): Promise<boolean> {
    try {
      logger.info('system', 'Initializing AI services');
      
      this.status.moduleStatuses.ai = true;
      
      return true;
    } catch (error) {
      this.status.errors.ai = (error as Error).message;
      logger.error('system', 'AI service initialization error', { error });
      return false;
    }
  }
  
  async initializePriceMonitoring(): Promise<boolean> {
    try {
      logger.info('system', 'Initializing price monitoring service');
      
      if (!this.status.moduleStatuses.blockchain) {
        logger.warn('system', 'Price monitoring initialization skipped due to blockchain connectivity issues');
        this.status.errors.priceMonitoring = 'Blockchain connectivity required for price monitoring';
        return false;
      }
      
      this.status.moduleStatuses.priceMonitoring = true;
      
      return true;
    } catch (error) {
      this.status.errors.priceMonitoring = (error as Error).message;
      logger.error('system', 'Price monitoring initialization error', { error });
      return false;
    }
  }
  
  // Shared method for blockchain connectivity check
  async checkBlockchainConnectivity(): Promise<boolean> {
    try {
      if (!this.blockchainService) {
        logger.error('system', 'Blockchain service not initialized');
        return false;
      }
      
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
