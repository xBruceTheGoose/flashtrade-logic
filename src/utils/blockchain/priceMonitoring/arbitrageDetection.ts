import { Token, DEX, ArbitrageOpportunity } from '@/types';
import { dexManager } from '@/utils/dex/DEXManager';
import { priceHistoryStorage } from './storage';
import { flashloanService } from '@/utils/flashloan';
import { blockchain } from '@/utils/blockchain';
import { estimateGasCost } from '@/utils/arbitrage';
import { tradeExecutor } from '@/utils/arbitrage/tradeExecutor';
import { v4 as uuidv4 } from 'uuid';

// Risk levels for arbitrage opportunities
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

// Metrics for arbitrage opportunities
export interface ArbitrageMetrics {
  expectedProfit: number;      // Expected profit in USD
  profitPercentage: number;    // Profit as percentage of trade size
  gasCost: number;             // Estimated gas cost in USD
  flashloanFee: number;        // Flashloan fee in USD
  slippageImpact: number;      // Estimated slippage impact in USD
  netProfit: number;           // Net profit after all costs
  riskLevel: RiskLevel;        // Assessed risk level
  confidenceScore: number;     // Confidence score (0-100)
  timeToExecute: number;       // Estimated time to execute in ms
}

// Structure for arbitrage paths
export interface ArbitragePath {
  path: Token[];               // Path of tokens to trade through
  dexSequence: DEX[];         // Sequence of DEXes to use
  metrics: ArbitrageMetrics;   // Metrics for this path
}

// Configuration for arbitrage detection
export interface ArbitrageDetectionConfig {
  minProfitUSD: number;        // Minimum profit in USD to consider
  minProfitPercentage: number; // Minimum profit percentage to consider
  maxPathLength: number;       // Maximum length of trade paths to consider
  maxSlippagePercentage: number; // Maximum acceptable slippage
  considerFlashloan: boolean;  // Whether to consider flashloan costs
  gasMultiplier: number;       // Multiplier for gas estimation (buffer)
  riskAssessmentEnabled: boolean; // Whether to perform risk assessment
}

/**
 * Arbitrage Detection Engine
 * Identifies and analyzes arbitrage opportunities across DEXes
 */
export class ArbitrageDetectionEngine {
  private config: ArbitrageDetectionConfig = {
    minProfitUSD: 5,            // $5 minimum profit
    minProfitPercentage: 0.5,    // 0.5% minimum profit percentage
    maxPathLength: 3,            // Max 3 hops in a path
    maxSlippagePercentage: 1,    // 1% maximum slippage
    considerFlashloan: true,     // Consider flashloan costs
    gasMultiplier: 1.2,          // 20% buffer on gas estimates
    riskAssessmentEnabled: true, // Enable risk assessment
  };

