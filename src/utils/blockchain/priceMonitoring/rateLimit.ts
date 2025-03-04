// Rate limiting implementation
export class RateLimiter {
  private requestTimes: number[] = [];
  private maxRequests: number;
  private timeWindowMs: number;
  private name: string;

  constructor(name: string, maxRequests: number, timeWindowMs: number = 60000) {
    this.name = name;
    this.maxRequests = maxRequests;
    this.timeWindowMs = timeWindowMs;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    
    // Remove expired timestamps
    this.requestTimes = this.requestTimes.filter(
      time => now - time < this.timeWindowMs
    );
    
    // Check if we're under the limit
    return this.requestTimes.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requestTimes.push(Date.now());
  }

  /**
   * Make a rate-limited request. Returns a promise that resolves when
   * the request can be made, or rejects if the timeout is exceeded.
   */
  async waitForAvailability(timeoutMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    
    // If we can make a request immediately, do so
    if (this.canMakeRequest()) {
      this.recordRequest();
      return true;
    }
    
    console.log(`Rate limited: ${this.name} - waiting for availability`);
    
    // Otherwise, wait until we can make a request or timeout
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const now = Date.now();
        
        // If timeout exceeded, reject
        if (now - startTime > timeoutMs) {
          clearInterval(checkInterval);
          reject(new Error(`Rate limit timeout exceeded for ${this.name}`));
          return;
        }
        
        // Check if we can make a request now
        if (this.canMakeRequest()) {
          clearInterval(checkInterval);
          this.recordRequest();
          resolve(true);
          return;
        }
      }, 100);
    });
  }

  getRequestsRemaining(): number {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter(
      time => now - time < this.timeWindowMs
    );
    return this.maxRequests - this.requestTimes.length;
  }
  
  /**
   * Returns time in ms until the next request slot is available
   */
  getTimeUntilNextAvailable(): number {
    if (this.canMakeRequest()) {
      return 0;
    }
    
    const now = Date.now();
    // Sort times in ascending order
    const sortedTimes = [...this.requestTimes].sort((a, b) => a - b);
    // Find the oldest request that will expire
    const oldestTime = sortedTimes[0];
    
    return Math.max(0, (oldestTime + this.timeWindowMs) - now);
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requestTimes = [];
  }
}

// Create a RateLimiter registry to manage multiple rate limiters
export class RateLimiterRegistry {
  private limiters: Map<string, RateLimiter> = new Map();
  
  register(name: string, maxRequests: number, timeWindowMs: number = 60000): RateLimiter {
    const limiter = new RateLimiter(name, maxRequests, timeWindowMs);
    this.limiters.set(name, limiter);
    return limiter;
  }
  
  get(name: string): RateLimiter | undefined {
    return this.limiters.get(name);
  }
  
  getOrCreate(name: string, maxRequests: number, timeWindowMs: number = 60000): RateLimiter {
    let limiter = this.limiters.get(name);
    if (!limiter) {
      limiter = this.register(name, maxRequests, timeWindowMs);
    }
    return limiter;
  }
  
  resetAll(): void {
    this.limiters.forEach(limiter => limiter.reset());
  }
}

// Create singleton instance
export const rateLimiters = new RateLimiterRegistry();
