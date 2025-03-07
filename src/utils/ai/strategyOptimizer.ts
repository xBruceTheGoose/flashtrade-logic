import { TradeExecutionRecord } from '../arbitrage/types';
import { aiService } from './aiService';
import { analyticsService } from '../monitoring/analyticsService';
import { executionConfigManager } from '../arbitrage/executionConfig';
import { logger } from '../monitoring/loggingService';
import { priceHistoryStorage } from '../blockchain/priceMonitoring/storage';
import { tradeExecutionStorage } from '../arbitrage/storage';

/**
 * Interface for AI-generated trade strategy recommendations
 */
export interface StrategyRecommendation {
  id: string;
  timestamp: number;
  confidence: number;
  parameters: {
    minProfitPercentage?: number;
    maxTradeSize?: number;
    slippageTolerance?: number;
    gasStrategy?: 'standard' | 'fast' | 'aggressive';
    riskTolerance?: 'low' | 'medium' | 'high';
  };
  recommendedTokenPairs?: Array<{
    tokenIn: string;
    tokenOut: string;
    confidence: number;
  }>;
  recommendedDexes?: Array<{
    dexName: string;
    weight: number;
  }>;
  optimalTradingHours?: Array<{
    hour: number;
    score: number;
  }>;
  networkConditions?: {
    gasPrice: string;
    congestion: 'low' | 'medium' | 'high';
    recommendedAction: string;
  };
  summary: string;
  improvementSuggestions: string[];
}

/**
 * Service for AI-powered strategy optimization
 */
export class StrategyOptimizer {
  private lastOptimizationTime: number = 0;
  private recommendations: StrategyRecommendation[] = [];
  private readonly OPTIMIZATION_INTERVAL = 3600000; // 1 hour
  
  /**
   * Generate an AI-powered strategy recommendation
   */
  public async generateRecommendation(): Promise<StrategyRecommendation | null> {
    try {
      logger.info('ai', 'Generating AI strategy recommendation');
      
      // Check if we've generated a recommendation recently
      const now = Date.now();
      if (now - this.lastOptimizationTime < this.OPTIMIZATION_INTERVAL) {
        logger.info('ai', 'Skipping recommendation - too soon since last optimization');
        return this.getLatestRecommendation();
      }
      
      // 1. Collect historical trade data
      const tradeHistory = tradeExecutionStorage.getRecords();
      
      // If we don't have enough data, return null
      if (tradeHistory.length < 5) {
        logger.warn('ai', 'Not enough historical trade data for strategy optimization');
        return null;
      }
      
      // 2. Analyze historical performance
      const performanceData = this.analyzeHistoricalPerformance(tradeHistory);
      
      // 3. Collect current market conditions
      const marketConditions = this.collectMarketConditions();
      
      // 4. Collect current user configuration
      const currentConfig = executionConfigManager.getExecutionConfig();
      
      // 5. Prepare data for AI analysis
      const analysisData = {
        performanceData,
        marketConditions,
        currentConfig,
        tradeHistory: tradeHistory.slice(0, 50) // Send only most recent 50 trades
      };
      
      // 6. Call AI service for recommendation
      const recommendation = await this.callAIForRecommendation(analysisData);
      
      // 7. Store recommendation
      this.recommendations.unshift(recommendation);
      
      // Keep only the last 10 recommendations
      if (this.recommendations.length > 10) {
        this.recommendations = this.recommendations.slice(0, 10);
      }
      
      // Update optimization timestamp
      this.lastOptimizationTime = now;
      
      // Return the new recommendation
      return recommendation;
    } catch (error) {
      logger.error('ai', 'Failed to generate AI strategy recommendation', { error });
      return null;
    }
  }
  
