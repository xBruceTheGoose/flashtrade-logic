
import { logger } from '../monitoring/loggingService';
import { toast } from '@/hooks/use-toast';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  module: string;
  operation: string;
  data?: any;
  userId?: string;
}

/**
 * Standardized error handler for consistent error management across the application
 */
export class ErrorHandler {
  /**
   * Handle an error with consistent logging and user notification
   */
  static handleError(
    error: Error | string,
    context: ErrorContext,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    showToast: boolean = true
  ): void {
    // Prepare error info
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    
    // Prepare log data
    const logData = {
      ...context,
      errorMessage,
      stack: errorObj.stack,
      timestamp: Date.now()
    };
    
    // Log based on severity
    switch (severity) {
      case ErrorSeverity.LOW:
        logger.warn(context.module, errorMessage, logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.error(context.module, errorMessage, logData);
        break;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        logger.critical(context.module, errorMessage, logData);
        break;
    }
    
    // Show toast notification if requested
    if (showToast) {
      toast({
        title: this.getToastTitle(severity, context),
        description: this.formatErrorMessage(errorMessage),
        variant: severity === ErrorSeverity.LOW ? "default" : "destructive"
      });
    }
    
    // For critical errors, we might want to take additional actions
    if (severity === ErrorSeverity.CRITICAL) {
      this.handleCriticalError(context, errorMessage);
    }
  }
  
  /**
   * Get appropriate toast title based on severity and context
   */
  private static getToastTitle(severity: ErrorSeverity, context: ErrorContext): string {
    const module = context.module.charAt(0).toUpperCase() + context.module.slice(1);
    
    switch (severity) {
      case ErrorSeverity.LOW:
        return `${module} Warning`;
      case ErrorSeverity.MEDIUM:
        return `${module} Error`;
      case ErrorSeverity.HIGH:
        return `${module} Error`;
      case ErrorSeverity.CRITICAL:
        return `Critical System Error`;
      default:
        return 'Error';
    }
  }
  
  /**
   * Format error message for user-friendly display
   */
  private static formatErrorMessage(message: string): string {
    // Trim message if too long
    if (message.length > 120) {
      return message.substring(0, 120) + '...';
    }
    
    return message;
  }
  
  /**
   * Handle critical errors that might require system intervention
   */
  private static handleCriticalError(context: ErrorContext, errorMessage: string): void {
    logger.critical('system', 'CRITICAL ERROR - Additional handling required', {
      context,
      errorMessage,
      timestamp: Date.now()
    });
    
    // Here we could implement additional actions like:
    // - Emergency stop for trading activities
    // - Admin notifications
    // - Automatic system recovery attempts
  }
  
  /**
   * Wrap a function with standardized error handling
   */
  static async withErrorHandling<T>(
    fn: () => Promise<T>,
    context: ErrorContext,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    showToast: boolean = true
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      this.handleError(error as Error, context, severity, showToast);
      return null;
    }
  }
}
