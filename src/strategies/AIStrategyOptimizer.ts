import { ethers } from 'ethers';
import * as tf from '@tensorflow/tfjs-node';
import { createObjectCsvWriter } from 'csv-writer';
import { trackMetric } from '../config/monitoring';
import { UserPreferences, NetworkState, TradeHistory, MarketConditions } from '../types/strategy';

export class AIStrategyOptimizer {
  private model: tf.LayersModel;
  private historicalData: TradeHistory[];
  private readonly modelPath = './models/strategy-optimizer';
  
  constructor(
    private readonly userPreferences: UserPreferences,
    private readonly minProfitThreshold: ethers.BigNumber
  ) {}

  async initialize(): Promise<void> {
    try {
      this.model = await this.loadOrCreateModel();
      trackMetric('ai_strategy_initialization', 1);
    } catch (error) {
      trackMetric('ai_strategy_initialization_error', 1);
      throw error;
    }
  }

  private async loadOrCreateModel(): Promise<tf.LayersModel> {
    try {
      return await tf.loadLayersModel(`file://${this.modelPath}/model.json`);
    } catch {
      // Create new model if none exists
      const model = tf.sequential();
      
      // Input features: market conditions, network state, historical performance
      model.add(tf.layers.dense({
        inputShape: [15],
        units: 64,
        activation: 'relu'
      }));
      
      model.add(tf.layers.dropout({ rate: 0.2 }));
      
      model.add(tf.layers.dense({
        units: 32,
        activation: 'relu'
      }));
      
      model.add(tf.layers.dense({
        units: 4, // [optimal timing, size, gas price, expected slippage]
        activation: 'sigmoid'
      }));

      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['accuracy']
      });

      return model;
    }
  }

  async predictOptimalParameters(
    marketConditions: MarketConditions,
    networkState: NetworkState
  ): Promise<{
    timing: number;
    size: ethers.BigNumber;
    gasPrice: ethers.BigNumber;
    expectedSlippage: number;
  }> {
    const input = this.preprocessInput(marketConditions, networkState);
    
    const prediction = this.model.predict(input) as tf.Tensor;
    const [timing, size, gasPrice, slippage] = await prediction.array() as number[][];
    
    return {
      timing: timing[0],
      size: ethers.utils.parseEther(size[0].toString()),
      gasPrice: ethers.utils.parseUnits(gasPrice[0].toString(), 'gwei'),
      expectedSlippage: slippage[0]
    };
  }

  private preprocessInput(
    marketConditions: MarketConditions,
    networkState: NetworkState
  ): tf.Tensor {
    // Normalize and combine input features
    return tf.tensor2d([
      [
        marketConditions.volatility,
        marketConditions.volume24h,
        marketConditions.priceChange24h,
        marketConditions.liquidityDepth,
        networkState.averageGasPrice,
        networkState.blockTime,
        networkState.congestionLevel,
        ...this.getHistoricalFeatures()
      ]
    ]);
  }

  private getHistoricalFeatures(): number[] {
    // Extract relevant features from historical data
    const recentTrades = this.historicalData.slice(-100);
    
    return [
      this.calculateSuccessRate(recentTrades),
      this.calculateAverageProfit(recentTrades),
      this.calculateVolatilityScore(recentTrades),
      this.calculateLiquidityScore(recentTrades),
      this.calculateGasEfficiencyScore(recentTrades)
    ];
  }

  async updateModel(tradeResult: TradeHistory): Promise<void> {
    this.historicalData.push(tradeResult);
    
    // Retrain model with new data
    if (this.historicalData.length >= 1000) {
      const trainingData = this.prepareTrainingData();
      await this.trainModel(trainingData);
      await this.saveModel();
    }
  }

  private async trainModel(trainingData: {
    features: tf.Tensor,
    labels: tf.Tensor
  }): Promise<void> {
    await this.model.fit(trainingData.features, trainingData.labels, {
      epochs: 10,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          trackMetric('model_training_loss', logs?.loss || 0);
        }
      }
    });
  }

  async generatePerformanceReport(): Promise<string> {
    const report = {
      timestamp: new Date().toISOString(),
      overallMetrics: this.calculateOverallMetrics(),
      recentPerformance: this.analyzeRecentPerformance(),
      recommendations: this.generateRecommendations(),
      riskMetrics: this.calculateRiskMetrics()
    };

    // Save report to CSV
    const csvWriter = createObjectCsvWriter({
      path: './reports/performance.csv',
      header: [
        { id: 'timestamp', title: 'TIMESTAMP' },
        { id: 'metric', title: 'METRIC' },
        { id: 'value', title: 'VALUE' }
      ]
    });

    await csvWriter.writeRecords(this.formatReportForCsv(report));
    return JSON.stringify(report, null, 2);
  }

  private calculateRiskMetrics() {
    return {
      sharpeRatio: this.calculateSharpeRatio(),
      maxDrawdown: this.calculateMaxDrawdown(),
      volatility: this.calculateVolatility(),
      successRate: this.calculateSuccessRate(this.historicalData)
    };
  }

  private generateRecommendations() {
    const metrics = this.calculateOverallMetrics();
    const recommendations = [];

    if (metrics.averageSlippage > 0.5) {
      recommendations.push('Consider increasing minimum liquidity threshold');
    }

    if (metrics.gasEfficiency < 0.8) {
      recommendations.push('Optimize gas usage by batching similar trades');
    }

    if (metrics.successRate < 0.9) {
      recommendations.push('Increase profit threshold or adjust risk parameters');
    }

    return recommendations;
  }
}
