
import { DEX, Token } from '@/types';
import { webSocketManager } from './websocket';
import { priceHistoryStorage } from './storage';

/**
 * Manages WebSocket connections for price updates
 */
export class WebSocketConnector {
  /**
   * Connect to WebSockets for all active DEXes
   */
  connectToDexes(activeDexes: DEX[], chainId: number): void {
    for (const dex of activeDexes) {
      const connected = webSocketManager.connect(dex, chainId);
      
      if (connected) {
        // Add WebSocket message handler
        webSocketManager.addMessageHandler(dex.id, (data) => {
          this.handleWebSocketPrice(dex, data);
        });
      }
    }
  }

  /**
   * Subscribe to all pairs across all connected DEXes
   */
  subscribeTokenPairs(pairs: { tokenA: Token, tokenB: Token }[], dexes: DEX[]): void {
    for (const dex of dexes) {
      const wsStatus = webSocketManager.getConnectionStatus(dex.id);
      if (wsStatus === 'connected') {
        for (const pair of pairs) {
          webSocketManager.subscribeToPair(dex.id, pair.tokenA, pair.tokenB);
        }
      }
    }
  }

  /**
   * Handle a price update from WebSocket
   */
  private handleWebSocketPrice(dex: DEX, data: any): void {
    try {
      // Example parsing logic (adjust based on actual format)
      if (data.type === 'price' && data.pair && data.price) {
        const [token0Address, token1Address] = data.pair.split('-');
        
        if (!token0Address || !token1Address) {
          return;
        }
        
        const pricePoint = {
          timestamp: Date.now(),
          price: parseFloat(data.price),
          dexId: dex.id,
        };
        
        // Store price data
        priceHistoryStorage.addPricePoint(token0Address, pricePoint);
      }
    } catch (error) {
      console.error(`Error handling WebSocket price for ${dex.name}:`, error);
    }
  }
}

// Export singleton instance
export const wsConnector = new WebSocketConnector();