  /**
   * Update the configuration
   */
  updateConfig(config: Partial<ArbitrageDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the current configuration
   */
  getConfig(): ArbitrageDetectionConfig {
    return { ...this.config };
  }

  /**
   * Detect arbitrage opportunities between two specific DEXes for a token pair
   */
  async detectDirectArbitrage(
    tokenA: Token,
    tokenB: Token,
    sourceDex: DEX,
    targetDex: DEX
  ): Promise<ArbitrageOpportunity | null> {
    try {
      // Get price from source DEX
      const sourceAdapter = dexManager.getAdapter(sourceDex.id);
      const targetAdapter = dexManager.getAdapter(targetDex.id);
      
      if (!sourceAdapter || !targetAdapter) {
        return null;
      }
      
      // Get latest prices
      const priceA = await sourceAdapter.getTokenPrice(tokenA, tokenB);
      const priceB = await targetAdapter.getTokenPrice(tokenA, tokenB);
      
      // Check if there's a price difference
      const priceDiff = ((priceB - priceA) / priceA) * 100;
      const absPriceDiff = Math.abs(priceDiff);
      
      // If price difference is below threshold, no opportunity
      if (absPriceDiff < this.config.minProfitPercentage) {
        return null;
      }
      
      // Determine the direction of the trade
      const [buyDex, sellDex] = priceDiff > 0 ? [sourceDex, targetDex] : [targetDex, sourceDex];
      
      // Calculate optimal trade size based on liquidity
      const tradeSize = await this.calculateOptimalTradeSize(tokenA, tokenB, buyDex, sellDex);
      
      // If we couldn't determine a valid trade size, exit
      if (!tradeSize) {
        return null;
      }
      
      // Calculate expected profit (simplified)
      const profitPercentage = absPriceDiff;
      const expectedProfitUSD = (tokenA.price || 0) * parseFloat(tradeSize) * (profitPercentage / 100);
      
      // If expected profit is below threshold, no opportunity
      if (expectedProfitUSD < this.config.minProfitUSD) {
        return null;
      }
      
      // Calculate metrics including gas, fees, slippage
      const metrics = await this.calculateArbitrageMetrics(
        tokenA,
        tokenB,
        tradeSize,
        profitPercentage,
        [buyDex, sellDex],
        [tokenA, tokenB]
      );
      
      // If not profitable after all costs, no opportunity
      if (metrics.netProfit <= 0) {
        return null;
      }
      
      // Create opportunity
      return {
        id: uuidv4(),
        sourceDex: buyDex,
        targetDex: sellDex,
        tokenIn: tokenA,
        tokenOut: tokenB,
        profitPercentage: metrics.profitPercentage,
        estimatedProfit: `${metrics.netProfit.toFixed(2)} USD`,
        gasEstimate: `${metrics.gasCost.toFixed(4)} ETH`,
        tradeSize,
        timestamp: Date.now(),
        status: 'pending',
        path: [tokenA.address, tokenB.address],
        riskLevel: metrics.riskLevel,
        confidenceScore: metrics.confidenceScore
      };
    } catch (error) {
      console.error('Error detecting direct arbitrage:', error);
      return null;
    }
  }

  /**
   * Calculate optimal trade size based on available liquidity
   */
  private async calculateOptimalTradeSize(
    tokenA: Token,
    tokenB: Token,
    buyDex: DEX,
    sellDex: DEX
  ): Promise<string | null> {
    try {
      // Get adapters
      const buyAdapter = dexManager.getAdapter(buyDex.id);
      const sellAdapter = dexManager.getAdapter(sellDex.id);
      
      if (!buyAdapter || !sellAdapter) {
        return null;
      }
      
      // Get liquidity information
      const buyLiquidity = await buyAdapter.getLiquidity(tokenA, tokenB);
      const sellLiquidity = await sellAdapter.getLiquidity(tokenA, tokenB);
      
      // Convert to token A equivalent
      const buyLiquidityInA = parseFloat(buyLiquidity.token0Reserves);
      const sellLiquidityInA = parseFloat(sellLiquidity.token0Reserves);
      
      // Take the minimum of both to ensure we can both buy and sell
      const maxLiquidity = Math.min(buyLiquidityInA, sellLiquidityInA);
      
      // Limit trade size to avoid excessive slippage
      // Start with 0.5% of available liquidity
      let optimalSize = maxLiquidity * 0.005;
      
      // Ensure minimum trade size (value of at least $50 to justify gas)
      const minTradeSize = 50 / (tokenA.price || 1);
      
      if (optimalSize < minTradeSize) {
        // If optimal size is too small, it's not worth trading
        if (maxLiquidity < minTradeSize * 2) {
          return null;
        }
        optimalSize = minTradeSize;
      }
      
      // Round to appropriate decimal places based on token decimals
      const decimalPlaces = Math.min(tokenA.decimals || 18, 8);
      return optimalSize.toFixed(decimalPlaces);
    } catch (error) {
      console.error('Error calculating optimal trade size:', error);
      return null;
    }
  }

  /**
   * Calculate comprehensive metrics for an arbitrage opportunity
   */
  private async calculateArbitrageMetrics(
    tokenA: Token,
    tokenB: Token,
    tradeSize: string,
    rawProfitPercentage: number,
    dexPath: DEX[],
    tokenPath: Token[]
  ): Promise<ArbitrageMetrics> {
    // Parse trade size
    const tradeSizeValue = parseFloat(tradeSize);
    const tradeSizeUSD = tradeSizeValue * (tokenA.price || 0);
    
    // Calculate expected profit before costs
    const expectedProfitPercentage = rawProfitPercentage;
    const expectedProfitUSD = tradeSizeUSD * (expectedProfitPercentage / 100);
    
    // Estimate gas cost
    const gasEstimateETH = await this.estimateGasCostInETH(tokenPath.length);
    const ethPriceUSD = 3000; // This should be fetched from a price oracle
    const gasCostUSD = gasEstimateETH * ethPriceUSD * this.config.gasMultiplier;
    
    // Calculate potential slippage based on trade size relative to liquidity
    // This is a simplified model - in reality this would be more complex
    let slippagePercentage = 0;
    let slippageUSD = 0;
    
    try {
      // For each hop in the path, calculate slippage
      for (let i = 0; i < dexPath.length - 1; i++) {
        const currentToken = tokenPath[i];
        const nextToken = tokenPath[i + 1];
        const dex = dexPath[i];
        
        const adapter = dexManager.getAdapter(dex.id);
        if (!adapter) continue;
        
        // Get expected output
        const output = await adapter.getExpectedOutput(
          currentToken, 
          nextToken, 
          i === 0 ? tradeSize : 'auto' // 'auto' means use the output from previous swap
        );
        
        slippagePercentage += output.priceImpact;
      }
      
      // Calculate slippage impact in USD
      slippageUSD = tradeSizeUSD * (slippagePercentage / 100);
    } catch (error) {
      console.warn('Error calculating slippage:', error);
      // Use a default slippage estimate
      slippagePercentage = tokenPath.length * 0.2; // 0.2% per hop
      slippageUSD = tradeSizeUSD * (slippagePercentage / 100);
    }
    
    // Calculate flashloan fee if applicable
    let flashloanFeeUSD = 0;
    
    if (this.config.considerFlashloan) {
      try {
        const profitabilityCheck = await flashloanService.calculateArbitrageProfitability(
          tokenA,
          tradeSize,
          expectedProfitUSD.toString()
        );
        
        // Convert fee to USD
        flashloanFeeUSD = parseFloat(profitabilityCheck.feeAmount) * (tokenA.price || 0);
      } catch (error) {
        console.warn('Error calculating flashloan fee:', error);
        // Use a default fee estimate (0.09% for Aave)
        flashloanFeeUSD = tradeSizeUSD * 0.0009;
      }
    }
    
    // Calculate net profit
    const netProfitUSD = expectedProfitUSD - gasCostUSD - flashloanFeeUSD - slippageUSD;
    const netProfitPercentage = (netProfitUSD / tradeSizeUSD) * 100;
    
    // Assess risk level
    let riskLevel = RiskLevel.MEDIUM;
    let confidenceScore = 50;
    
    if (this.config.riskAssessmentEnabled) {
      const riskAssessment = this.assessRisk(
        tokenA,
        tokenB,
        netProfitPercentage,
        slippagePercentage,
        dexPath,
        tokenPath
      );
      
      riskLevel = riskAssessment.riskLevel;
      confidenceScore = riskAssessment.confidenceScore;
    }
    
    // Estimate execution time (ms) - very rough estimate
    // More hops = more time
    const timeToExecute = 15000 + (tokenPath.length - 2) * 5000;
    
    return {
      expectedProfit: expectedProfitUSD,
      profitPercentage: netProfitPercentage,
      gasCost: gasCostUSD,
      flashloanFee: flashloanFeeUSD,
      slippageImpact: slippageUSD,
      netProfit: netProfitUSD,
      riskLevel,
      confidenceScore,
      timeToExecute
    };
  }

  /**
   * Estimate gas cost in ETH for an arbitrage transaction
   */
  private async estimateGasCostInETH(pathLength: number): Promise<number> {
    // Base gas cost for a simple swap
    const baseGasCost = 150000;
    
    // Additional gas for each hop
    const gasPerHop = 80000;
    
    // Additional gas for flashloan if used
    const flashloanGas = this.config.considerFlashloan ? 90000 : 0;
    
    // Calculate total gas units
    const totalGasUnits = baseGasCost + (pathLength - 1) * gasPerHop + flashloanGas;
    
    // Get current gas price from provider
    let gasPriceGwei = 50; // default fallback
    
    try {
      const provider = blockchain.getCurrentProvider();
      const gasPrice = await provider.getGasPrice();
      gasPriceGwei = parseFloat(gasPrice.toString()) / 1e9;
    } catch (error) {
      console.warn('Error getting gas price, using default:', error);
    }
    
    // Calculate gas cost in ETH
    // Gas cost = gas units * gas price (in Gwei) / 1e9
    return totalGasUnits * gasPriceGwei / 1e9;
  }

  /**
   * Assess the risk level of an arbitrage opportunity
   */
  private assessRisk(
    tokenA: Token,
    tokenB: Token,
    netProfitPercentage: number,
    slippagePercentage: number,
    dexPath: DEX[],
    tokenPath: Token[]
  ): { riskLevel: RiskLevel; confidenceScore: number } {
    // Initial risk score (higher = riskier)
    let riskScore = 50;
    
    // 1. Price volatility factor
    // Check price volatility for tokens in the past hour
    const volatilityA = priceHistoryStorage.getPriceVolatility(tokenA.address, 3600000);
    const volatilityB = priceHistoryStorage.getPriceVolatility(tokenB.address, 3600000);
    
    // Higher volatility = higher risk
    if (volatilityA > 5 || volatilityB > 5) {
      riskScore += 15;
    } else if (volatilityA > 2 || volatilityB > 2) {
      riskScore += 5;
    }
    
    // 2. Slippage risk
    // Higher slippage = higher risk
    if (slippagePercentage > 1) {
      riskScore += 20;
    } else if (slippagePercentage > 0.5) {
      riskScore += 10;
    }
    
    // 3. Path complexity
    // More hops = higher risk
    riskScore += (tokenPath.length - 2) * 10;
    
    // 4. Profit margin
    // Higher profit = lower risk
    if (netProfitPercentage > 2) {
      riskScore -= 15;
    } else if (netProfitPercentage > 1) {
      riskScore -= 5;
    }
    
    // 5. DEX reliability
    // (this is a simplified model, in reality would be more complex)
    // Check if any DEXes in the path are considered "riskier"
    const riskyDexes = ['pancakeswap', 'mdex']; // Example, in reality this would be data-driven
    for (const dex of dexPath) {
      if (riskyDexes.includes(dex.id)) {
        riskScore += 10;
        break;
      }
    }
    
    // 6. Token quality
    // Stablecoins and major tokens are considered less risky
    const stablecoins = ['USDT', 'USDC', 'DAI', 'BUSD'];
    const majorTokens = ['WETH', 'WBTC', 'BNB', 'MATIC'];
    
    let tokenQualityFactor = 0;
    
    for (const token of tokenPath) {
      if (stablecoins.includes(token.symbol)) {
        tokenQualityFactor -= 5;
      } else if (majorTokens.includes(token.symbol)) {
        tokenQualityFactor -= 3;
      } else {
        // Unknown tokens are riskier
        tokenQualityFactor += 5;
      }
    }
    
    riskScore += tokenQualityFactor;
    
    // Convert risk score to risk level
    let riskLevel = RiskLevel.MEDIUM;
    if (riskScore >= 70) {
      riskLevel = RiskLevel.HIGH;
    } else if (riskScore <= 30) {
      riskLevel = RiskLevel.LOW;
    }
    
    // Calculate confidence score (inverse of risk score)
    const confidenceScore = Math.max(0, Math.min(100, 100 - riskScore));
    
    return { riskLevel, confidenceScore };
  }

  /**
   * Detect multi-hop arbitrage opportunities
   */
  async detectMultiHopArbitrage(
    startToken: Token,
    intermediateTokens: Token[],
    dexes: DEX[]
  ): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    
    // Limit path length based on config
    const maxHops = Math.min(intermediateTokens.length, this.config.maxPathLength - 1);
    
    // Generate all possible DEX sequences up to maxHops
    const dexSequences = this.generateDexSequences(dexes, maxHops + 1);
    
    for (const dexSequence of dexSequences) {
      // For each possible token path
      for (let pathLength = 1; pathLength <= maxHops + 1; pathLength++) {
        const tokenPathPermutations = this.generateTokenPaths(startToken, intermediateTokens, pathLength);
        
        for (const tokenPath of tokenPathPermutations) {
          // We need enough DEXes for the token path
          if (dexSequence.length < tokenPath.length) continue;
          
          const dexPath = dexSequence.slice(0, tokenPath.length);
          
          // Calculate if this path is profitable
          const opportunity = await this.evaluateArbitragePath(tokenPath, dexPath);
          
          if (opportunity) {
            opportunities.push(opportunity);
          }
        }
      }
    }
    
    // Sort by net profit (descending)
    return opportunities.sort((a, b) => {
      const profitA = parseFloat(a.estimatedProfit.split(' ')[0]);
      const profitB = parseFloat(b.estimatedProfit.split(' ')[0]);
      return profitB - profitA;
    });
  }

