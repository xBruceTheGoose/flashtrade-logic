
/**
 * WebSocket message handler service
 * Manages message handlers for different DEXes
 */
export class WebSocketMessageHandler {
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map();

  /**
   * Add a message handler for a specific DEX
   */
  addHandler(dexId: string, handler: (data: any) => void): void {
    if (!this.messageHandlers.has(dexId)) {
      this.messageHandlers.set(dexId, new Set());
    }
    
    this.messageHandlers.get(dexId)!.add(handler);
  }

  /**
   * Remove a message handler
   */
  removeHandler(dexId: string, handler: (data: any) => void): void {
    const handlers = this.messageHandlers.get(dexId);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Process an incoming message by invoking all registered handlers
   */
  processMessage(dexId: string, data: any): void {
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
   * Clear all handlers for a specific DEX
   */
  clearHandlers(dexId: string): void {
    this.messageHandlers.delete(dexId);
  }

  /**
   * Clear all handlers
   */
  clearAllHandlers(): void {
    this.messageHandlers.clear();
  }
}

// Export singleton instance
export const webSocketMessageHandler = new WebSocketMessageHandler();
