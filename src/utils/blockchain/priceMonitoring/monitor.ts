
import { DEX, Token, ArbitrageOpportunity } from '@/types';
import { availableDEXes } from '@/utils/dex';
import { dexManager } from '@/utils/dex/DEXManager';
import { MonitoringConfig, TokenPair, PricePoint } from './types';
import { RateLimiter } from './rateLimit';
import { priceHistoryStorage } from './storage';
import { webSocketManager } from './websocket';
import { executeArbitrage, estimateGasCost } from '@/utils/arbitrage';
import { v4 as uuidv4 } from 'uuid';
import { flashloanService } from '@/utils/flashloan';
import { blockchain } from '@/utils/blockchain';
import { toast } from '@/hooks/use-toast';

class PriceMonitoringService {
  private isRunning: boolean = false;
  private monitoredPairs: TokenPair[] = [];
  private pollingIntervalId: number | null = null;
  private rateLimiter: RateLimiter;
  private config: MonitoringConfig = {
    pollingInterval: 30000, // 30 seconds
    maxRequestsPerMinute: 60,
    minProfitPercentage: 0.5, // 0.5%
    autoExecuteTrades: false,
    maxPriceHistoryLength: 1000,
  };
  private activeDexes: DEX[] = [];
  private pendingOpportunities: Map<string, ArbitrageOpportunity> = new Map();
  private chainId: number = 1;

  constructor() {
    this.rateLimiter = new RateLimiter(this.config.maxRequestsPerMinute);
    priceHistoryStorage.setMaxHistoryLength(this.config.maxPriceHistoryLength);
  }