  /**
   * Generate all possible DEX sequences of a given length
   */
  private generateDexSequences(dexes: DEX[], length: number): DEX[][] {
    if (length === 1) {
      return dexes.map(dex => [dex]);
    }
    
    const result: DEX[][] = [];
    const subSequences = this.generateDexSequences(dexes, length - 1);
    
    for (const dex of dexes) {
      for (const subSequence of subSequences) {
        result.push([dex, ...subSequence]);
      }
    }
    
    return result;
  }

  /**
   * Generate all possible token paths of a given length
   */
  private generateTokenPaths(startToken: Token, intermediateTokens: Token[], pathLength: number): Token[][] {
    if (pathLength === 1) {
      return [[startToken]];
    }
    
    const result: Token[][] = [];
    
    // Get all possible next tokens
    for (const nextToken of intermediateTokens) {
      // Skip if it's the same as start token
      if (nextToken.address === startToken.address) continue;
      
      if (pathLength === 2) {
        // Simple path: start -> next -> start
        result.push([startToken, nextToken, startToken]);
      } else {
        // For longer paths, recursively generate sub-paths
        const remainingTokens = intermediateTokens.filter(t => 
          t.address !== startToken.address && t.address !== nextToken.address
        );
        
        const subPaths = this.generateTokenPaths(nextToken, remainingTokens, pathLength - 1);
        
        for (const subPath of subPaths) {
          // Only consider paths that end with the start token
          if (subPath[subPath.length - 1].address === startToken.address) {
            result.push([startToken, ...subPath]);
          }
        }
      }
    }
    
    return result;
  }

