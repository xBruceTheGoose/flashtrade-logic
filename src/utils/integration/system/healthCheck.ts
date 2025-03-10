
import { logger } from '../../monitoring/loggingService';
import { appState, AppState } from '../stateManagement';
import { SystemStatus } from './types';
import { workerManager } from '../../blockchain/priceMonitoring/worker/workerManager';
import { dexManager } from '../../dex/DEXManager';
import { BlockchainService } from '../../blockchain/blockchainService';
import { toast } from '@/hooks/use-toast';

export class HealthCheckManager {
  private blockchainService: BlockchainService;
  private status: SystemStatus;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(blockchainService: BlockchainService, status: SystemStatus) {
    this.blockchainService = blockchainService;
    this.status = status;
  }

  startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);
    
    this.performHealthCheck();
  }
  
  async performHealthCheck(): Promise<void> {
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

  cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}
