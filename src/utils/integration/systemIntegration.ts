
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
      
      // Initialize components in order of dependency
      const blockchainInitialized = await this.initializeBlockchain();
      
      // Try to initialize other modules even if blockchain failed
      await this.initializeWebWorkers();
      await this.initializeAI();
      await this.initializePriceMonitoring();
      
      // If all critical components are initialized, set to READY
      if (blockchainInitialized) {
        appState.setState(AppState.READY);
        logger.info('system', 'System initialization completed successfully');
        
        // Set up periodic health checks
        this.startHealthChecks();
        
        toast({
          title: "System Ready",
          description: "All system components initialized successfully"
        });
        
        this.initializationInProgress = false;
        this.retryAttempts = 0;
        return true;
      } else {
        // System can partially function with failed blockchain
        appState.setState(AppState.PAUSED);
        logger.warn('system', 'System initialization completed with warnings', 
          { status: this.status });
        
        toast({
          title: "System Partially Ready",
          description: "Some components failed to initialize. Limited functionality available.",
          variant: "warning"
        });
        
        // Set up health checks anyway to detect when components become available
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
      
      // Schedule retry if under the limit
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
    
    // Run health checks every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);
    
    // Run initial health check immediately
    this.performHealthCheck();
  }
  
  private async performHealthCheck(): Promise<void> {
    try {
      // Check blockchain connectivity
      const blockchainConnected = await this.checkBlockchainConnectivity();
      this.status.moduleStatuses.blockchain = blockchainConnected;
      
      // Check web workers
      const workersAvailable = workerManager.isReady();
      this.status.moduleStatuses.webWorkers = workersAvailable;
      
      // Check DEX connectivity
      const dexReady = dexManager.isReady();
      
      // Update system state based on checks
      if (appState.getState() === AppState.ERROR && blockchainConnected) {
        // Recover from error state if blockchain is now connected
        appState.setState(AppState.READY);
        logger.info('system', 'System recovered from error state');
        
        toast({
          title: "System Recovered",
          description: "System has recovered and is now operational"
        });
      } else if (appState.getState() === AppState.READY && !blockchainConnected) {
        // Move to paused state if blockchain disconnected
        appState.setState(AppState.PAUSED);
        logger.warn('system', 'System paused due to blockchain connectivity issues');
        
        toast({
          title: "System Paused",
          description: "Blockchain connectivity issues detected. Limited functionality available.",
          variant: "warning"
        });
      }
      
      // Check performance metrics
      this.updatePerformanceMetrics();
      
    } catch (error) {
      logger.error('system', 'Health check failed', { error });
    }
  }
  
  private updatePerformanceMetrics(): void {
    // Get memory usage (if available)
    if (window.performance && (performance as any).memory) {
      const memoryInfo = (performance as any).memory;
      const usedHeapSize = memoryInfo.usedJSHeapSize;
      const totalHeapSize = memoryInfo.totalJSHeapSize;
      
      if (totalHeapSize > 0) {
        const memoryUsagePercent = (usedHeapSize / totalHeapSize) * 100;
        this.status.performance.memoryUsage = memoryUsagePercent;
        
        // Log warning if memory usage is high
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
      logger.info('system', 'Initializing price monitoring service');
      
      // Check if prerequisites are available
      if (!this.status.moduleStatuses.blockchain) {
        logger.warn('system', 'Price monitoring initialization skipped due to blockchain connectivity issues');
        this.status.errors.priceMonitoring = 'Blockchain connectivity required for price monitoring';
        return false;
      }
      
      // For demo purposes we'll just mark it as initialized
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
    // Clean up resources
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Terminate web workers
    workerManager.terminateWorker();
    
    logger.info('system', 'System shutdown completed');
  }
}

// Export singleton instance
export const systemIntegration = new SystemIntegration(blockchainService);
