
import { Token, DEX } from '@/types';
import { toast } from '@/hooks/use-toast';

// Map of DEX ID to WebSocket connection
type WebSocketConnections = Map<string, WebSocket>;

class WebSocketManager {
  private connections: WebSocketConnections = new Map();
  private reconnectTimeouts: Map<string, number> = new Map();
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map();
  private maxReconnectDelay: number = 30000; // 30 seconds

  // Map DEX IDs to their WebSocket URLs
  private getWebSocketUrl(dexId: string, chainId: number): string | null {
    // These would be real WebSocket endpoints in production
    const wsEndpoints: Record<string, Record<number, string>> = {
      'uniswap_v2': {
        1: 'wss://api.uniswap.org/v1/ws',
        // Add other networks as needed
      },
      'sushiswap': {
        1: 'wss://api.sushiswap.com/ws',
        // Add other networks as needed
      },
      // Add other DEXes as needed
    };

    return wsEndpoints[dexId]?.[chainId] || null;
  }

  /**
   * Connect to a DEX WebSocket API
   */
  connect(dex: DEX, chainId: number): boolean {
    const dexId = dex.id;
    
    // If already connected, return true
    if (this.connections.has(dexId) && this.connections.get(dexId)?.readyState === WebSocket.OPEN) {
      return true;
    }
    
    // Get WebSocket URL
    const wsUrl = this.getWebSocketUrl(dexId, chainId);
    if (!wsUrl) {
      console.warn(`No WebSocket URL available for ${dex.name} on chain ${chainId}`);
      return false;
    }
    
    try {
      // Create WebSocket connection
      const ws = new WebSocket(wsUrl);
      
      // Set up event handlers
      ws.onopen = () => {
        console.log(`WebSocket connection established for ${dex.name}`);
        this.resetReconnectTimeout(dexId);
      };
      
      ws.onclose = () => {
        console.log(`WebSocket connection closed for ${dex.name}`);
        this.connections.delete(dexId);
        this.scheduleReconnect(dex, chainId);
      };
      
      ws.onerror = (error) => {
        console.error(`WebSocket error for ${dex.name}:`, error);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(dexId, data);
        } catch (error) {
          console.error(`Error parsing WebSocket message from ${dex.name}:`, error);
        }
      };
      
      // Store the connection
      this.connections.set(dexId, ws);
      return true;
    } catch (error) {
      console.error(`Error connecting to ${dex.name} WebSocket:`, error);
      return false;
    }
  }

  /**
   * Disconnect from a DEX WebSocket API
   */
  disconnect(dexId: string): void {
    const ws = this.connections.get(dexId);
    if (ws) {
      ws.close();
      this.connections.delete(dexId);
    }
    
    // Clear reconnect timeout
    const timeoutId = this.reconnectTimeouts.get(dexId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      this.reconnectTimeouts.delete(dexId);
    }
  }

  /**
   * Disconnect from all WebSocket connections
   */
  disconnectAll(): void {
    for (const dexId of this.connections.keys()) {
      this.disconnect(dexId);
    }
  }

  /**
   * Subscribe to price updates for a token pair
   */
  subscribeToPair(dexId: string, tokenA: Token, tokenB: Token): boolean {
    const ws = this.connections.get(dexId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(`Cannot subscribe: WebSocket not connected for ${dexId}`);
      return false;
    }
    
    try {
      // Subscription message format would vary by DEX
      const subscriptionMessage = JSON.stringify({
        type: 'subscribe',
        channel: 'price',
        pair: `${tokenA.address}-${tokenB.address}`,
      });
      
      ws.send(subscriptionMessage);
      return true;
    } catch (error) {
      console.error(`Error subscribing to ${tokenA.symbol}/${tokenB.symbol} on ${dexId}:`, error);
      return false;
    }
  }

  /**
   * Add a message handler for a specific DEX
   */
  addMessageHandler(dexId: string, handler: (data: any) => void): void {
    if (!this.messageHandlers.has(dexId)) {
      this.messageHandlers.set(dexId, new Set());
    }
    
    this.messageHandlers.get(dexId)!.add(handler);
  }

  /**
   * Remove a message handler
   */
  removeMessageHandler(dexId: string, handler: (data: any) => void): void {
    const handlers = this.messageHandlers.get(dexId);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(dexId: string, data: any): void {
    const handlers = this.messageHandlers.get(dexId);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in WebSocket message handler for ${dexId}:`, error);
        }
      });
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(dex: DEX, chainId: number): void {
    const dexId = dex.id;
    
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
      console.log(`Attempting to reconnect to ${dex.name} WebSocket...`);
      this.connect(dex, chainId);
    }, delay);
    
    this.reconnectTimeouts.set(dexId, timeoutId);
  }

  /**
   * Reset reconnect timeout for a DEX
   */
  private resetReconnectTimeout(dexId: string): void {
    const timeoutId = this.reconnectTimeouts.get(dexId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      this.reconnectTimeouts.delete(dexId);
    }
  }

  /**
   * Get connection status for a DEX
   */
  getConnectionStatus(dexId: string): 'connected' | 'connecting' | 'disconnected' {
    const ws = this.connections.get(dexId);
    if (!ws) {
      return 'disconnected';
    }
    
    switch (ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      default:
        return 'disconnected';
    }
  }
}

// Export singleton instance
export const webSocketManager = new WebSocketManager();