  /**
   * Evaluate profitability of an arbitrage path
   */
  private async evaluateArbitragePath(
    tokenPath: Token[],
    dexPath: DEX[]
  ): Promise<ArbitrageOpportunity | null> {
    try {
      // Start with an initial amount of the first token
      const startToken = tokenPath[0];
      
      // Calculate optimal trade size
      const tradeSize = await this.calculateOptimalTradeSize(
        startToken,
        tokenPath[1],
        dexPath[0],
        dexPath[1]
      );
      
      if (!tradeSize) {
        return null;
      }
      
      // Simulate the trades along the path
      let currentAmount = parseFloat(tradeSize);
      let expectedOutput = currentAmount;
      
      for (let i = 0; i < tokenPath.length - 1; i++) {
        const fromToken = tokenPath[i];
        const toToken = tokenPath[i + 1];
        const dex = dexPath[i];
        
        const adapter = dexManager.getAdapter(dex.id);
        if (!adapter) {
          return null;
        }
        
        // Get expected output for this leg
        const output = await adapter.getExpectedOutput(
          fromToken,
          toToken,
          expectedOutput.toString()
        );
        
        // Update expected output for next leg
        expectedOutput = parseFloat(output.amountOut);
      }
      
      // Calculate profit
      const profitAbsolute = expectedOutput - currentAmount;
      const profitPercentage = (profitAbsolute / currentAmount) * 100;
      
      // If no profit, no opportunity
      if (profitPercentage <= 0) {
        return null;
      }
      
      // Calculate comprehensive metrics
      const metrics = await this.calculateArbitrageMetrics(
        startToken,
        tokenPath[tokenPath.length - 1],
        tradeSize,
        profitPercentage,
        dexPath,
        tokenPath
      );
      
      // If not profitable after costs, no opportunity
      if (metrics.netProfit <= 0) {
        return null;
      }
      
      // Create the opportunity
      return {
        id: uuidv4(),
        sourceDex: dexPath[0],
        targetDex: dexPath[dexPath.length - 1],
        tokenIn: startToken,
        tokenOut: tokenPath[tokenPath.length - 1],
        profitPercentage: metrics.profitPercentage,
        estimatedProfit: `${metrics.netProfit.toFixed(2)} USD`,
        gasEstimate: `${metrics.gasCost.toFixed(4)} ETH`,
        tradeSize,
        timestamp: Date.now(),
        status: 'pending',
        path: tokenPath.map(token => token.address),
        riskLevel: metrics.riskLevel,
        confidenceScore: metrics.confidenceScore,
        dexPath: dexPath.map(dex => dex.id)
      };
    } catch (error) {
      console.error('Error evaluating arbitrage path:', error);
      return null;
    }
  }