  /**
   * Apply an AI-generated recommendation to the execution configuration
   */
  public applyRecommendation(
    recommendationId: string,
    applyParameterUpdates: boolean = true,
    applyGasStrategy: boolean = true,
    applyRiskTolerance: boolean = true
  ): boolean {
    try {
      // Find the recommendation by ID
      const recommendation = this.recommendations.find(rec => rec.id === recommendationId);
      
      if (!recommendation) {
        logger.warn('ai', 'Cannot apply recommendation - not found by ID', { recommendationId });
        return false;
      }
      
      // Get current config
      const currentConfig = executionConfigManager.getExecutionConfig();
      
      // Prepare updates object
      const updates: any = {};
      
      // Apply parameter updates if requested
      if (applyParameterUpdates) {
        if (recommendation.parameters.minProfitPercentage !== undefined) {
          updates.minProfitPercentage = recommendation.parameters.minProfitPercentage;
        }
        
        if (recommendation.parameters.maxTradeSize !== undefined) {
          updates.maxTradeSize = recommendation.parameters.maxTradeSize;
        }
        
        if (recommendation.parameters.slippageTolerance !== undefined) {
          updates.slippageTolerance = recommendation.parameters.slippageTolerance;
        }
      }
      
      // Apply gas strategy if requested
      if (applyGasStrategy && recommendation.parameters.gasStrategy) {
        updates.gasPrice = recommendation.parameters.gasStrategy;
      }
      
      // Apply risk tolerance if requested
      if (applyRiskTolerance && recommendation.parameters.riskTolerance) {
        updates.riskTolerance = recommendation.parameters.riskTolerance;
      }
      
      // Apply updates if we have any
      if (Object.keys(updates).length > 0) {
        executionConfigManager.updateExecutionConfig(updates);
        
        logger.info('ai', 'Applied AI strategy recommendation', { 
          recommendationId, 
          updates 
        });
        
        return true;
      } else {
        logger.info('ai', 'No changes applied from recommendation', { recommendationId });
        return false;
      }
    } catch (error) {
      logger.error('ai', 'Failed to apply AI strategy recommendation', { error });
      return false;
    }
  }
  
  /**
   * Get the latest recommendation
   */
  public getLatestRecommendation(): StrategyRecommendation | null {
    return this.recommendations.length > 0 ? this.recommendations[0] : null;
  }
  
  /**
   * Get all recommendations
   */
  public getAllRecommendations(): StrategyRecommendation[] {
    return [...this.recommendations];
  }
  
  /**
   * Generate a performance report with recommendations
   */
  public generatePerformanceReport(): {
    report: any;
    recommendations: StrategyRecommendation | null;
  } {
    // Generate a performance report using the analytics service
    const report = analyticsService.generatePerformanceReport('weekly');
    
    // Get the latest recommendation if available
    const recommendations = this.getLatestRecommendation();
    
    return {
      report,
      recommendations
    };
  }
  
  /**
   * Analyze historical performance of trades
   */
  private analyzeHistoricalPerformance(trades: TradeExecutionRecord[]): any {
    // Filter successful trades
    const successfulTrades = trades.filter(trade => trade.success);
    
    // Calculate success rate by token pair
    const pairSuccessRates: Record<string, { success: number, total: number, rate: number }> = {};
    
    for (const trade of trades) {
      const pair = `${trade.tokenInSymbol}/${trade.tokenOutSymbol}`;
      
      if (!pairSuccessRates[pair]) {
        pairSuccessRates[pair] = { success: 0, total: 0, rate: 0 };
      }
      
      pairSuccessRates[pair].total += 1;
      
      if (trade.success) {
        pairSuccessRates[pair].success += 1;
      }
    }
    
    // Calculate success rates
    for (const pair in pairSuccessRates) {
      const { success, total } = pairSuccessRates[pair];
      pairSuccessRates[pair].rate = total > 0 ? (success / total) * 100 : 0;
    }
    
    // Calculate success rate by DEX
    const dexSuccessRates: Record<string, { success: number, total: number, rate: number }> = {};
    
    for (const trade of trades) {
      if (!dexSuccessRates[trade.sourceDex]) {
        dexSuccessRates[trade.sourceDex] = { success: 0, total: 0, rate: 0 };
      }
      
      dexSuccessRates[trade.sourceDex].total += 1;
      
      if (trade.success) {
        dexSuccessRates[trade.sourceDex].success += 1;
      }
    }
    
    // Calculate success rates for DEXes
    for (const dex in dexSuccessRates) {
      const { success, total } = dexSuccessRates[dex];
      dexSuccessRates[dex].rate = total > 0 ? (success / total) * 100 : 0;
    }
    
    // Calculate hourly performance
    const hourlyPerformance: Record<number, { count: number, successCount: number, profit: number }> = {};
    
    for (let hour = 0; hour < 24; hour++) {
      hourlyPerformance[hour] = { count: 0, successCount: 0, profit: 0 };
    }
    
    for (const trade of trades) {
      const hour = new Date(trade.timestamp).getHours();
      hourlyPerformance[hour].count += 1;
      
      if (trade.success) {
        hourlyPerformance[hour].successCount += 1;
        
        if (trade.profitAmount) {
          hourlyPerformance[hour].profit += parseFloat(trade.profitAmount);
        }
      }
    }
    
    // Calculate gas statistics
    const gasStats = this.calculateGasStatistics(trades);
    
    return {
      pairSuccessRates,
      dexSuccessRates,
      hourlyPerformance,
      gasStats,
      totalTrades: trades.length,
      successfulTrades: successfulTrades.length,
      successRate: trades.length > 0 ? (successfulTrades.length / trades.length) * 100 : 0
    };
  }
  
