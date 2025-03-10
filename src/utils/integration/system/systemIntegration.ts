
import { BlockchainService, blockchainService } from '../../blockchain/blockchainService';
import { appState, AppState } from '../stateManagement';
import { ErrorHandler, ErrorSeverity } from '../errorHandling';
import { logger } from '../../monitoring/loggingService';
import { toast } from '@/hooks/use-toast';
import { workerManager } from '../../blockchain/priceMonitoring/worker/workerManager';
import { dexManager } from '../../dex/DEXManager';
import { SystemStatus } from './types';
import { HealthCheckManager } from './healthCheck';
import { ModuleInitializer } from './moduleInitializer';

export class SystemIntegration {
  private blockchainService: BlockchainService;
  private status: SystemStatus;
  private healthCheckManager: HealthCheckManager;
  private moduleInitializer: ModuleInitializer;
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
    
    this.healthCheckManager = new HealthCheckManager(blockchainService, this.status);
    this.moduleInitializer = new ModuleInitializer(blockchainService, this.status);
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
      
      const blockchainInitialized = await this.moduleInitializer.initializeBlockchain();
      
      await this.moduleInitializer.initializeWebWorkers();
      await this.moduleInitializer.initializeAI();
      await this.moduleInitializer.initializePriceMonitoring();
      
      if (blockchainInitialized) {
        appState.setState(AppState.READY);
        logger.info('system', 'System initialization completed successfully');
        
        this.healthCheckManager.startHealthChecks();
        
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
        
        this.healthCheckManager.startHealthChecks();
        
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
  
  async checkBlockchainConnectivity(): Promise<boolean> {
    return this.healthCheckManager.checkBlockchainConnectivity();
  }
  
  shutdown(): void {
    this.healthCheckManager.cleanup();
    workerManager.terminateWorker();
    
    logger.info('system', 'System shutdown completed');
  }
}

export const systemIntegration = new SystemIntegration(blockchainService);
