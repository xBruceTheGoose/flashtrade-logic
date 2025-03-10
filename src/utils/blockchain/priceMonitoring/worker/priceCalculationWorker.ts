
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

// Cache for expensive calculations
const calculationCache = new Map<string, {
  result: any;
  timestamp: number;
}>();

// Max cache size and age
const MAX_CACHE_SIZE = 100;
const MAX_CACHE_AGE_MS = 60000; // 1 minute

// Helper to get from cache
function getFromCache<T>(cacheKey: string): T | null {
  const cached = calculationCache.get(cacheKey);
  if (!cached) return null;
  
  // Check if cache entry is still valid
  if (Date.now() - cached.timestamp > MAX_CACHE_AGE_MS) {
    calculationCache.delete(cacheKey);
    return null;
  }
  
  return cached.result as T;
}

// Helper to add to cache
function addToCache(cacheKey: string, result: any): void {
  // Enforce size limit
  if (calculationCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of calculationCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      calculationCache.delete(oldestKey);
    }
  }
  
  calculationCache.set(cacheKey, {
    result,
    timestamp: Date.now()
  });
}

// Listen for messages from the main thread
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const { id, type, data } = event.data;
  
  try {
    let result;
    // Generate cache key based on operation type and stringified data
    const cacheKey = `${type}:${JSON.stringify(data)}`;
    
    // Check cache first
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
      result = cachedResult;
    } else {
      // Perform calculation if not cached
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
      
      // Cache the result
      addToCache(cacheKey, result);
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
export function calculateArbitrageOpportunities(data: {
  prices: Record<string, Record<string, number>>;
  tokens: any[];
  minProfitPercentage: number;
  gasPrice: number;
}) {
  const { prices, tokens, minProfitPercentage, gasPrice } = data;
  const opportunities = [];
  
  // Get unique DEXes
  const dexes = Object.keys(prices);
  
  // Precompute price ratios for all token pairs to avoid redundant calculations
  const priceRatios: Record<string, Record<string, Record<string, number>>> = {};
  
  for (const dex of dexes) {
    priceRatios[dex] = {};
    const dexPrices = prices[dex];
    
    for (let i = 0; i < tokens.length; i++) {
      const tokenA = tokens[i];
      priceRatios[dex][tokenA.address] = {};
      
      for (let j = 0; j < tokens.length; j++) {
        if (i === j) continue;
        
        const tokenB = tokens[j];
        
        // Skip if either token doesn't have price data
        if (!dexPrices[tokenA.address] || !dexPrices[tokenB.address]) {
          continue;
        }
        
        // Calculate price ratio
        priceRatios[dex][tokenA.address][tokenB.address] = 
          dexPrices[tokenA.address] / dexPrices[tokenB.address];
      }
    }
  }
  
  // Find arbitrage opportunities
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const tokenA = tokens[i];
      const tokenB = tokens[j];
      
      // Compare prices across DEXes
      for (let dex1Index = 0; dex1Index < dexes.length; dex1Index++) {
        for (let dex2Index = dex1Index + 1; dex2Index < dexes.length; dex2Index++) {
          const dex1 = dexes[dex1Index];
          const dex2 = dexes[dex2Index];
          
          // Skip if price ratio isn't available for either DEX
          if (!priceRatios[dex1][tokenA.address]?.[tokenB.address] || 
              !priceRatios[dex2][tokenA.address]?.[tokenB.address]) {
            continue;
          }
          
          // Get price ratios
          const priceRatioDex1 = priceRatios[dex1][tokenA.address][tokenB.address];
          const priceRatioDex2 = priceRatios[dex2][tokenA.address][tokenB.address];
          
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
                     prices[dex1][tokenA.address] : prices[dex2][tokenA.address],
              priceB: priceRatioDex1 < priceRatioDex2 ? 
                     prices[dex1][tokenB.address] : prices[dex2][tokenB.address],
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
export function calculateVolatility(data: {
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
  
  // Calculate standard deviation using an optimized one-pass algorithm
  let sum = 0;
  let sumSq = 0;
  
  for (const ret of returns) {
    sum += ret;
    sumSq += ret * ret;
  }
  
  const mean = sum / returns.length;
  const variance = (sumSq / returns.length) - (mean * mean);
  const volatility = Math.sqrt(variance) * 100; // Convert to percentage
  
  return volatility;
}

// Process price data for visualization
export function processPriceData(data: {
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
        volume: point.volume || 0,
        timestamp: intervalStart,
        count: 1
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
      candle.count += 1;
    }
  }
  
  // Convert the Map to an array and sort by timestamp
  return Array.from(groupedData.values())
    .sort((a, b) => a.timestamp - b.timestamp);
}
