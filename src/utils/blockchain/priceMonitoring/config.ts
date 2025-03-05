
import { MonitoringConfig } from './types';
import { arbitrageDetectionEngine } from './arbitrageDetection';
import { priceHistoryStorage } from './storage';

/**
 * Manages price monitoring configuration settings
 */
export class MonitoringConfigManager {
  private config: MonitoringConfig = {
    pollingInterval: 30000, // 30 seconds
    maxRequestsPerMinute: 60,
    minProfitPercentage: 0.5, // 0.5%
    autoExecuteTrades: false,
    maxPriceHistoryLength: 1000,
    maxArbitragePathLength: 3,
    minProfitUSD: 5,
  };

  constructor() {
    this.applyConfig(this.config);
  }

  /**
   * Get the current configuration
   */
  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  /**
   * Update the monitoring configuration
   */
  updateConfig(config: Partial<MonitoringConfig>): MonitoringConfig {
    this.config = { ...this.config, ...config };
    this.applyConfig(this.config);
    return this.getConfig();
  }

  /**
   * Apply configuration to all related services
   */
  private applyConfig(config: MonitoringConfig): void {
    // Update price history storage
    priceHistoryStorage.setMaxHistoryLength(config.maxPriceHistoryLength);
    
    // Update arbitrage detection engine configuration
    arbitrageDetectionEngine.updateConfig({
      minProfitPercentage: config.minProfitPercentage,
      minProfitUSD: config.minProfitUSD,
      maxPathLength: config.maxArbitragePathLength
    });
  }
}

// Export singleton instance
export const monitoringConfig = new MonitoringConfigManager();
