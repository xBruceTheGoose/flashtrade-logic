
import { v4 as uuidv4 } from 'uuid';

// Define interface for worker requests
interface WorkerRequest {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timeout: number | null;
}

// Worker manager to handle web worker communication
class WorkerManager {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, WorkerRequest> = new Map();
  private isWorkerSupported: boolean = typeof Worker !== 'undefined';
  private isInitialized: boolean = false;
  
  constructor() {
    if (this.isWorkerSupported) {
      this.initialize();
    } else {
      console.warn('Web Workers are not supported in this environment');
    }
  }
  
  private initialize(): void {
    if (this.isInitialized) return;
    
    try {
      // Create the worker
      this.worker = new Worker(
        new URL('./priceCalculationWorker.ts', import.meta.url), 
        { type: 'module' }
      );
      
      // Set up message handler
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      
      // Set up error handler
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize web worker:', error);
      this.isWorkerSupported = false;
    }
  }
  
  private handleWorkerMessage(event: MessageEvent): void {
    const { id, result, error } = event.data;
    
    const request = this.pendingRequests.get(id);
    if (!request) return;
    
    // Clear timeout if it exists
    if (request.timeout !== null) {
      clearTimeout(request.timeout);
    }
    
    // Remove from pending requests
    this.pendingRequests.delete(id);
    
    if (error) {
      request.reject(new Error(error));
    } else {
      request.resolve(result);
    }
  }
  
  private handleWorkerError(error: ErrorEvent): void {
    console.error('Web worker error:', error);
    
    // Reject all pending requests
    for (const [id, request] of this.pendingRequests.entries()) {
      request.reject(new Error('Worker error: ' + error.message));
      this.pendingRequests.delete(id);
    }
    
    // Reinitialize worker
    this.terminateWorker();
    this.initialize();
  }
  
  async calculateArbitrage(data: {
    prices: Record<string, Record<string, number>>;
    tokens: any[];
    minProfitPercentage: number;
    gasPrice: number;
  }): Promise<any[]> {
    return this.sendToWorker('calculate_arbitrage', data);
  }
  
  async calculateVolatility(data: {
    priceHistory: number[];
    timeIntervals: number[];
  }): Promise<number> {
    return this.sendToWorker('calculate_volatility', data);
  }
  
  async processPriceData(data: {
    priceHistory: any[];
    interval: 'minute' | 'hour' | 'day';
  }): Promise<any[]> {
    return this.sendToWorker('process_price_data', data);
  }
  
  private async sendToWorker<T>(type: string, data: any, timeoutMs: number = 30000): Promise<T> {
    if (!this.isWorkerSupported || !this.worker) {
      // Fallback to main thread processing if workers aren't supported
      return this.processOnMainThread(type, data);
    }
    
    return new Promise<T>((resolve, reject) => {
      const id = uuidv4();
      
      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Worker request timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      
      // Store the request
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout
      });
      
      // Send the message to the worker
      this.worker.postMessage({
        id,
        type,
        data
      });
    });
  }
  
  private async processOnMainThread(type: string, data: any): Promise<any> {
    console.warn(`Processing ${type} on main thread due to lack of worker support`);
    
    // Dynamic import the worker code directly
    const workerFunctions = await import('./priceCalculationWorker');
    
    switch (type) {
      case 'calculate_arbitrage':
        return workerFunctions.calculateArbitrageOpportunities(data);
      case 'calculate_volatility':
        return workerFunctions.calculateVolatility(data);
      case 'process_price_data':
        return workerFunctions.processPriceData(data);
      default:
        throw new Error(`Unknown worker operation: ${type}`);
    }
  }
  
  terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
    
    // Reject all pending requests
    for (const [id, request] of this.pendingRequests.entries()) {
      if (request.timeout !== null) {
        clearTimeout(request.timeout);
      }
      request.reject(new Error('Worker terminated'));
      this.pendingRequests.delete(id);
    }
  }
  
  isReady(): boolean {
    return this.isWorkerSupported && this.isInitialized;
  }
}

// Export singleton instance
export const workerManager = new WorkerManager();
