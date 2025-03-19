import * as Sentry from '@sentry/react';
import { trackMetric } from '../config/monitoring';
import { ethers } from 'ethers';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export class SystemError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly severity: ErrorSeverity,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'SystemError';
  }
}

export class ErrorHandler {
  private static readonly ERROR_CODES = {
    CONTRACT_INTERACTION: 'E001',
    STRATEGY_OPTIMIZATION: 'E002',
    DATA_PROCESSING: 'E003',
    NETWORK_ERROR: 'E004',
    STATE_MANAGEMENT: 'E005',
    SECURITY_VIOLATION: 'E006'
  };

  static handleError(error: Error | SystemError, context?: Record<string, any>): void {
    const errorDetails = this.processError(error, context);
    
    // Log to monitoring systems
    this.logError(errorDetails);
    
    // Track metrics
    this.trackErrorMetrics(errorDetails);
    
    // Handle critical errors
    if (errorDetails.severity === ErrorSeverity.CRITICAL) {
      this.handleCriticalError(errorDetails);
    }
  }

  private static processError(
    error: Error | SystemError,
    context?: Record<string, any>
  ): {
    message: string;
    code: string;
    severity: ErrorSeverity;
    context: Record<string, any>;
    stack?: string;
  } {
    if (error instanceof SystemError) {
      return {
        message: error.message,
        code: error.code,
        severity: error.severity,
        context: { ...error.context, ...context },
        stack: error.stack
      };
    }

    // Process different types of errors
    if (error instanceof ethers.errors.TransactionError) {
      return {
        message: error.message,
        code: this.ERROR_CODES.CONTRACT_INTERACTION,
        severity: ErrorSeverity.HIGH,
        context: {
          ...context,
          transactionHash: error?.transactionHash,
          receipt: error?.receipt
        },
        stack: error.stack
      };
    }

    // Default error processing
    return {
      message: error.message,
      code: this.ERROR_CODES.STATE_MANAGEMENT,
      severity: ErrorSeverity.MEDIUM,
      context: context || {},
      stack: error.stack
    };
  }

  private static logError(errorDetails: {
    message: string;
    code: string;
    severity: ErrorSeverity;
    context: Record<string, any>;
    stack?: string;
  }): void {
    // Send to Sentry
    Sentry.captureException(new Error(errorDetails.message), {
      tags: {
        error_code: errorDetails.code,
        severity: errorDetails.severity
      },
      extra: {
        ...errorDetails.context,
        stack: errorDetails.stack
      }
    });

    // Console logging with severity-based formatting
    const logMethod = errorDetails.severity === ErrorSeverity.CRITICAL || 
                     errorDetails.severity === ErrorSeverity.HIGH
      ? console.error
      : console.warn;

    logMethod(
      `[${errorDetails.code}] ${errorDetails.severity.toUpperCase()}: ${errorDetails.message}`,
      '\nContext:', errorDetails.context,
      '\nStack:', errorDetails.stack
    );
  }

  private static trackErrorMetrics(errorDetails: {
    code: string;
    severity: ErrorSeverity;
  }): void {
    trackMetric(`error_count_${errorDetails.code}`, 1);
    trackMetric(`error_severity_${errorDetails.severity}`, 1);
  }

  private static handleCriticalError(errorDetails: {
    message: string;
    code: string;
    context: Record<string, any>;
  }): void {
    // Notify emergency contacts
    this.notifyEmergencyContacts(errorDetails);
    
    // Attempt system recovery
    this.initiateSystemRecovery(errorDetails);
  }

  private static async notifyEmergencyContacts(errorDetails: {
    message: string;
    code: string;
    context: Record<string, any>;
  }): Promise<void> {
    // Implementation depends on notification system
    console.error('CRITICAL SYSTEM ERROR:', errorDetails);
  }

  private static async initiateSystemRecovery(errorDetails: {
    code: string;
    context: Record<string, any>;
  }): Promise<void> {
    try {
      // Attempt to pause active trading if necessary
      if (errorDetails.code === this.ERROR_CODES.SECURITY_VIOLATION) {
        // Implement emergency shutdown logic
      }

      // Log recovery attempt
      trackMetric('system_recovery_attempt', 1);
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError);
      trackMetric('system_recovery_failure', 1);
    }
  }
}
