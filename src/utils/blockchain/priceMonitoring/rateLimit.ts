// Rate limiting implementation
export class RateLimiter {
  private requestTimes: number[] = [];
  private maxRequests: number;
  private timeWindowMs: number;

  constructor(maxRequests: number, timeWindowMs: number = 60000) {
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
    
    // Otherwise, wait until we can make a request or timeout
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const now = Date.now();
        
        // If timeout exceeded, reject
        if (now - startTime > timeoutMs) {
          clearInterval(checkInterval);
          reject(new Error('Rate limit timeout exceeded'));
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
}
