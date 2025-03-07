
// Price calculation web worker

// Define the incoming message types
type WorkerMessageType = 
  | 'calculate_arbitrage'
  | 'calculate_volatility' 
  | 'process_price_data';

interface WorkerMessage {
  id: string;
  type: WorkerMessageType;
  data: any;
}

interface WorkerResponse {
  id: string;
  type: WorkerMessageType;
  result: any;
  error?: string;
}

// Listen for messages from the main thread
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const { id, type, data } = event.data;
  
  try {
    let result;
    
    switch (type) {
      case 'calculate_arbitrage':
        result = calculateArbitrageOpportunities(data);
        break;
      case 'calculate_volatility':
        result = calculateVolatility(data);
        break;
      case 'process_price_data':
        result = processPriceData(data);
        break;
      default:
        throw new Error(`Unknown worker message type: ${type}`);
    }
    
    // Send the result back to the main thread
    const response: WorkerResponse = {
      id,
      type,
      result
    };
    
    self.postMessage(response);
  } catch (error) {
    // Send error back to main thread
    const response: WorkerResponse = {
      id,
      type,
      result: null,
      error: error instanceof Error ? error.message : String(error)
    };
    
    self.postMessage(response);
  }
});

// Calculate arbitrage opportunities across DEXes
function calculateArbitrageOpportunities(data: {
  prices: Record<string, Record<string, number>>;
  tokens: any[];
  minProfitPercentage: number;
  gasPrice: number;
}) {
  const { prices, tokens, minProfitPercentage, gasPrice } = data;
  const opportunities = [];
  
  // Get all token pairs
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const tokenA = tokens[i];
      const tokenB = tokens[j];
      
      const dexes = Object.keys(prices);
      
      // Compare prices across DEXes
      for (let dex1Index = 0; dex1Index < dexes.length; dex1Index++) {
        for (let dex2Index = dex1Index + 1; dex2Index < dexes.length; dex2Index++) {
          const dex1 = dexes[dex1Index];
          const dex2 = dexes[dex2Index];
          
          const dex1Prices = prices[dex1];
          const dex2Prices = prices[dex2];
          
          // Skip if either DEX doesn't have both tokens
          if (!dex1Prices[tokenA.address] || !dex1Prices[tokenB.address] ||
              !dex2Prices[tokenA.address] || !dex2Prices[tokenB.address]) {
            continue;
          }
          
          // Calculate price ratio at DEX 1
          const priceRatioDex1 = dex1Prices[tokenA.address] / dex1Prices[tokenB.address];
          
          // Calculate price ratio at DEX 2
          const priceRatioDex2 = dex2Prices[tokenA.address] / dex2Prices[tokenB.address];
          
          // Calculate profit percentage
          const profitPercentage = Math.abs(priceRatioDex1 - priceRatioDex2) / 
                                   Math.min(priceRatioDex1, priceRatioDex2) * 100;
          
          // Estimate gas cost
          const estimatedGasCost = gasPrice * 200000 / 1e9; // Assuming 200k gas units
          
          // Calculate trade size and profit
          const tradeSize = 1; // 1 ETH equivalent for calculation
          const estimatedProfit = (tradeSize * profitPercentage / 100) - estimatedGasCost;
          
          // Check if profit meets minimum threshold
          if (profitPercentage >= minProfitPercentage && estimatedProfit > 0) {
            opportunities.push({
              tokenA,
              tokenB,
              sourceDex: priceRatioDex1 < priceRatioDex2 ? dex1 : dex2,
              targetDex: priceRatioDex1 < priceRatioDex2 ? dex2 : dex1,
              profitPercentage,
              estimatedProfit,
              priceA: priceRatioDex1 < priceRatioDex2 ? 
                     dex1Prices[tokenA.address] : dex2Prices[tokenA.address],
              priceB: priceRatioDex1 < priceRatioDex2 ? 
                     dex1Prices[tokenB.address] : dex2Prices[tokenB.address],
              timestamp: Date.now()
            });
          }
        }
      }
    }
  }
  
  // Sort by profit percentage descending
  return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
}

// Calculate volatility for a token
function calculateVolatility(data: {
  priceHistory: number[];
  timeIntervals: number[];
}) {
  const { priceHistory, timeIntervals } = data;
  
  if (priceHistory.length < 2) {
    return 0;
  }
  
  // Calculate returns
  const returns = [];
  for (let i = 1; i < priceHistory.length; i++) {
    const timeDiff = (timeIntervals[i] - timeIntervals[i-1]) / (60 * 1000); // minutes
    const logReturn = Math.log(priceHistory[i] / priceHistory[i-1]);
    // Annualized return
    returns.push(logReturn / Math.sqrt(timeDiff) * Math.sqrt(525600)); // 525600 = minutes in a year
  }
  
  // Calculate standard deviation
  const mean = returns.reduce((sum, val) => sum + val, 0) / returns.length;
  const variance = returns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * 100; // Convert to percentage
  
  return volatility;
}

// Process price data for visualization
function processPriceData(data: {
  priceHistory: any[];
  interval: 'minute' | 'hour' | 'day';
}) {
  const { priceHistory, interval } = data;
  
  if (!priceHistory || priceHistory.length === 0) {
    return [];
  }
  
  // Sort by timestamp
  const sortedData = [...priceHistory].sort((a, b) => a.timestamp - b.timestamp);
  
  // Group by interval
  const groupedData = new Map();
  
  let intervalMs;
  switch (interval) {
    case 'minute':
      intervalMs = 60 * 1000;
      break;
    case 'hour':
      intervalMs = 60 * 60 * 1000;
      break;
    case 'day':
      intervalMs = 24 * 60 * 60 * 1000;
      break;
  }
  
  for (const point of sortedData) {
    const intervalStart = Math.floor(point.timestamp / intervalMs) * intervalMs;
    
    if (!groupedData.has(intervalStart)) {
      groupedData.set(intervalStart, {
        open: point.price,
        high: point.price,
        low: point.price,
        close: point.price,
        volume: 0,
        timestamp: intervalStart
      });
    } else {
      const candle = groupedData.get(intervalStart);
      candle.high = Math.max(candle.high, point.price);
      candle.low = Math.min(candle.low, point.price);
      candle.close = point.price;
      // If volume is available
      if (point.volume) {
        candle.volume += point.volume;
      }
    }
  }
  
  return Array.from(groupedData.values());
}
