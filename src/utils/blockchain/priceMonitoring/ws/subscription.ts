
import { Token } from '@/types';
import { webSocketConnection } from './connection';

/**
 * WebSocket subscription service
 * Manages subscriptions to token pair price updates
 */
export class WebSocketSubscriptionService {
  /**
   * Subscribe to a token pair on a specific DEX
   */
  subscribeToPair(dexId: string, tokenA: Token, tokenB: Token): boolean {
    if (webSocketConnection.getConnectionStatus(dexId) !== 'connected') {
      console.warn(`Cannot subscribe: WebSocket not connected for ${dexId}`);
      return false;
    }
    
    try {
      // Subscription message format would vary by DEX
      const subscriptionMessage = {
        type: 'subscribe',
        channel: 'price',
        pair: `${tokenA.address}-${tokenB.address}`,
      };
      
      return webSocketConnection.sendData(dexId, subscriptionMessage);
    } catch (error) {
      console.error(`Error subscribing to ${tokenA.symbol}/${tokenB.symbol} on ${dexId}:`, error);
      return false;
    }
  }

  /**
   * Unsubscribe from a token pair on a specific DEX
   */
  unsubscribeFromPair(dexId: string, tokenA: Token, tokenB: Token): boolean {
    if (webSocketConnection.getConnectionStatus(dexId) !== 'connected') {
      return false;
    }
    
    try {
      // Unsubscription message format would vary by DEX
      const unsubscriptionMessage = {
        type: 'unsubscribe',
        channel: 'price',
        pair: `${tokenA.address}-${tokenB.address}`,
      };
      
      return webSocketConnection.sendData(dexId, unsubscriptionMessage);
    } catch (error) {
      console.error(`Error unsubscribing from ${tokenA.symbol}/${tokenB.symbol} on ${dexId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const webSocketSubscription = new WebSocketSubscriptionService();
