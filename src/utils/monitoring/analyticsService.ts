import { v4 as uuidv4 } from 'uuid';
import { toast } from '@/hooks/use-toast';
import { blockchain } from '@/utils/blockchain';
import { tradeExecutionStorage } from '@/utils/arbitrage/storage';

// Types for the monitoring system
export interface PerformanceMetric {
  id: string;
  timestamp: number;
  category: 'application' | 'blockchain' | 'trade' | 'gas' | 'system';
  name: string;
  value: number;
  unit?: string;
  metadata?: Record<string, any>;
}

export interface SystemAlert {
  id: string;
  timestamp: number;
  level: 'info' | 'warning' | 'error' | 'critical';
  category: 'application' | 'blockchain' | 'trade' | 'system' | 'gas';
  message: string;
  source: string;
  metadata?: Record<string, any>;
  acknowledged: boolean;
}

export interface PerformanceReport {
  id: string;
  timestamp: number;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: number;
  endDate: number;
  metrics: {
    successfulTrades: number;
    failedTrades: number;
    successRate: number;
    averageExecutionTime: number;
    totalProfit: string;
    averageGasCost: string;
    mostProfitablePair: string;
    mostProfitableDex: string;
  };
  summary: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  lastChecked: number;
  components: {
    blockchain: 'connected' | 'disconnected' | 'error';
    arbitrage: 'active' | 'inactive' | 'error';
    monitoring: 'active' | 'inactive';
    storage: 'available' | 'unavailable';
  };
}

// Configuration for alerts
export interface AlertThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
}

/**
 * Analytics and Monitoring Service
 * Tracks application metrics, blockchain interactions, trade executions,
 * and system health
 */
class AnalyticsService {
  private metrics: PerformanceMetric[] = [];
  private alerts: SystemAlert[] = [];
  private reports: PerformanceReport[] = [];
  private sessionStart: number = Date.now();
  private alertThresholds: AlertThreshold[] = [];
  private systemHealth: SystemHealth;
  private metricsRetentionDays: number = 30;
  private isMonitoring: boolean = false;
  private monitoringInterval: number | null = null;
  private readonly DEFAULT_MONITORING_INTERVAL = 60000; // 1 minute
  
  constructor() {
    console.log('Analytics Service initialized');
    
    // Initialize system health
    this.systemHealth = {
      status: 'healthy',
      lastChecked: Date.now(),
      components: {
        blockchain: 'disconnected',
        arbitrage: 'inactive',
        monitoring: 'inactive',
        storage: 'available'
      }
    };
    
    // Set up default alert thresholds
    this.setupDefaultAlertThresholds();
  }
  
  /**
   * Start monitoring system
   */
  startMonitoring(intervalMs: number = this.DEFAULT_MONITORING_INTERVAL): boolean {
    if (this.isMonitoring) {
      console.warn('Monitoring is already running');
      return false;
    }
    
    this.isMonitoring = true;
    this.systemHealth.components.monitoring = 'active';
    
    // Set up monitoring interval
    this.monitoringInterval = window.setInterval(() => {
      this.collectMetrics();
      this.checkSystemHealth();
    }, intervalMs);
    
    // Record metric for monitoring start
    this.recordMetric({
      category: 'system',
      name: 'monitoring_start',
      value: 1
    });
    
    console.log(`Monitoring started with interval: ${intervalMs}ms`);
    return true;
  }
  