  /**
   * Calculate gas usage statistics
   */
  private calculateGasStatistics(trades: TradeExecutionRecord[]): any {
    const successfulTrades = trades.filter(trade => trade.success && trade.gasUsed);
    
    if (successfulTrades.length === 0) {
      return { average: 0, min: 0, max: 0, median: 0 };
    }
    
    // Extract gas costs
    const gasCosts = successfulTrades
      .map(trade => parseFloat(trade.gasUsed || '0'))
      .filter(cost => !isNaN(cost) && cost > 0);
    
    if (gasCosts.length === 0) {
      return { average: 0, min: 0, max: 0, median: 0 };
    }
    
    // Sort gas costs
    gasCosts.sort((a, b) => a - b);
    
    // Calculate statistics
    const average = gasCosts.reduce((sum, cost) => sum + cost, 0) / gasCosts.length;
    const min = gasCosts[0];
    const max = gasCosts[gasCosts.length - 1];
    
    // Calculate median
    const midPoint = Math.floor(gasCosts.length / 2);
    const median = gasCosts.length % 2 === 0
      ? (gasCosts[midPoint - 1] + gasCosts[midPoint]) / 2
      : gasCosts[midPoint];
    
    return { average, min, max, median };
  }
  
  /**
   * Collect current market conditions
   */
  private collectMarketConditions(): any {
    // Get recent price volatility for major tokens
    const ethVolatility = priceHistoryStorage.getPriceVolatility('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'); // WETH
    const btcVolatility = priceHistoryStorage.getPriceVolatility('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'); // WBTC
    
    // Get gas metrics
    const gasMetrics = analyticsService.getMetrics('gas', Date.now() - 3600000);
    
    // Calculate average gas price from metrics
    const gasPrices = gasMetrics
      .filter(metric => metric.name === 'gas_price')
      .map(metric => metric.value);
    
    const averageGasPrice = gasPrices.length > 0
      ? gasPrices.reduce((sum, price) => sum + price, 0) / gasPrices.length
      : 0;
    
    // Determine congestion level
    let congestion: 'low' | 'medium' | 'high' = 'medium';
    
    if (averageGasPrice < 20) {
      congestion = 'low';
    } else if (averageGasPrice > 100) {
      congestion = 'high';
    }
    
    return {
      timestamp: Date.now(),
      volatility: {
        eth: ethVolatility,
        btc: btcVolatility
      },
      gas: {
        averagePrice: averageGasPrice,
        congestion
      }
    };
  }
  
  /**
   * Call the AI service for strategy recommendations
   */
  private async callAIForRecommendation(analysisData: any): Promise<StrategyRecommendation> {
    // Normally we would send this data to an AI model, but since we're using a
    // simulated approach, we'll generate a recommendation based on the analysis data
    
    // Try to get a real recommendation if AI service is available
    try {
      const aiRecommendation = await aiService.evaluateArbitrageOpportunity(analysisData);
      
      if (aiRecommendation && aiRecommendation.recommendation === 'execute') {
        logger.info('ai', 'Using AI-generated strategy recommendation');
        
        // Process the AI recommendation
        return this.createRecommendationFromAIResponse(aiRecommendation, analysisData);
      }
    } catch (error) {
      logger.warn('ai', 'Failed to get AI recommendation, using fallback', { error });
    }
    
    // Fallback to rule-based recommendation
    return this.generateFallbackRecommendation(analysisData);
  }
  
