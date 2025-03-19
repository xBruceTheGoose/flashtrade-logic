import { ethers } from 'ethers';
import { trackMetric } from '../../config/monitoring';
import { MemoryManager } from '../../services/MemoryManager';

interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: {
    before: number;
    after: number;
    peak: number;
  };
  gasUsed?: ethers.BigNumber;
  transactionCount: number;
  successRate: number;
  averageLatency: number;
}

interface TestCase {
  name: string;
  setup?: () => Promise<void>;
  execute: () => Promise<void>;
  teardown?: () => Promise<void>;
  iterations?: number;
  concurrentUsers?: number;
}

export class PerformanceTest {
  private memoryManager = MemoryManager.getInstance();
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private startTime: number = 0;
  private peakMemory: number = 0;

  constructor(
    private readonly provider: ethers.providers.Provider,
    private readonly defaultIterations: number = 10,
    private readonly defaultConcurrentUsers: number = 1
  ) {}

  async runTest(testCase: TestCase): Promise<PerformanceMetrics> {
    const iterations = testCase.iterations || this.defaultIterations;
    const concurrentUsers = testCase.concurrentUsers || this.defaultConcurrentUsers;
    
    console.log(`Running performance test: ${testCase.name}`);
    console.log(`Iterations: ${iterations}, Concurrent Users: ${concurrentUsers}`);

    const results: PerformanceMetrics[] = [];
    
    // Setup
    if (testCase.setup) {
      await testCase.setup();
    }

    for (let i = 0; i < iterations; i++) {
      const metrics = await this.runIteration(testCase, concurrentUsers);
      results.push(metrics);
      
      // Store metrics for analysis
      if (!this.metrics.has(testCase.name)) {
        this.metrics.set(testCase.name, []);
      }
      this.metrics.get(testCase.name)!.push(metrics);

      // Report metrics
      this.reportMetrics(testCase.name, metrics);
    }

    // Teardown
    if (testCase.teardown) {
      await testCase.teardown();
    }

    // Calculate and return aggregate metrics
    return this.calculateAggregateMetrics(results);
  }

  private async runIteration(
    testCase: TestCase,
    concurrentUsers: number
  ): Promise<PerformanceMetrics> {
    const initialMemory = this.getCurrentMemoryUsage();
    this.startTime = Date.now();
    this.peakMemory = initialMemory;

    // Create concurrent user simulations
    const userPromises = Array(concurrentUsers).fill(0).map(async () => {
      const startTime = Date.now();
      try {
        await testCase.execute();
        return {
          success: true,
          latency: Date.now() - startTime
        };
      } catch (error) {
        console.error(`Error in test execution: ${error}`);
        return {
          success: false,
          latency: Date.now() - startTime
        };
      }
    });

    // Execute concurrent operations
    const results = await Promise.all(userPromises);
    const endTime = Date.now();
    const finalMemory = this.getCurrentMemoryUsage();

    // Calculate metrics
    const successCount = results.filter(r => r.success).length;
    const totalLatency = results.reduce((sum, r) => sum + r.latency, 0);

    return {
      executionTime: endTime - this.startTime,
      memoryUsage: {
        before: initialMemory,
        after: finalMemory,
        peak: this.peakMemory
      },
      transactionCount: concurrentUsers,
      successRate: (successCount / concurrentUsers) * 100,
      averageLatency: totalLatency / concurrentUsers
    };
  }

  private getCurrentMemoryUsage(): number {
    const stats = this.memoryManager.getMemoryUsage();
    const currentUsage = stats.heapUsed;
    this.peakMemory = Math.max(this.peakMemory, currentUsage);
    return currentUsage;
  }

  private calculateAggregateMetrics(results: PerformanceMetrics[]): PerformanceMetrics {
    const totalMetrics = results.reduce(
      (acc, curr) => ({
        executionTime: acc.executionTime + curr.executionTime,
        memoryUsage: {
          before: acc.memoryUsage.before + curr.memoryUsage.before,
          after: acc.memoryUsage.after + curr.memoryUsage.after,
          peak: Math.max(acc.memoryUsage.peak, curr.memoryUsage.peak)
        },
        transactionCount: acc.transactionCount + curr.transactionCount,
        successRate: acc.successRate + curr.successRate,
        averageLatency: acc.averageLatency + curr.averageLatency
      }),
      {
        executionTime: 0,
        memoryUsage: { before: 0, after: 0, peak: 0 },
        transactionCount: 0,
        successRate: 0,
        averageLatency: 0
      }
    );

    const count = results.length;
    return {
      executionTime: totalMetrics.executionTime / count,
      memoryUsage: {
        before: totalMetrics.memoryUsage.before / count,
        after: totalMetrics.memoryUsage.after / count,
        peak: totalMetrics.memoryUsage.peak
      },
      transactionCount: totalMetrics.transactionCount,
      successRate: totalMetrics.successRate / count,
      averageLatency: totalMetrics.averageLatency / count
    };
  }

  private reportMetrics(testName: string, metrics: PerformanceMetrics): void {
    const tags = { test: testName };
    
    trackMetric('perf_test_execution_time', metrics.executionTime, tags);
    trackMetric('perf_test_memory_before', metrics.memoryUsage.before, tags);
    trackMetric('perf_test_memory_after', metrics.memoryUsage.after, tags);
    trackMetric('perf_test_memory_peak', metrics.memoryUsage.peak, tags);
    trackMetric('perf_test_transaction_count', metrics.transactionCount, tags);
    trackMetric('perf_test_success_rate', metrics.successRate, tags);
    trackMetric('perf_test_avg_latency', metrics.averageLatency, tags);
  }

  getTestResults(testName: string): PerformanceMetrics[] | undefined {
    return this.metrics.get(testName);
  }

  getAllTestResults(): Map<string, PerformanceMetrics[]> {
    return this.metrics;
  }

  clearTestResults(): void {
    this.metrics.clear();
  }
}