  /**
   * Stop monitoring system
   */
  stopMonitoring(): boolean {
    if (!this.isMonitoring || this.monitoringInterval === null) {
      console.warn('Monitoring is not running');
      return false;
    }
    
    window.clearInterval(this.monitoringInterval);
    this.monitoringInterval = null;
    this.isMonitoring = false;
    this.systemHealth.components.monitoring = 'inactive';
    
    // Record metric for monitoring stop
    this.recordMetric({
      category: 'system',
      name: 'monitoring_stop',
      value: 1
    });
    
    console.log('Monitoring stopped');
    return true;
  }
  
  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): PerformanceMetric {
    const fullMetric: PerformanceMetric = {
      id: uuidv4(),
      timestamp: Date.now(),
      ...metric
    };
    
    this.metrics.push(fullMetric);
    this.checkAlertThresholds(fullMetric);
    this.pruneOldMetrics();
    
    return fullMetric;
  }
  
  /**
   * Create a system alert
   */
  createAlert(alert: Omit<SystemAlert, 'id' | 'timestamp' | 'acknowledged'>): SystemAlert {
    const fullAlert: SystemAlert = {
      id: uuidv4(),
      timestamp: Date.now(),
      acknowledged: false,
      ...alert
    };
    
    this.alerts.push(fullAlert);
    
    // Show toast for critical and error alerts
    if (alert.level === 'critical' || alert.level === 'error') {
      toast({
        title: `${alert.level === 'critical' ? 'Critical Alert' : 'Error'}`,
        description: alert.message,
        variant: "destructive"
      });
    }
    
    return fullAlert;
  }
  
  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(alert => alert.id === alertId);
    
    if (!alert) {
      return false;
    }
    
    alert.acknowledged = true;
    return true;
  }
  
  /**
   * Get all metrics
   */
  getMetrics(
    category?: PerformanceMetric['category'],
    startTime?: number,
    endTime?: number
  ): PerformanceMetric[] {
    let filteredMetrics = [...this.metrics];
    
    if (category) {
      filteredMetrics = filteredMetrics.filter(metric => metric.category === category);
    }
    
    if (startTime) {
      filteredMetrics = filteredMetrics.filter(metric => metric.timestamp >= startTime);
    }
    
    if (endTime) {
      filteredMetrics = filteredMetrics.filter(metric => metric.timestamp <= endTime);
    }
    
    return filteredMetrics;
  }
  
  /**
   * Get all alerts
   */
  getAlerts(
    level?: SystemAlert['level'],
    category?: SystemAlert['category'],
    acknowledged?: boolean
  ): SystemAlert[] {
    let filteredAlerts = [...this.alerts];
    
    if (level) {
      filteredAlerts = filteredAlerts.filter(alert => alert.level === level);
    }
    
    if (category) {
      filteredAlerts = filteredAlerts.filter(alert => alert.category === category);
    }
    
    if (acknowledged !== undefined) {
      filteredAlerts = filteredAlerts.filter(alert => alert.acknowledged === acknowledged);
    }
    
    return filteredAlerts;
  }
  
  /**
   * Get current system health
   */
  getSystemHealth(): SystemHealth {
    // Update system health before returning
    this.checkSystemHealth();
    return { ...this.systemHealth };
  }
  
  /**
   * Get the most recent performance report
   */
  getMostRecentReport(): PerformanceReport | null {
    if (this.reports.length === 0) {
      return null;
    }
    
    return this.reports[this.reports.length - 1];
  }
  
  /**
   * Get all performance reports
   */
  getAllReports(): PerformanceReport[] {
    return [...this.reports];
  }
  
  /**
   * Generate a performance report for a specific period
   */
  generatePerformanceReport(
    period: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): PerformanceReport {
    const now = Date.now();
    let startDate: number;
    
    // Calculate start date based on period
    switch (period) {
      case 'daily':
        startDate = now - (24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = now - (30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    // Get trade history from storage
    const tradeHistory = tradeExecutionStorage.getRecords();
    const periodTrades = tradeHistory.filter(trade => trade.timestamp >= startDate);
    
    const successfulTrades = periodTrades.filter(trade => trade.success).length;
    const failedTrades = periodTrades.filter(trade => !trade.success).length;
    const totalTrades = periodTrades.length;
    const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;
    
    // Calculate average execution time
    const executionTimes = periodTrades
      .filter(trade => trade.executionTime !== undefined)
      .map(trade => trade.executionTime as number);
    
    const averageExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
      : 0;
    
    // Calculate total profit
    const totalProfitValue = periodTrades
      .filter(trade => trade.success && trade.actualProfit)
      .reduce((sum, trade) => sum + parseFloat(trade.actualProfit || '0'), 0);
    
    // Calculate average gas cost
    const gasMetrics = this.getMetrics('gas', startDate, now);
    const gasCosts = gasMetrics.map(metric => metric.value);
    const averageGasCost = gasCosts.length > 0 
      ? gasCosts.reduce((sum, cost) => sum + cost, 0) / gasCosts.length 
      : 0;
    
    // Find most profitable pair and DEX
    const pairProfits: Record<string, number> = {};
    const dexProfits: Record<string, number> = {};
    
    for (const trade of periodTrades) {
      if (trade.success && trade.actualProfit) {
        const pair = `${trade.tokenInSymbol}/${trade.tokenOutSymbol}`;
        const profit = parseFloat(trade.actualProfit);
        
        pairProfits[pair] = (pairProfits[pair] || 0) + profit;
        dexProfits[trade.sourceDex] = (dexProfits[trade.sourceDex] || 0) + profit;
      }
    }
    
    let mostProfitablePair = 'None';
    let highestPairProfit = 0;
    
    for (const [pair, profit] of Object.entries(pairProfits)) {
      if (profit > highestPairProfit) {
        mostProfitablePair = pair;
        highestPairProfit = profit;
      }
    }
    
    let mostProfitableDex = 'None';
    let highestDexProfit = 0;
    
    for (const [dex, profit] of Object.entries(dexProfits)) {
      if (profit > highestDexProfit) {
        mostProfitableDex = dex;
        highestDexProfit = profit;
      }
    }
    
    // Create the report
    const report: PerformanceReport = {
      id: uuidv4(),
      timestamp: now,
      period,
      startDate,
      endDate: now,
      metrics: {
        successfulTrades,
        failedTrades,
        successRate,
        averageExecutionTime,
        totalProfit: `${totalProfitValue.toFixed(4)} ETH`,
        averageGasCost: `${averageGasCost.toFixed(6)} ETH`,
        mostProfitablePair,
        mostProfitableDex
      },
      summary: this.generateReportSummary({
        successfulTrades,
        failedTrades,
        successRate,
        totalProfit: totalProfitValue,
        period
      })
    };
    
    // Save the report
    this.reports.push(report);
    
    return report;
  }
  
  /**
   * Export all data for backup
   */
  exportData(): string {
    const data = {
      metrics: this.metrics,
      alerts: this.alerts,
      reports: this.reports,
      health: this.systemHealth,
      exportTime: Date.now()
    };
    
    return JSON.stringify(data, null, 2);
  }
  
  /**
   * Import data from a backup
   */
  importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.metrics && Array.isArray(data.metrics)) {
        this.metrics = data.metrics;
      }
      
      if (data.alerts && Array.isArray(data.alerts)) {
        this.alerts = data.alerts;
      }
      
      if (data.reports && Array.isArray(data.reports)) {
        this.reports = data.reports;
      }
      
      if (data.health) {
        this.systemHealth = data.health;
      }
      
      toast({
        title: "Analytics Data Imported",
        description: "Successfully imported analytics and monitoring data."
      });
      
      return true;
    } catch (error) {
      console.error('Error importing analytics data:', error);
      
      toast({
        title: "Import Failed",
        description: "Failed to import analytics data. Invalid format.",
        variant: "destructive"
      });
      
      return false;
    }
  }
  
  /**
   * Clear all collected data
   */
  clearData(): void {
    this.metrics = [];
    this.alerts = [];
    this.reports = [];
    
    toast({
      title: "Analytics Data Cleared",
      description: "All analytics and monitoring data has been cleared."
    });
  }
  
  /**
   * Collect metrics on interval
   */
  private collectMetrics(): void {
    try {
      // Application uptime
      const uptime = Date.now() - this.sessionStart;
      this.recordMetric({
        category: 'application',
        name: 'uptime',
        value: uptime / 1000, // Convert to seconds
        unit: 'seconds'
      });
      
      // Memory usage
      if (performance && 'memory' in performance) {
        const memory = (performance as any).memory;
        if (memory && memory.usedJSHeapSize) {
          this.recordMetric({
            category: 'application',
            name: 'memory_usage',
            value: memory.usedJSHeapSize / (1024 * 1024), // Convert to MB
            unit: 'MB'
          });
        }
      }
      
      // Blockchain connection status
      const isWalletConnected = blockchain.isWalletConnected();
      this.recordMetric({
        category: 'blockchain',
        name: 'wallet_connected',
        value: isWalletConnected ? 1 : 0,
        unit: 'boolean'
      });
      
      // Trade statistics
      const perfStats = tradeExecutionStorage.getPerformanceStats();
      
      this.recordMetric({
        category: 'trade',
        name: 'success_rate',
        value: perfStats.successRate,
        unit: 'percent'
      });
      
      this.recordMetric({
        category: 'trade',
        name: 'average_execution_time',
        value: perfStats.averageExecutionTime,
        unit: 'ms'
      });
      
      // Gas price tracking
      this.trackGasPrice();
    } catch (error) {
      console.error('Error collecting metrics:', error);
      
      this.createAlert({
        level: 'error',
        category: 'system',
        message: 'Failed to collect metrics',
        source: 'analytics_service'
      });
    }
  }
  
  /**
   * Track current gas price
   */
  private async trackGasPrice(): Promise<void> {
    try {
      const provider = blockchain.getCurrentProvider();
      const gasPrice = await provider.getGasPrice();
      const gasPriceGwei = parseFloat(gasPrice.toString()) / 1e9;
      
      this.recordMetric({
        category: 'gas',
        name: 'gas_price',
        value: gasPriceGwei,
        unit: 'gwei'
      });
    } catch (error) {
      console.warn('Failed to track gas price:', error);
    }
  }
  
  /**
   * Check system health status
   */
  private checkSystemHealth(): void {
    // Update last checked timestamp
    this.systemHealth.lastChecked = Date.now();
    
    // Check blockchain connection
    const isWalletConnected = blockchain.isWalletConnected();
    this.systemHealth.components.blockchain = isWalletConnected 
      ? 'connected' 
      : 'disconnected';
    
    // Check if any critical alerts are active
    const criticalAlerts = this.getAlerts('critical', undefined, false);
    const errorAlerts = this.getAlerts('error', undefined, false);
    
    // Update overall system health status
    if (criticalAlerts.length > 0) {
      this.systemHealth.status = 'critical';
    } else if (errorAlerts.length > 0 || this.systemHealth.components.blockchain === 'error') {
      this.systemHealth.status = 'degraded';
    } else {
      this.systemHealth.status = 'healthy';
    }
  }
  
  /**
   * Set up default alert thresholds
   */
  private setupDefaultAlertThresholds(): void {
    this.alertThresholds = [
      {
        metric: 'success_rate',
        operator: 'lt',
        value: 50,
        level: 'warning',
        message: 'Trade success rate has fallen below 50%'
      },
      {
        metric: 'success_rate',
        operator: 'lt',
        value: 20,
        level: 'error',
        message: 'Trade success rate has fallen below 20%'
      },
      {
        metric: 'memory_usage',
        operator: 'gt',
        value: 500,
        level: 'warning',
        message: 'High memory usage detected (>500MB)'
      },
      {
        metric: 'gas_price',
        operator: 'gt',
        value: 100,
        level: 'warning',
        message: 'Gas price is high (>100 Gwei)'
      }
    ];
  }
  
  /**
   * Check if a metric triggers any alert thresholds
   */
  private checkAlertThresholds(metric: PerformanceMetric): void {
    for (const threshold of this.alertThresholds) {
      if (metric.name === threshold.metric) {
        let shouldTrigger = false;
        
        switch (threshold.operator) {
          case 'gt':
            shouldTrigger = metric.value > threshold.value;
            break;
          case 'lt':
            shouldTrigger = metric.value < threshold.value;
            break;
          case 'eq':
            shouldTrigger = metric.value === threshold.value;
            break;
          case 'gte':
            shouldTrigger = metric.value >= threshold.value;
            break;
          case 'lte':
            shouldTrigger = metric.value <= threshold.value;
            break;
        }
        
        if (shouldTrigger) {
          this.createAlert({
            level: threshold.level,
            category: metric.category,
            message: threshold.message,
            source: 'threshold_monitor',
            metadata: {
              metricId: metric.id,
              metricName: metric.name,
              metricValue: metric.value,
              thresholdValue: threshold.value,
              operator: threshold.operator
            }
          });
        }
      }
    }
  }
  
  /**
   * Generate a human-readable summary for a report
   */
  private generateReportSummary(data: {
    successfulTrades: number;
    failedTrades: number;
    successRate: number;
    totalProfit: number;
    period: 'daily' | 'weekly' | 'monthly';
  }): string {
    const { successfulTrades, failedTrades, successRate, totalProfit, period } = data;
    
    let periodText = '';
    switch (period) {
      case 'daily': periodText = 'past 24 hours'; break;
      case 'weekly': periodText = 'past week'; break;
      case 'monthly': periodText = 'past month'; break;
    }
    
    let performanceText = '';
    if (successRate >= 80) {
      performanceText = 'excellent performance';
    } else if (successRate >= 60) {
      performanceText = 'good performance';
    } else if (successRate >= 40) {
      performanceText = 'average performance';
    } else {
      performanceText = 'below-average performance';
    }
    
    let profitText = '';
    if (totalProfit > 0) {
      profitText = `with a profit of ${totalProfit.toFixed(4)} ETH`;
    } else if (totalProfit < 0) {
      profitText = `with a loss of ${Math.abs(totalProfit).toFixed(4)} ETH`;
    } else {
      profitText = 'with no net profit or loss';
    }
    
    return `In the ${periodText}, the system completed ${successfulTrades} successful trades out of ${successfulTrades + failedTrades} total attempts (${successRate.toFixed(1)}% success rate), showing ${performanceText} ${profitText}.`;
  }
  
  /**
   * Prune old metrics to conserve memory
   */
  private pruneOldMetrics(): void {
    const now = Date.now();
    const cutoff = now - (this.metricsRetentionDays * 24 * 60 * 60 * 1000);
    
    this.metrics = this.metrics.filter(metric => metric.timestamp >= cutoff);
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
