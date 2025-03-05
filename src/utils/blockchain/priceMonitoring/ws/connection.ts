
import { DEX } from '@/types';

/**
 * Core WebSocket connection manager 
 * Responsible for establishing and maintaining WebSocket connections
 */
export class WebSocketConnection {
  private connections: Map<string, WebSocket> = new Map();
  private webSocketUrls: Record<string, Record<number, string>> = {
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

  /**
   * Get WebSocket URL for a DEX on a specific chain
   */
  getWebSocketUrl(dexId: string, chainId: number): string | null {
    return this.webSocketUrls[dexId]?.[chainId] || null;
  }

  /**
   * Create a new WebSocket connection
   */
  createConnection(dexId: string, url: string, 
    onOpen: () => void,
    onClose: () => void, 
    onError: (error: Event) => void,
    onMessage: (data: any) => void
  ): WebSocket {
    try {
      const ws = new WebSocket(url);
      
      ws.onopen = onOpen;
      ws.onclose = onClose;
      ws.onerror = onError;
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error(`Error parsing WebSocket message:`, error);
        }
      };
      
      this.connections.set(dexId, ws);
      return ws;
    } catch (error) {
      console.error(`Error creating WebSocket connection:`, error);
      throw error;
    }
  }

  /**
   * Get an existing connection
   */
  getConnection(dexId: string): WebSocket | undefined {
    return this.connections.get(dexId);
  }

  /**
   * Close and remove a connection
   */
  closeConnection(dexId: string): void {
    const ws = this.connections.get(dexId);
    if (ws) {
      ws.close();
      this.connections.delete(dexId);
    }
  }

  /**
   * Close all connections
   */
  closeAllConnections(): void {
    for (const dexId of this.connections.keys()) {
      this.closeConnection(dexId);
    }
  }

  /**
   * Send data through a connection
   */
  sendData(dexId: string, data: any): boolean {
    const ws = this.connections.get(dexId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    try {
      ws.send(typeof data === 'string' ? data : JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`Error sending data through WebSocket:`, error);
      return false;
    }
  }

  /**
   * Get connection status
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
export const webSocketConnection = new WebSocketConnection();
