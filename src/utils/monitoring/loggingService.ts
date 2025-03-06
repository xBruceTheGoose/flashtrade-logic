
import { v4 as uuidv4 } from 'uuid';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  module: string;
  data?: any;
  tags?: string[];
}

export interface LogFilter {
  level?: LogLevel | LogLevel[];
  module?: string | string[];
  tag?: string | string[];
  startTime?: number;
  endTime?: number;
}

/**
 * Logging Service
 * Handles structured logging for debugging and auditing purposes
 */
class LoggingService {
  private logs: LogEntry[] = [];
  private logLimit: number = 1000; // Maximum number of logs to keep in memory
  private consoleOutput: boolean = true;
  private debugEnabled: boolean = true;
  
  constructor() {
    console.log('Logging Service initialized');
    
    // Add a timestamp to indicate when logging started
    this.info('system', 'Logging service started', { timestamp: Date.now() });
  }
  
  /**
   * Log a debug message
   */
  debug(module: string, message: string, data?: any, tags?: string[]): void {
    if (!this.debugEnabled) return;
    
    this.log('debug', module, message, data, tags);
  }
  
  /**
   * Log an info message
   */
  info(module: string, message: string, data?: any, tags?: string[]): void {
    this.log('info', module, message, data, tags);
  }
  
  /**
   * Log a warning message
   */
  warn(module: string, message: string, data?: any, tags?: string[]): void {
    this.log('warn', module, message, data, tags);
  }
  
  /**
   * Log an error message
   */
  error(module: string, message: string, data?: any, tags?: string[]): void {
    this.log('error', module, message, data, tags);
  }
  
  /**
   * Log a critical message
   */
  critical(module: string, message: string, data?: any, tags?: string[]): void {
    this.log('critical', module, message, data, tags);
  }
  
  /**
   * General logging method
   */
  private log(
    level: LogLevel,
    module: string,
    message: string,
    data?: any,
    tags?: string[]
  ): LogEntry {
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      level,
      message,
      module,
      data,
      tags
    };
    
    // Add to logs array
    this.logs.push(entry);
    
    // Trim logs if we exceed the limit
    if (this.logs.length > this.logLimit) {
      this.logs = this.logs.slice(-this.logLimit);
    }
    
    // Output to console if enabled
    if (this.consoleOutput) {
      this.writeToConsole(entry);
    }
    
    return entry;
  }
  
  /**
   * Write log entry to console
   */
  private writeToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.module}]`;
    
    switch (entry.level) {
      case 'debug':
        console.debug(prefix, entry.message, entry.data || '');
        break;
      case 'info':
        console.info(prefix, entry.message, entry.data || '');
        break;
      case 'warn':
        console.warn(prefix, entry.message, entry.data || '');
        break;
      case 'error':
      case 'critical':
        console.error(prefix, entry.message, entry.data || '');
        break;
    }
  }
  
  /**
   * Get all logs, optionally filtered
   */
  getLogs(filter?: LogFilter): LogEntry[] {
    if (!filter) return [...this.logs];
    
    return this.logs.filter(log => {
      // Check log level
      if (filter.level) {
        const levels = Array.isArray(filter.level) ? filter.level : [filter.level];
        if (!levels.includes(log.level)) return false;
      }
      
      // Check module
      if (filter.module) {
        const modules = Array.isArray(filter.module) ? filter.module : [filter.module];
        if (!modules.includes(log.module)) return false;
      }
      
      // Check tags
      if (filter.tag && log.tags) {
        const tags = Array.isArray(filter.tag) ? filter.tag : [filter.tag];
        if (!tags.some(tag => log.tags?.includes(tag))) return false;
      }
      
      // Check time range
      if (filter.startTime && log.timestamp < filter.startTime) return false;
      if (filter.endTime && log.timestamp > filter.endTime) return false;
      
      return true;
    });
  }
  
  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.info('system', 'Logs cleared', { timestamp: Date.now() });
  }
  
  /**
   * Export logs to JSON
   */
  exportLogs(filter?: LogFilter): string {
    const logs = this.getLogs(filter);
    return JSON.stringify(logs, null, 2);
  }
  
  /**
   * Import logs from JSON
   */
  importLogs(json: string): boolean {
    try {
      const logs = JSON.parse(json);
      
      if (Array.isArray(logs)) {
        // Add imported logs, but don't exceed limit
        const combinedLogs = [...this.logs, ...logs];
        this.logs = combinedLogs.slice(-this.logLimit);
        
        this.info('system', `Imported ${logs.length} logs`, { timestamp: Date.now() });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error importing logs:', error);
      return false;
    }
  }
  
  /**
   * Enable or disable debug logging
   */
  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    this.info('system', `Debug logging ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Enable or disable console output
   */
  setConsoleOutput(enabled: boolean): void {
    this.consoleOutput = enabled;
    this.info('system', `Console output ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Set the maximum number of logs to keep in memory
   */
  setLogLimit(limit: number): void {
    if (limit < 100) limit = 100;
    this.logLimit = limit;
    
    // Trim logs if necessary
    if (this.logs.length > this.logLimit) {
      this.logs = this.logs.slice(-this.logLimit);
    }
    
    this.info('system', `Log limit set to ${limit}`);
  }
  
  /**
   * Get a summary of log counts by level
   */
  getLogSummary(): Record<LogLevel, number> {
    const summary: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      critical: 0
    };
    
    for (const log of this.logs) {
      summary[log.level]++;
    }
    
    return summary;
  }
}

// Export singleton instance
export const logger = new LoggingService();
