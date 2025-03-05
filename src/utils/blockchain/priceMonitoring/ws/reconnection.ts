
import { DEX } from '@/types';

/**
 * WebSocket reconnection service
 * Manages reconnection attempts with exponential backoff
 */
export class WebSocketReconnectionService {
  private reconnectTimeouts: Map<string, number> = new Map();
  private maxReconnectDelay: number = 30000; // 30 seconds
  private onReconnect: (dexId: string) => void = () => {};

  /**
   * Set callback for reconnection attempts
   */
  setReconnectCallback(callback: (dexId: string) => void): void {
    this.onReconnect = callback;
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  scheduleReconnect(dexId: string): void {
    // Clear any existing reconnect timeout
    this.resetReconnectTimeout(dexId);
    
    // Calculate reconnect delay with exponential backoff
    const reconnectAttempts = this.reconnectTimeouts.size;
    const delay = Math.min(
      1000 * Math.pow(2, reconnectAttempts), 
      this.maxReconnectDelay
    );
    
    // Schedule reconnect
    const timeoutId = window.setTimeout(() => {
      console.log(`Attempting to reconnect to ${dexId} WebSocket...`);
      this.onReconnect(dexId);
    }, delay);
    
    this.reconnectTimeouts.set(dexId, timeoutId);
  }

  /**
   * Reset reconnect timeout for a DEX
   */
  resetReconnectTimeout(dexId: string): void {
    const timeoutId = this.reconnectTimeouts.get(dexId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      this.reconnectTimeouts.delete(dexId);
    }
  }

  /**
   * Reset all reconnect timeouts
   */
  resetAllTimeouts(): void {
    for (const dexId of this.reconnectTimeouts.keys()) {
      this.resetReconnectTimeout(dexId);
    }
  }
}

// Export singleton instance
export const webSocketReconnection = new WebSocketReconnectionService();