  /**
   * Create a recommendation from AI service response
   */
  private createRecommendationFromAIResponse(
    aiResponse: any, 
    analysisData: any
  ): StrategyRecommendation {
    // Extract performance data
    const { pairSuccessRates, dexSuccessRates, hourlyPerformance, gasStats } = analysisData.performanceData;
    
    // Get current configuration
    const currentConfig = analysisData.currentConfig;
    
    // Determine recommended token pairs
    const recommendedTokenPairs = Object.entries(pairSuccessRates)
      .filter(([_, data]: [string, any]) => data.rate > 70 && data.total >= 3)
      .map(([pair, data]: [string, any]) => {
        const [tokenIn, tokenOut] = pair.split('/');
        return {
          tokenIn,
          tokenOut,
          confidence: data.rate / 100
        };
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
    
    // Determine recommended DEXes
    const recommendedDexes = Object.entries(dexSuccessRates)
      .filter(([_, data]: [string, any]) => data.rate > 60 && data.total >= 3)
      .map(([dex, data]: [string, any]) => ({
        dexName: dex,
        weight: data.rate / 100
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3);
    
    // Determine optimal trading hours
    const optimalTradingHours = Object.entries(hourlyPerformance)
      .map(([hour, data]: [string, any]) => ({
        hour: parseInt(hour),
        score: data.count > 0 ? (data.successCount / data.count) * (data.profit + 1) : 0
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    
    // Determine network conditions
    const gasPrice = analysisData.marketConditions.gas.averagePrice.toFixed(2);
    const congestion = analysisData.marketConditions.gas.congestion;
    
    // Determine recommended gas strategy
    let gasStrategy: 'standard' | 'fast' | 'aggressive' = 'standard';
    if (congestion === 'high') {
      gasStrategy = 'aggressive';
    } else if (congestion === 'medium') {
      gasStrategy = 'fast';
    }
    
    // Generate improvement suggestions
    const improvementSuggestions: string[] = [];
    
    // Suggest trade size adjustment if needed
    if (analysisData.marketConditions.volatility.eth > 10) {
      improvementSuggestions.push(
        "Consider reducing maximum trade size due to high ETH volatility"
      );
    }
    
    // Suggest gas strategy change if needed
    if (congestion === 'high' && currentConfig.gasPrice !== 'aggressive') {
      improvementSuggestions.push(
        "Switch to aggressive gas strategy due to high network congestion"
      );
    } else if (congestion === 'low' && currentConfig.gasPrice !== 'standard') {
      improvementSuggestions.push(
        "Switch to standard gas strategy to save on transaction costs"
      );
    }
    
    // Suggest optimal trading times
    if (optimalTradingHours.length > 0) {
      const bestHours = optimalTradingHours
        .slice(0, 3)
        .map(h => `${h.hour}:00-${h.hour}:59`)
        .join(', ');
      improvementSuggestions.push(
        `Schedule more trades during optimal hours: ${bestHours}`
      );
    }
    
    // Create the recommendation
    return {
      id: `rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      confidence: aiResponse.confidence || 0.75,
      parameters: {
        minProfitPercentage: Math.max(0.2, currentConfig.minProfitPercentage * 0.9),
        maxTradeSize: currentConfig.maxTradeSize,
        slippageTolerance: congestion === 'high' 
          ? Math.min(2.0, currentConfig.slippageTolerance * 1.5) 
          : currentConfig.slippageTolerance,
        gasStrategy,
        riskTolerance: currentConfig.riskTolerance
      },
      recommendedTokenPairs,
      recommendedDexes,
      optimalTradingHours,
      networkConditions: {
        gasPrice: `${gasPrice} Gwei`,
        congestion,
        recommendedAction: congestion === 'high' 
          ? 'Decrease trade frequency and increase gas price' 
          : 'Maintain normal operation'
      },
      summary: aiResponse.reasoning || 'AI-optimized strategy based on historical performance and current market conditions',
      improvementSuggestions
    };
  }
  
  /**
   * Generate a fallback recommendation using rule-based approach
   */
  private generateFallbackRecommendation(analysisData: any): StrategyRecommendation {
    // Extract performance data
    const { pairSuccessRates, dexSuccessRates, hourlyPerformance, gasStats } = analysisData.performanceData;
    
    // Get current configuration
    const currentConfig = analysisData.currentConfig;
    
    // Determine market volatility
    const volatility = analysisData.marketConditions.volatility.eth;
    const highVolatility = volatility > 8;
    
    // Adjust min profit percentage based on market volatility
    let minProfitPercentage = currentConfig.minProfitPercentage;
    if (highVolatility) {
      // Increase minimum profit requirement in volatile markets
      minProfitPercentage = Math.max(currentConfig.minProfitPercentage, 0.8);
    }
    
    // Adjust slippage tolerance based on market volatility
    let slippageTolerance = currentConfig.slippageTolerance;
    if (highVolatility) {
      // Increase slippage tolerance in volatile markets
      slippageTolerance = Math.min(2.0, currentConfig.slippageTolerance * 1.5);
    }
    
    // Adjust max trade size based on market volatility
    let maxTradeSize = currentConfig.maxTradeSize;
    if (highVolatility) {
      // Decrease trade size in volatile markets
      maxTradeSize = Math.min(currentConfig.maxTradeSize, 0.5);
    }
    
    // Determine gas strategy based on network congestion
    const congestion = analysisData.marketConditions.gas.congestion;
    let gasStrategy: 'standard' | 'fast' | 'aggressive';
    
    if (congestion === 'high') {
      gasStrategy = 'aggressive';
    } else if (congestion === 'medium') {
      gasStrategy = 'fast';
    } else {
      gasStrategy = 'standard';
    }
    
    // Determine risk tolerance based on market conditions
    let riskTolerance: 'low' | 'medium' | 'high' = currentConfig.riskTolerance;
    
    if (highVolatility) {
      riskTolerance = 'low';
    } else if (volatility < 3 && congestion === 'low') {
      riskTolerance = 'high';
    }
    
    // Determine recommended token pairs
    const recommendedTokenPairs = Object.entries(pairSuccessRates)
      .filter(([_, data]: [string, any]) => data.rate > 60 && data.total >= 3)
      .map(([pair, data]: [string, any]) => {
        const [tokenIn, tokenOut] = pair.split('/');
        return {
          tokenIn,
          tokenOut,
          confidence: data.rate / 100
        };
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
    
    // Determine recommended DEXes
    const recommendedDexes = Object.entries(dexSuccessRates)
      .filter(([_, data]: [string, any]) => data.rate > 50 && data.total >= 3)
      .map(([dex, data]: [string, any]) => ({
        dexName: dex,
        weight: data.rate / 100
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3);
    
    // Determine optimal trading hours
    const optimalTradingHours = Object.entries(hourlyPerformance)
      .map(([hour, data]: [string, any]) => ({
        hour: parseInt(hour),
        score: data.count > 0 ? (data.successCount / data.count) * (data.profit + 1) : 0
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    
    // Generate improvement suggestions
    const improvementSuggestions: string[] = [];
    
    // Suggest trade size adjustment
    if (highVolatility) {
      improvementSuggestions.push(
        "Reduce maximum trade size due to high market volatility"
      );
    }
    
    // Suggest gas strategy change
    if (congestion === 'high' && currentConfig.gasPrice !== 'aggressive') {
      improvementSuggestions.push(
        "Switch to aggressive gas strategy due to high network congestion"
      );
    }
    
    // Suggest slippage adjustment
    if (highVolatility && currentConfig.slippageTolerance < 1.0) {
      improvementSuggestions.push(
        "Increase slippage tolerance to handle volatile market conditions"
      );
    }
    
    // Create the recommendation
    return {
      id: `rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      confidence: 0.7,
      parameters: {
        minProfitPercentage,
        maxTradeSize,
        slippageTolerance,
        gasStrategy,
        riskTolerance
      },
      recommendedTokenPairs,
      recommendedDexes,
      optimalTradingHours,
      networkConditions: {
        gasPrice: `${analysisData.marketConditions.gas.averagePrice.toFixed(2)} Gwei`,
        congestion,
        recommendedAction: congestion === 'high' 
          ? 'Decrease trade frequency and increase gas price' 
          : 'Maintain normal operation'
      },
      summary: 'Strategy optimized based on historical performance and current market conditions',
      improvementSuggestions
    };
  }
}

// Export singleton instance
export const strategyOptimizer = new StrategyOptimizer();
