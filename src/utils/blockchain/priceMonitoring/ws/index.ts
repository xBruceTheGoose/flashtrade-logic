
import { DEX, Token } from '@/types';
import { webSocketConnection } from './connection';
import { webSocketMessageHandler } from './messageHandler';
import { webSocketReconnection } from './reconnection';
import { webSocketSubscription } from './subscription';
import { toast } from '@/hooks/use-toast';

/**
 * Unified WebSocket manager that composes all WebSocket services
 */
class WebSocketManager {
  constructor() {
    // Set up reconnection callback
    webSocketReconnection.setReconnectCallback((dexId) => {
      const dex = this.getDexById(dexId);
      if (dex) {
        this.connect(dex, this.currentChainId);
      }
    });
  }

  private currentChainId: number = 1;
  private dexMap: Map<string, DEX> = new Map();

  /**
   * Helper to get DEX by ID
   */
  private getDexById(dexId: string): DEX | undefined {
    return this.dexMap.get(dexId);
  }

  /**
   * Connect to a DEX WebSocket API
   */
  connect(dex: DEX, chainId: number): boolean {
    this.currentChainId = chainId;
    this.dexMap.set(dex.id, dex);
    const dexId = dex.id;
    
    // If already connected, return true
    if (webSocketConnection.getConnectionStatus(dexId) === 'connected') {
      return true;
    }
    
    // Get WebSocket URL
    const wsUrl = webSocketConnection.getWebSocketUrl(dexId, chainId);
    if (!wsUrl) {
      console.warn(`No WebSocket URL available for ${dex.name} on chain ${chainId}`);
      return false;
    }
    
    try {
      // Create WebSocket connection
      webSocketConnection.createConnection(
        dexId,
        wsUrl,
        // onOpen
        () => {
          console.log(`WebSocket connection established for ${dex.name}`);
          webSocketReconnection.resetReconnectTimeout(dexId);
        },
        // onClose
        () => {
          console.log(`WebSocket connection closed for ${dex.name}`);
          webSocketReconnection.scheduleReconnect(dexId);
        },
        // onError
        (error) => {
          console.error(`WebSocket error for ${dex.name}:`, error);
        },
        // onMessage
        (data) => {
          webSocketMessageHandler.processMessage(dexId, data);
        }
      );
      
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
    webSocketConnection.closeConnection(dexId);
    webSocketReconnection.resetReconnectTimeout(dexId);
  }

  /**
   * Disconnect from all WebSocket connections
   */
  disconnectAll(): void {
    webSocketConnection.closeAllConnections();
    webSocketReconnection.resetAllTimeouts();
  }

  /**
   * Subscribe to price updates for a token pair
   */
  subscribeToPair(dexId: string, tokenA: Token, tokenB: Token): boolean {
    return webSocketSubscription.subscribeToPair(dexId, tokenA, tokenB);
  }

  /**
   * Add a message handler for a specific DEX
   */
  addMessageHandler(dexId: string, handler: (data: any) => void): void {
    webSocketMessageHandler.addHandler(dexId, handler);
  }

  /**
   * Remove a message handler
   */
  removeMessageHandler(dexId: string, handler: (data: any) => void): void {
    webSocketMessageHandler.removeHandler(dexId, handler);
  }

  /**
   * Get connection status for a DEX
   */
  getConnectionStatus(dexId: string): 'connected' | 'connecting' | 'disconnected' {
    return webSocketConnection.getConnectionStatus(dexId);
  }
}

// Export singleton instance
export const webSocketManager = new WebSocketManager();
