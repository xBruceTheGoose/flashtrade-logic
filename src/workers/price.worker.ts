import { ethers } from 'ethers';
import * as tf from '@tensorflow/tfjs-node';

interface PriceData {
  price: string; // BigNumber as string
  timestamp: number;
  source: string;
}

interface AnalysisResult {
  volatility: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
  movingAverages: {
    sma20: number;
    ema12: number;
    ema26: number;
  };
  signals: {
    macdSignal: boolean;
    rsiSignal: boolean;
    bollingerSignal: boolean;
  };
}

// Efficient circular buffer for calculations
class CircularBuffer {
  private buffer: number[];
  private head: number = 0;
  private filled: boolean = false;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity).fill(0);
  }

  push(value: number): void {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    if (this.head === 0) this.filled = true;
  }

  get values(): number[] {
    if (!this.filled) {
      return this.buffer.slice(0, this.head);
    }
    return [...this.buffer.slice(this.head), ...this.buffer.slice(0, this.head)];
  }
}

class PriceAnalyzer {
  private priceBuffer: CircularBuffer;
  private model: tf.LayersModel | null = null;

  constructor(private windowSize: number = 100) {
    this.priceBuffer = new CircularBuffer(windowSize);
  }

  async initialize(): Promise<void> {
    // Initialize TensorFlow model for price prediction
    this.model = tf.sequential({
      layers: [
        tf.layers.lstm({
          units: 50,
          inputShape: [this.windowSize, 1],
          returnSequences: false
        }),
        tf.layers.dense({ units: 1 })
      ]
    });

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });
  }

  analyzePrices(priceData: PriceData[]): AnalysisResult {
    const prices = priceData.map(d => parseFloat(ethers.utils.formatEther(d.price)));
    prices.forEach(p => this.priceBuffer.push(p));
    
    const currentPrices = this.priceBuffer.values;
    
    return {
      volatility: this.calculateVolatility(currentPrices),
      trend: this.detectTrend(currentPrices),
      confidence: this.calculateConfidence(currentPrices),
      movingAverages: this.calculateMovingAverages(currentPrices),
      signals: this.generateTradingSignals(currentPrices)
    };
  }

  private calculateVolatility(prices: number[]): number {
    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    return Math.sqrt(variance * 252); // Annualized volatility
  }

  private detectTrend(prices: number[]): 'up' | 'down' | 'stable' {
    const shortMA = this.calculateSMA(prices, 10);
    const longMA = this.calculateSMA(prices, 30);
    
    if (shortMA > longMA * 1.005) return 'up';
    if (shortMA < longMA * 0.995) return 'down';
    return 'stable';
  }

  private calculateConfidence(prices: number[]): number {
    const volatility = this.calculateVolatility(prices);
    const trend = this.calculateTrendStrength(prices);
    return Math.max(0, Math.min(1, 1 - volatility * 2 + trend));
  }

  private calculateMovingAverages(prices: number[]): {
    sma20: number;
    ema12: number;
    ema26: number;
  } {
    return {
      sma20: this.calculateSMA(prices, 20),
      ema12: this.calculateEMA(prices, 12),
      ema26: this.calculateEMA(prices, 26)
    };
  }

  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    const k = 2 / (period + 1);
    return prices.slice(-period).reduce((ema, price, i) => {
      return price * k + ema * (1 - k);
    }, prices[prices.length - period - 1]);
  }

  private calculateTrendStrength(prices: number[]): number {
    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
    const positive = returns.filter(r => r > 0).length;
    return positive / returns.length;
  }

  private generateTradingSignals(prices: number[]): {
    macdSignal: boolean;
    rsiSignal: boolean;
    bollingerSignal: boolean;
  } {
    return {
      macdSignal: this.calculateMACD(prices),
      rsiSignal: this.calculateRSI(prices) < 30,
      bollingerSignal: this.calculateBollingerBands(prices)
    };
  }

  private calculateMACD(prices: number[]): boolean {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    const signal = this.calculateEMA([...prices.slice(-9), macd], 9);
    return macd > signal;
  }

  private calculateRSI(prices: number[]): number {
    const period = 14;
    const changes = prices.slice(1).map((p, i) => p - prices[i]);
    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? -c : 0);
    
    const avgGain = this.calculateSMA(gains.slice(-period), period);
    const avgLoss = this.calculateSMA(losses.slice(-period), period);
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateBollingerBands(prices: number[]): boolean {
    const period = 20;
    const stdDev = 2;
    
    const sma = this.calculateSMA(prices, period);
    const variance = prices.slice(-period).reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
    const sd = Math.sqrt(variance);
    
    const currentPrice = prices[prices.length - 1];
    const lowerBand = sma - (stdDev * sd);
    
    return currentPrice < lowerBand;
  }
}

const analyzer = new PriceAnalyzer();
analyzer.initialize();

self.onmessage = async (event) => {
  const { type, pair, history } = event.data;
  
  if (type === 'analyze') {
    const analysis = analyzer.analyzePrices(history);
    self.postMessage({ pair, analysis });
  }
};
