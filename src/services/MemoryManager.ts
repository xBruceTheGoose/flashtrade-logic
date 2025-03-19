import { trackMetric } from '../config/monitoring';

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

export class MemoryManager {
  private static instance: MemoryManager;
  private memoryThreshold = 0.85; // 85% memory usage threshold
  private cleanupCallbacks: Map<string, () => void> = new Map();
  private gcIntervalId: NodeJS.Timeout | null = null;
  private lastCleanupTime = 0;
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute

  private constructor() {
    this.startMonitoring();
  }

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  private startMonitoring(): void {
    this.gcIntervalId = setInterval(() => {
      this.checkMemoryUsage();
    }, this.CLEANUP_INTERVAL);
  }

  registerCleanupCallback(id: string, callback: () => void): void {
    this.cleanupCallbacks.set(id, callback);
  }

  unregisterCleanupCallback(id: string): void {
    this.cleanupCallbacks.delete(id);
  }

  private async checkMemoryUsage(): Promise<void> {
    const stats = this.getMemoryStats();
    const memoryUsage = stats.heapUsed / stats.heapTotal;

    trackMetric('memory_usage_percentage', memoryUsage * 100);
    trackMetric('heap_used_mb', Math.round(stats.heapUsed / 1024 / 1024));
    trackMetric('heap_total_mb', Math.round(stats.heapTotal / 1024 / 1024));

    if (memoryUsage > this.memoryThreshold) {
      await this.performCleanup();
    }
  }

  private getMemoryStats(): MemoryStats {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const { heapUsed, heapTotal, external, arrayBuffers } = process.memoryUsage();
      return { heapUsed, heapTotal, external, arrayBuffers };
    }
    
    // Browser environment
    if (typeof performance !== 'undefined' && performance.memory) {
      const { usedJSHeapSize, totalJSHeapSize } = performance.memory;
      return {
        heapUsed: usedJSHeapSize,
        heapTotal: totalJSHeapSize,
        external: 0,
        arrayBuffers: 0
      };
    }

    return {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      arrayBuffers: 0
    };
  }

  private async performCleanup(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCleanupTime < this.CLEANUP_INTERVAL) {
      return;
    }

    this.lastCleanupTime = now;
    trackMetric('memory_cleanup_triggered', 1);

    // Execute all cleanup callbacks
    const cleanupPromises = Array.from(this.cleanupCallbacks.values()).map(callback => {
      try {
        const result = callback();
        return result instanceof Promise ? result : Promise.resolve(result);
      } catch (error) {
        console.error('Error in cleanup callback:', error);
        return Promise.resolve();
      }
    });

    await Promise.all(cleanupPromises);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Check memory usage after cleanup
    const statsAfter = this.getMemoryStats();
    trackMetric('memory_after_cleanup_mb', Math.round(statsAfter.heapUsed / 1024 / 1024));
  }

  setMemoryThreshold(threshold: number): void {
    if (threshold > 0 && threshold < 1) {
      this.memoryThreshold = threshold;
    }
  }

  async forceCleanup(): Promise<void> {
    await this.performCleanup();
  }

  getMemoryUsage(): MemoryStats {
    return this.getMemoryStats();
  }

  dispose(): void {
    if (this.gcIntervalId) {
      clearInterval(this.gcIntervalId);
      this.gcIntervalId = null;
    }
    this.cleanupCallbacks.clear();
  }
}
