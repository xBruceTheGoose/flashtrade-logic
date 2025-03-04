
import { toast } from '@/hooks/use-toast';
import { MAX_SLIPPAGE, MIN_SLIPPAGE } from '@/utils/arbitrage/constants';

/**
 * Validation utilities for secure input handling
 */

/**
 * Validates and sanitizes a number input
 * @param value - The input value to validate
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param defaultValue - Default value if validation fails
 * @returns Validated and sanitized number value
 */
export function validateNumberInput(
  value: string | number,
  min: number,
  max: number,
  defaultValue: number
): number {
  // Convert string to number
  const numberValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Check if it's a valid number
  if (isNaN(numberValue)) {
    return defaultValue;
  }
  
  // Clamp within range
  return Math.min(Math.max(numberValue, min), max);
}

/**
 * Sanitizes a string input to prevent injection attacks
 * @param value - The input value to sanitize
 * @param maxLength - Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeStringInput(value: string, maxLength: number = 256): string {
  // Trim whitespace
  let sanitized = value.trim();
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // Escape HTML entities to prevent XSS
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  
  return sanitized;
}

/**
 * Validates and sanitizes slippage tolerance input
 * @param value - Slippage tolerance value
 * @returns Valid slippage tolerance value
 */
export function validateSlippageTolerance(value: string | number): number {
  const slippage = validateNumberInput(
    value,
    MIN_SLIPPAGE,
    MAX_SLIPPAGE,
    0.5 // Default value
  );
  
  // Warn user if value was adjusted
  const originalValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (!isNaN(originalValue) && originalValue !== slippage) {
    toast({
      title: "Input Adjusted",
      description: `Slippage tolerance adjusted to valid range (${MIN_SLIPPAGE}-${MAX_SLIPPAGE}%)`,
      variant: "warning"
    });
  }
  
  return slippage;
}

/**
 * Validates a wallet address
 * @param address - Ethereum address to validate
 * @returns Whether the address is valid
 */
export function isValidEthereumAddress(address: string): boolean {
  // Check if it matches the Ethereum address pattern
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validates a positive number string
 * @param value - String to validate as a positive number
 * @returns Whether the string represents a valid positive number
 */
export function isValidPositiveNumber(value: string): boolean {
  const number = parseFloat(value);
  return !isNaN(number) && number > 0 && /^\d*\.?\d*$/.test(value);
}

/**
 * Securely parse JSON with error handling
 * @param jsonString - JSON string to parse
 * @returns Parsed object or null if invalid
 */
export function safeJsonParse(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return null;
  }
}

/**
 * Store data securely in localStorage with encryption
 * @param key - Storage key
 * @param data - Data to store
 */
export function secureLocalStorage = {
  // Set item with optional encryption
  setItem: (key: string, value: any): void => {
    try {
      // For sensitive data, encryption would be implemented here
      // For this simple implementation, we're just storing as JSON
      const jsonValue = JSON.stringify(value);
      localStorage.setItem(`secure_${key}`, jsonValue);
    } catch (error) {
      console.error('Error storing data:', error);
    }
  },
  
  // Get item with optional decryption
  getItem: <T>(key: string, defaultValue: T): T => {
    try {
      const jsonValue = localStorage.getItem(`secure_${key}`);
      if (!jsonValue) return defaultValue;
      
      // For sensitive data, decryption would be implemented here
      return JSON.parse(jsonValue) as T;
    } catch (error) {
      console.error('Error retrieving data:', error);
      return defaultValue;
    }
  },
  
  // Remove item
  removeItem: (key: string): void => {
    localStorage.removeItem(`secure_${key}`);
  }
};

/**
 * Validate permissions for a wallet operation
 * @param operation - Operation name
 * @param params - Operation parameters
 * @returns Whether the operation is allowed
 */
export function validateWalletOperation(operation: string, params: any): boolean {
  // In a real app, this would implement permissions and policy checking
  
  // For demo purposes, we'll implement a basic whitelist
  const allowedOperations = ['transfer', 'approve', 'swap', 'stake'];
  
  if (!allowedOperations.includes(operation)) {
    toast({
      title: "Operation Blocked",
      description: `The operation "${operation}" is not allowed`,
      variant: "destructive"
    });
    return false;
  }
  
  return true;
}