  /**
   * Scan for arbitrage opportunities across all active DEXes and tokens
   */
  async scanForOpportunities(
    tokens: Token[],
    dexes: DEX[]
  ): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    const activeDexes = dexes.filter(dex => dex.active);
    
    // Skip if not enough DEXes
    if (activeDexes.length < 2) {
      return [];
    }
    
    // 1. First detect simple direct arbitrage opportunities
    for (let i = 0; i < activeDexes.length; i++) {
      for (let j = i + 1; j < activeDexes.length; j++) {
        const dexA = activeDexes[i];
        const dexB = activeDexes[j];
        
        for (const tokenA of tokens) {
          for (const tokenB of tokens) {
            if (tokenA.address === tokenB.address) continue;
            
            const opportunity = await this.detectDirectArbitrage(
              tokenA,
              tokenB,
              dexA,
              dexB
            );
            
            if (opportunity) {
              opportunities.push(opportunity);
              
              // Try to auto-execute if enabled
              try {
                await tradeExecutor.autoExecuteTrade(opportunity);
              } catch (error) {
                console.error('Error auto-executing trade:', error);
              }
            }
          }
        }
      }
    }
    
    // 2. Detect multi-hop opportunities (if enabled and enough tokens available)
    if (this.config.maxPathLength > 2 && tokens.length >= 3) {
      // Major tokens are often good intermediate tokens
      const intermediateTokens = tokens.filter(token => 
        ['WETH', 'USDT', 'USDC', 'DAI', 'WBTC'].includes(token.symbol)
      );
      
      // If we have intermediate tokens, look for multi-hop opportunities
      if (intermediateTokens.length > 0) {
        for (const baseToken of tokens) {
          // Skip if base token is already an intermediate token
          if (intermediateTokens.some(t => t.address === baseToken.address)) {
            continue;
          }
          
          const multiHopOpportunities = await this.detectMultiHopArbitrage(
            baseToken,
            intermediateTokens,
            activeDexes
          );
          
          opportunities.push(...multiHopOpportunities);
        }
      }
    }
    
    // 3. Sort by profit and filter by minimum threshold
    return opportunities
      .sort((a, b) => {
        // Sort by profit percentage (descending)
        return b.profitPercentage - a.profitPercentage;
      })
      .filter(opp => {
        // Filter by minimum profit percentage
        return opp.profitPercentage >= this.config.minProfitPercentage;
      });
  }
}

// Export singleton instance
export const arbitrageDetectionEngine = new ArbitrageDetectionEngine();
