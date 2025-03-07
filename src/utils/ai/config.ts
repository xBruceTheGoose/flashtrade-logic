
/**
 * Configuration interface for AI framework
 */
export interface AIConfig {
  apiKey: string;
  // Add other configuration parameters as needed
}

const AI_CONFIG_KEY = 'coinbase_ai_config';

/**
 * Get the current AI configuration from localStorage
 */
export function getAIConfig(): AIConfig {
  try {
    const storedConfig = localStorage.getItem(AI_CONFIG_KEY);
    return storedConfig ? JSON.parse(storedConfig) : { apiKey: '' };
  } catch (error) {
    console.error('Failed to load AI configuration:', error);
    return { apiKey: '' };
  }
}

/**
 * Save AI configuration to localStorage
 */
export function saveAIConfig(config: AIConfig): void {
  try {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save AI configuration:', error);
  }
}

/**
 * Clear AI configuration from localStorage
 */
export function clearAIConfig(): void {
  try {
    localStorage.removeItem(AI_CONFIG_KEY);
  } catch (error) {
    console.error('Failed to clear AI configuration:', error);
  }
}
