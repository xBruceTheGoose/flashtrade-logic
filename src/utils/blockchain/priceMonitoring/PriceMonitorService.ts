
import { DEX, Token, ArbitrageOpportunity } from '@/types';
import { availableDEXes } from '@/utils/dex';
import { MonitoringConfig, TokenPair } from './types';
import { priceHistoryStorage } from './storage';
import { blockchain } from '@/utils/blockchain';
import { toast } from '@/hooks/use-toast';
import { monitoringConfig } from './config';
import { opportunityManager } from './opportunityManager';
import { arbitrageScanner } from './scanner';
import { wsConnector } from './wsConnector';
import { PricePoller } from './pricePoller';
import { webSocketManager } from './ws';

/**
 * Service for monitoring price differences across DEXes and finding arbitrage opportunities
 */
class PriceMonitoringService {
  private isRunning: boolean = false;
  private monitoredPairs: TokenPair[] = [];
  private pollingIntervalId: number | null = null;
  private pricePoller: PricePoller;
  private activeDexes: DEX[] = [];
  private chainId: number = 1;

  constructor() {
    this.pricePoller = new PricePoller(monitoringConfig.getConfig().maxRequestsPerMinute);
  }

  /**
   * Update the monitoring configuration
   */
  updateConfig(config: Partial<MonitoringConfig>): void {
    const updatedConfig = monitoringConfig.updateConfig(config);
    
    // Update rate limiter if maxRequestsPerMinute changed
    if (config.maxRequestsPerMinute) {
      this.pricePoller.updateRateLimiter(updatedConfig.maxRequestsPerMinute);
    }
    
    // Restart polling if running and interval changed
    if (this.isRunning && config.pollingInterval && this.pollingIntervalId) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  /**
   * Start monitoring prices
   */
  async startMonitoring(): Promise<boolean> {
    if (this.isRunning) {
      console.warn('Price monitoring is already running');
      return false;
    }
    
    try {
      // Get current chain ID
      const provider = blockchain.getCurrentProvider();
      const network = await provider.getNetwork();
      this.chainId = network.chainId;
      
      // Initialize active DEXes
      this.activeDexes = availableDEXes.filter(dex => dex.active);
      
      if (this.activeDexes.length === 0) {
        toast({
          title: "Monitoring Failed",
          description: "No active DEXes to monitor",
          variant: "destructive",
        });
        return false;
      }
      
      // Connect to WebSockets where available
      wsConnector.connectToDexes(this.activeDexes, this.chainId);
      
      // Subscribe to token pairs
      wsConnector.subscribeTokenPairs(this.monitoredPairs, this.activeDexes);
      
      // Set up polling interval for REST API fallback
      const config = monitoringConfig.getConfig();
      this.pollingIntervalId = window.setInterval(
        () => this.pollPricesAndScan(),
        config.pollingInterval
      );
      
      this.isRunning = true;
      
      toast({
        title: "Price Monitoring Started",
        description: `Monitoring ${this.monitoredPairs.length} token pairs across ${this.activeDexes.length} DEXes`,
      });
      
      // Perform initial price poll
      this.pollPricesAndScan();
      
      return true;
    } catch (error) {
      console.error('Error starting price monitoring:', error);
      
      toast({
        title: "Monitoring Failed",
        description: "Failed to start price monitoring",
        variant: "destructive",
      });
      
      return false;
    }
  }

  /**
   * Stop monitoring prices
   */
  stopMonitoring(): void {
    if (!this.isRunning) {
      return;
    }
    
    // Clear polling interval
    if (this.pollingIntervalId !== null) {
      window.clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    
    // Disconnect from WebSockets
    webSocketManager.disconnectAll();
    
    this.isRunning = false;
    
    toast({
      title: "Price Monitoring Stopped",
      description: "Arbitrage price monitoring has been stopped",
    });
  }

  /**
   * Poll prices and scan for arbitrage opportunities
   */
  private async pollPricesAndScan(): Promise<void> {
    if (!this.isRunning || this.monitoredPairs.length === 0) {
      return;
    }
    
    // Poll prices using REST APIs
    await this.pricePoller.pollPrices(this.monitoredPairs, this.activeDexes);
    
    // Periodically check for arbitrage opportunities
    if (arbitrageScanner.shouldScan()) {
      this.scanForArbitrageOpportunities();
    }
  }

  /**
   * Add a token pair to monitor
   */
  addPairToMonitor(tokenA: Token, tokenB: Token): boolean {
    // Check if pair is already monitored
    const isAlreadyMonitored = this.monitoredPairs.some(
      pair => (
        (pair.tokenA.address === tokenA.address && pair.tokenB.address === tokenB.address) ||
        (pair.tokenA.address === tokenB.address && pair.tokenB.address === tokenA.address)
      )
    );
    
    if (isAlreadyMonitored) {
      return false;
    }
    
    // Add pair to monitored pairs
    this.monitoredPairs.push({ tokenA, tokenB });
    
    // Subscribe to WebSocket updates if monitoring is running
    if (this.isRunning) {
      wsConnector.subscribeTokenPairs([{ tokenA, tokenB }], this.activeDexes);
    }
    
    return true;
  }

  /**
   * Remove a token pair from monitoring
   */
  removePairFromMonitor(tokenA: Token, tokenB: Token): boolean {
    const initialLength = this.monitoredPairs.length;
    
    this.monitoredPairs = this.monitoredPairs.filter(
      pair => !(
        (pair.tokenA.address === tokenA.address && pair.tokenB.address === tokenB.address) ||
        (pair.tokenA.address === tokenB.address && pair.tokenB.address === tokenA.address)
      )
    );
    
    return this.monitoredPairs.length < initialLength;
  }

  /**
   * Clear all monitored pairs
   */
  clearMonitoredPairs(): void {
    this.monitoredPairs = [];
  }

  /**
   * Get all currently monitored pairs
   */
  getMonitoredPairs(): TokenPair[] {
    return [...this.monitoredPairs];
  }

  /**
   * Scan for arbitrage opportunities across DEXes
   */
  private async scanForArbitrageOpportunities(): Promise<void> {
    if (!this.isRunning || this.activeDexes.length < 2) {
      return;
    }
    
    try {
      // Extract unique tokens from all monitored pairs
      const uniqueTokens = new Map<string, Token>();
      
      for (const pair of this.monitoredPairs) {
        uniqueTokens.set(pair.tokenA.address, pair.tokenA);
        uniqueTokens.set(pair.tokenB.address, pair.tokenB);
      }
      
      const tokens = Array.from(uniqueTokens.values());
      
      // Use scanner to find opportunities
      await arbitrageScanner.scanForOpportunities(tokens, this.activeDexes);
    } catch (error) {
      console.error('Error scanning for arbitrage opportunities:', error);
    }
  }

  /**
   * Force scan for arbitrage opportunities now
   * (useful for UI interactions)
   */
  async forceScanForArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    // Scan for opportunities
    await this.scanForArbitrageOpportunities();
    
    // Return pending opportunities
    return this.getPendingOpportunities();
  }

  /**
   * Get all pending opportunities
   */
  getPendingOpportunities(): ArbitrageOpportunity[] {
    return opportunityManager.getPendingOpportunities();
  }

  /**
   * Get an opportunity by ID
   */
  getOpportunity(id: string): ArbitrageOpportunity | undefined {
    return opportunityManager.getOpportunity(id);
  }

  /**
   * Execute an arbitrage opportunity
   */
  executeOpportunity(opportunityId: string): void {
    const opportunity = this.getOpportunity(opportunityId);
    if (opportunity) {
      opportunityManager.executeOpportunity(opportunity);
    }
  }

  /**
   * Clear old price data
   */
  clearOldPriceData(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    priceHistoryStorage.clearOldData(maxAgeMs);
  }

  /**
   * Check if monitoring is currently running
   */
  isMonitoringActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get monitoring stats
   */
  getMonitoringStats(): {
    isRunning: boolean;
    monitoredPairsCount: number;
    activeDexesCount: number;
    pendingOpportunitiesCount: number;
    requestsRemaining: number;
    lastArbitrageScan: number;
  } {
    return {
      isRunning: this.isRunning,
      monitoredPairsCount: this.monitoredPairs.length,
      activeDexesCount: this.activeDexes.length,
      pendingOpportunitiesCount: opportunityManager.getPendingOpportunities().length,
      requestsRemaining: this.pricePoller.getRequestsRemaining(),
      lastArbitrageScan: arbitrageScanner.getLastScanTime(),
    };
  }
}

export const priceMonitoringService = new PriceMonitoringService();
