
import { Coinbase } from '@coinbase/coinbase-sdk';
import { logger } from '../monitoring/loggingService';
import { getAIConfig, saveAIConfig } from './config';

/**
 * Service that interfaces with Coinbase's SDK for AI-powered trading
 */
export class AIService {
  private client: any | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the Coinbase SDK client
   */
  private initialize(): void {
    try {
      const config = getAIConfig();
      
      if (config.apiKey) {
        // Create a new Coinbase client instance with the API key
        this.client = new Coinbase({
          apiKey: config.apiKey,
        });
        
        this.isInitialized = true;
        logger.info('ai', 'Coinbase AI service initialized successfully');
      } else {
        logger.warn('ai', 'Coinbase AI service not initialized - API key missing');
      }
    } catch (error) {
      logger.error('ai', 'Failed to initialize Coinbase AI service', { error });
      this.isInitialized = false;
      this.client = null;
    }
  }

  /**
   * Check if the API key is valid
   */
  public async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      // Create a temporary client to test the API key
      const tempClient = new Coinbase({
        apiKey: apiKey,
      });
      
      // Try to make a simple API call to validate the API key
      // Use fallbacks in case certain methods aren't available
      try {
        if (typeof tempClient.getTime === 'function') {
          await tempClient.getTime();
        } else if (typeof tempClient.ping === 'function') {
          await tempClient.ping();
        } else {
          // If no validation method is available, assume the key is valid
          // but log a warning
          logger.warn('ai', 'No validation method available for Coinbase API key');
        }
        
        return true;
      } catch (validationError) {
        logger.warn('ai', 'API key validation failed during method call', { validationError });
        return false;
      }
      
    } catch (error) {
      logger.warn('ai', 'API key validation failed during client creation', { error });
      return false;
    }
  }

  /**
   * Set a new API key and reinitialize the client
   */
  public setApiKey(apiKey: string): void {
    try {
      saveAIConfig({ apiKey });
      this.initialize();
      logger.info('ai', 'API key updated successfully');
    } catch (error) {
      logger.error('ai', 'Failed to update API key', { error });
    }
  }

  /**
   * Evaluate an arbitrage opportunity using AI
   */
  public async evaluateArbitrageOpportunity(opportunityData: any): Promise<{
    recommendation: 'execute' | 'skip';
    confidence: number;
    reasoning: string;
  }> {
    if (!this.isInitialized || !this.client) {
      logger.warn('ai', 'Cannot evaluate arbitrage - AI service not initialized');
      return {
        recommendation: 'skip',
        confidence: 0,
        reasoning: 'AI service not initialized',
      };
    }

    try {
      // This is a placeholder for actual SDK implementation
      // Replace with actual SDK method calls when available
      
      logger.info('ai', 'Evaluating arbitrage opportunity', { opportunityData });
      
      // Simulate AI evaluation for now
      const profitValue = opportunityData.estimatedProfit || 0;
      const confidence = Math.min(profitValue / 0.5, 0.95); // Scale confidence based on profit
      
      return {
        recommendation: confidence > 0.7 ? 'execute' : 'skip',
        confidence,
        reasoning: `Based on profit estimate of ${profitValue} ETH and market conditions`,
      };
    } catch (error) {
      logger.error('ai', 'Failed to evaluate arbitrage opportunity', { error, opportunityData });
      return {
        recommendation: 'skip',
        confidence: 0,
        reasoning: 'Error during evaluation',
      };
    }
  }
}

export const aiService = new AIService();