  /**
   * Update the monitoring configuration
   */
  updateConfig(config: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update rate limiter if maxRequestsPerMinute changed
    if (config.maxRequestsPerMinute) {
      this.rateLimiter = new RateLimiter(this.config.maxRequestsPerMinute);
    }
    
    // Update price history storage if maxPriceHistoryLength changed
    if (config.maxPriceHistoryLength) {
      priceHistoryStorage.setMaxHistoryLength(this.config.maxPriceHistoryLength);
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
      this.connectToWebSockets();
      
      // Set up polling interval for REST API fallback
      this.pollingIntervalId = window.setInterval(
        () => this.pollPrices(),
        this.config.pollingInterval
      );
      
      this.isRunning = true;
      
      toast({
        title: "Price Monitoring Started",
        description: `Monitoring ${this.monitoredPairs.length} token pairs across ${this.activeDexes.length} DEXes`,
      });
      
      // Perform initial price poll
      this.pollPrices();
      
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
      for (const dex of this.activeDexes) {
        const wsStatus = webSocketManager.getConnectionStatus(dex.id);
        if (wsStatus === 'connected') {
          webSocketManager.subscribeToPair(dex.id, tokenA, tokenB);
        }
      }
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
   * Connect to WebSockets for all active DEXes
   */
  private connectToWebSockets(): void {
    for (const dex of this.activeDexes) {
      const connected = webSocketManager.connect(dex, this.chainId);
      
      if (connected) {
        // Add WebSocket message handler
        webSocketManager.addMessageHandler(dex.id, (data) => {
          this.handleWebSocketPrice(dex, data);
        });
        
        // Subscribe to all monitored pairs
        for (const pair of this.monitoredPairs) {
          webSocketManager.subscribeToPair(dex.id, pair.tokenA, pair.tokenB);
        }
      }
    }
  }

  /**
   * Handle a price update from WebSocket
   */
  private handleWebSocketPrice(dex: DEX, data: any): void {
    // Extract token addresses and price from WebSocket message
    // This would need to be adjusted based on the actual message format from each DEX
    try {
      // Example parsing logic (adjust based on actual format)
      if (data.type === 'price' && data.pair && data.price) {
        const [token0Address, token1Address] = data.pair.split('-');
        
        if (!token0Address || !token1Address) {
          return;
        }
        
        const pricePoint: PricePoint = {
          timestamp: Date.now(),
          price: parseFloat(data.price),
          dexId: dex.id,
        };
        
        // Store price data for both tokens
        priceHistoryStorage.addPricePoint(token0Address, pricePoint);
        
        // Check for arbitrage opportunities
        this.checkForArbitrageOpportunities();
      }
    } catch (error) {
      console.error(`Error handling WebSocket price for ${dex.name}:`, error);
    }
  }

  /**
   * Poll prices using REST APIs
   */
  private async pollPrices(): Promise<void> {
    if (!this.isRunning || this.monitoredPairs.length === 0) {
      return;
    }
    
    try {
      for (const pair of this.monitoredPairs) {
        for (const dex of this.activeDexes) {
          // Check rate limits
          if (!this.rateLimiter.canMakeRequest()) {
            console.warn('Rate limit reached, skipping price poll');
            return;
          }
          
          try {
            this.rateLimiter.recordRequest();
            
            const adapter = dexManager.getAdapter(dex.id);
            if (!adapter) {
              continue;
            }
            
            // Get price from DEX
            const price = await adapter.getTokenPrice(pair.tokenA, pair.tokenB);
            
            // Store price data
            const pricePoint: PricePoint = {
              timestamp: Date.now(),
              price,
              dexId: dex.id,
            };
            
            priceHistoryStorage.addPricePoint(pair.tokenA.address, pricePoint);
          } catch (error) {
            console.error(`Error polling price for ${pair.tokenA.symbol}/${pair.tokenB.symbol} on ${dex.name}:`, error);
          }
        }
      }
      
      // Check for arbitrage opportunities
      this.checkForArbitrageOpportunities();
    } catch (error) {
      console.error('Error polling prices:', error);
    }
  }

  /**
   * Check for arbitrage opportunities across DEXes
   */
  private async checkForArbitrageOpportunities(): Promise<void> {
    if (!this.isRunning || this.activeDexes.length < 2) {
      return;
    }
    
    try {
      for (const pair of this.monitoredPairs) {
        const { tokenA, tokenB } = pair;
        
        // For each pair of DEXes
        for (let i = 0; i < this.activeDexes.length; i++) {
          for (let j = i + 1; j < this.activeDexes.length; j++) {
            const dexA = this.activeDexes[i];
            const dexB = this.activeDexes[j];
            
            // Get latest prices
            const priceA = priceHistoryStorage.getLatestPrice(tokenA.address, dexA.id);
            const priceB = priceHistoryStorage.getLatestPrice(tokenA.address, dexB.id);
            
            if (priceA === null || priceB === null) {
              continue;
            }
            
            // Calculate price difference
            const priceDiff = ((priceB - priceA) / priceA) * 100;
            const absPriceDiff = Math.abs(priceDiff);
            
            // Check if price difference is significant
            if (absPriceDiff < this.config.minProfitPercentage) {
              continue;
            }
            
            // Determine source and target DEX based on price difference
            const [sourceDex, targetDex] = priceDiff > 0 ? [dexA, dexB] : [dexB, dexA];
            
            // Calculate a reasonable trade size based on available liquidity
            // This is a simplified approach; in practice, you'd want to optimize this
            const tradeSize = `${tokenA.price ? (1000 / tokenA.price).toFixed(4) : "1.0"}`;
            
            // Estimate gas cost
            const gasEstimate = await estimateGasCost();
            
            // Calculate estimated profit
            const profitPercentage = Math.abs(priceDiff);
            const estimatedProfit = `${((tokenA.price || 1) * (profitPercentage / 100)).toFixed(4)} USD`;
            
            // Check if profit would cover fees
            const profitabilityCheck = await flashloanService.calculateArbitrageProfitability(
              tokenA,
              tradeSize,
              estimatedProfit
            );
            
            if (!profitabilityCheck.isProfitable) {
              continue;
            }
            
            // Create arbitrage opportunity
            const opportunity: ArbitrageOpportunity = {
              id: uuidv4(),
              sourceDex,
              targetDex,
              tokenIn: tokenA,
              tokenOut: tokenB,
              profitPercentage: profitPercentage,
              estimatedProfit: profitabilityCheck.netProfit,
              gasEstimate,
              tradeSize,
              timestamp: Date.now(),
              status: 'pending'
            };
            
            // Save opportunity for potential execution
            this.pendingOpportunities.set(opportunity.id, opportunity);
            
            // If auto-execute is enabled, execute the trade
            if (this.config.autoExecuteTrades) {
              this.executeOpportunity(opportunity);
            } else {
              // Notify user of opportunity
              toast({
                title: "Arbitrage Opportunity",
                description: `${tokenA.symbol}: ${profitPercentage.toFixed(2)}% profit between ${sourceDex.name} and ${targetDex.name}`,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking for arbitrage opportunities:', error);
    }
  }

  /**
   * Execute an arbitrage opportunity
   */
  private async executeOpportunity(opportunity: ArbitrageOpportunity): Promise<void> {
    try {
      // Update opportunity status
      opportunity.status = 'executing';
      this.pendingOpportunities.set(opportunity.id, opportunity);
      
      // Execute arbitrage
      const result = await executeArbitrage(opportunity);
      
      // Update opportunity status based on result
      if (result.success) {
        opportunity.status = 'completed';
        
        toast({
          title: "Arbitrage Executed",
          description: `Successfully executed ${opportunity.tokenIn.symbol} arbitrage with ${opportunity.profitPercentage.toFixed(2)}% profit`,
        });
      } else {
        opportunity.status = 'failed';
        
        toast({
          title: "Arbitrage Failed",
          description: result.error || "Transaction failed",
          variant: "destructive",
        });
      }
      
      // Update in pending opportunities
      this.pendingOpportunities.set(opportunity.id, opportunity);
    } catch (error) {
      console.error('Error executing arbitrage opportunity:', error);
      
      // Update opportunity status
      opportunity.status = 'failed';
      this.pendingOpportunities.set(opportunity.id, opportunity);
      
      toast({
        title: "Arbitrage Failed",
        description: "Error executing arbitrage opportunity",
        variant: "destructive",
      });
    }
  }

  /**
   * Get all pending opportunities
   */
  getPendingOpportunities(): ArbitrageOpportunity[] {
    return Array.from(this.pendingOpportunities.values());
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
  } {
    return {
      isRunning: this.isRunning,
      monitoredPairsCount: this.monitoredPairs.length,
      activeDexesCount: this.activeDexes.length,
      pendingOpportunitiesCount: this.pendingOpportunities.size,
      requestsRemaining: this.rateLimiter.getRequestsRemaining(),
    };
  }
}

// Export singleton instance
export const priceMonitoringService = new PriceMonitoringService();
