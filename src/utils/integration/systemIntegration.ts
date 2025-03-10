import { BlockchainService, blockchainService } from '../blockchain/blockchainService';
import { appState, AppState } from './stateManagement';
import { ErrorHandler, ErrorSeverity } from './errorHandling';
import { logger } from '../monitoring/loggingService';
import { toast } from '@/hooks/use-toast';
import { workerManager } from '../blockchain/priceMonitoring/worker/workerManager';
import { dexManager } from '../dex/DEXManager';

interface SystemStatus {
  moduleStatuses: {
    ai: boolean;
    blockchain: boolean;
    priceMonitoring: boolean;
    tradeExecution: boolean;
    smartContracts: boolean;
    webWorkers: boolean;
  };
  errors: {
    blockchain?: string;
    ai?: string;
    general?: string;
    priceMonitoring?: string;
    webWorkers?: string;
  };
  performance: {
    memoryUsage?: number;
    cpuUsage?: number;
  };
}

export class SystemIntegration {
  private blockchainService: BlockchainService;
  private status: SystemStatus;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private initializationInProgress: boolean = false;
  private retryAttempts: number = 0;
  private maxRetryAttempts: number = 3;
  
  constructor(blockchainService: BlockchainService) {
    this.blockchainService = blockchainService;
    this.status = {
      moduleStatuses: {
        ai: false,
        blockchain: false,
        priceMonitoring: false,
        tradeExecution: false,
        smartContracts: false,
        webWorkers: false,
      },
      errors: {},
      performance: {}
    };
  }
  
  async initialize(): Promise<boolean> {
    if (this.initializationInProgress) {
      logger.warn('system', 'System initialization already in progress');
      return false;
    }
    
    this.initializationInProgress = true;
    
    try {
      appState.setState(AppState.INITIALIZING);
      logger.info('system', 'Starting system initialization');
      
      const blockchainInitialized = await this.initializeBlockchain();
      
      await this.initializeWebWorkers();
      await this.initializeAI();
      await this.initializePriceMonitoring();
      
      if (blockchainInitialized) {
        appState.setState(AppState.READY);
        logger.info('system', 'System initialization completed successfully');
        
        this.startHealthChecks();
        
        toast({
          title: "System Ready",
          description: "All system components initialized successfully"
        });
        
        this.initializationInProgress = false;
        this.retryAttempts = 0;
        return true;
      } else {
        appState.setState(AppState.PAUSED);
        logger.warn('system', 'System initialization completed with warnings', 
          { status: this.status });
        
        toast({
          title: "System Partially Ready",
          description: "Some components failed to initialize. Limited functionality available.",
          variant: "destructive"
        });
        
        this.startHealthChecks();
        
        this.initializationInProgress = false;
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
      
      toast({
        title: "System Error",
        description: "Failed to initialize system. Please refresh the page to try again.",
        variant: "destructive"
      });
      
      this.initializationInProgress = false;
      
      if (this.retryAttempts < this.maxRetryAttempts) {
        this.retryAttempts++;
        const retryDelay = Math.min(2000 * Math.pow(2, this.retryAttempts - 1), 30000);
        
        logger.info('system', `Scheduling initialization retry ${this.retryAttempts} in ${retryDelay}ms`);
        
        setTimeout(() => {
          this.initialize();
        }, retryDelay);
      }
      
      return false;
    }
  }
  
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);
    
    this.performHealthCheck();
  }
  
  private async performHealthCheck(): Promise<void> {
    try {
      const blockchainConnected = await this.checkBlockchainConnectivity();
      this.status.moduleStatuses.blockchain = blockchainConnected;
      
      const workersAvailable = workerManager.isReady();
      this.status.moduleStatuses.webWorkers = workersAvailable;
      
      const dexReady = dexManager.isReady();
      
      if (appState.getState() === AppState.ERROR && blockchainConnected) {
        appState.setState(AppState.READY);
        logger.info('system', 'System recovered from error state');
        
        toast({
          title: "System Recovered",
          description: "System has recovered and is now operational"
        });
      } else if (appState.getState() === AppState.READY && !blockchainConnected) {
        appState.setState(AppState.PAUSED);
        logger.warn('system', 'System paused due to blockchain connectivity issues');
        
        toast({
          title: "System Paused",
          description: "Blockchain connectivity issues detected. Limited functionality available.",
          variant: "destructive"
        });
      }
      
      this.updatePerformanceMetrics();
      
    } catch (error) {
      logger.error('system', 'Health check failed', { error });
    }
  }
  
  private updatePerformanceMetrics(): void {
    if (window.performance && (performance as any).memory) {
      const memoryInfo = (performance as any).memory;
      const usedHeapSize = memoryInfo.usedJSHeapSize;
      const totalHeapSize = memoryInfo.totalJSHeapSize;
      
      if (totalHeapSize > 0) {
        const memoryUsagePercent = (usedHeapSize / totalHeapSize) * 100;
        this.status.performance.memoryUsage = memoryUsagePercent;
        
        if (memoryUsagePercent > 80) {
          logger.warn('system', 'High memory usage detected', { 
            usedHeapSize, 
            totalHeapSize, 
            memoryUsagePercent 
          });
        }
      }
    }
  }
  
  private async initializeWebWorkers(): Promise<boolean> {
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
      logger.info('system', 'Initializing AI services');
      
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

  getSystemStatus(): SystemStatus {
    return {...this.status};
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
  
  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    workerManager.terminateWorker();
    
    logger.info('system', 'System shutdown completed');
  }
}

export const systemIntegration = new SystemIntegration(blockchainService);
