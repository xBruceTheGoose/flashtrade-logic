
import { TradeExecutionRecord } from './types';
import { v4 as uuidv4 } from 'uuid';
import { toast } from '@/hooks/use-toast';

// Maximum number of records to keep in memory
const MAX_RECORDS = 100;

class TradeExecutionStorage {
  private records: TradeExecutionRecord[] = [];
  
  /**
   * Add a new trade execution record
   */
  addRecord(record: Omit<TradeExecutionRecord, 'id'>): TradeExecutionRecord {
    const newRecord: TradeExecutionRecord = {
      ...record,
      id: uuidv4()
    };
    
    // Add to beginning of array
    this.records.unshift(newRecord);
    
    // Trim array if it gets too large
    if (this.records.length > MAX_RECORDS) {
      this.records.length = MAX_RECORDS;
    }
    
    return newRecord;
  }
  
  /**
   * Update an existing record
   */
  updateRecord(
    id: string, 
    updates: Partial<TradeExecutionRecord>
  ): TradeExecutionRecord | null {
    const record = this.records.find(r => r.id === id);
    
    if (!record) {
      return null;
    }
    
    // Update record
    Object.assign(record, updates);
    
    return record;
  }
  
  /**
   * Get all records
   */
  getRecords(): TradeExecutionRecord[] {
    return [...this.records];
  }
  
  /**
   * Get trade history (alias for getRecords for backward compatibility)
   */
  getTradeHistory(): TradeExecutionRecord[] {
    return this.getRecords();
  }
  
  /**
   * Get a specific record by ID
   */
  getRecordById(id: string): TradeExecutionRecord | null {
    return this.records.find(r => r.id === id) || null;
  }
  
  /**
   * Get records for a specific opportunity
   */
  getRecordsByOpportunity(opportunityId: string): TradeExecutionRecord[] {
    return this.records.filter(r => r.opportunityId === opportunityId);
  }
  
  /**
   * Clear all records
   */
  clearRecords(): void {
    this.records = [];
    toast({
      title: "Trade Records Cleared",
      description: "All trade execution records have been cleared."
    });
  }
  
  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    totalTrades: number;
    successfulTrades: number;
    failedTrades: number;
    totalProfit: string;
    averageExecutionTime: number;
    successRate: number;
  } {
    const totalTrades = this.records.length;
    const successfulTrades = this.records.filter(r => r.status === 'completed').length;
    const failedTrades = this.records.filter(r => r.status === 'failed').length;
    
    // Calculate total profit
    const totalProfitValue = this.records
      .filter(r => r.status === 'completed' && r.actualProfit)
      .reduce((sum, r) => sum + parseFloat(r.actualProfit || '0'), 0);
    
    // Calculate average execution time
    const executionTimes = this.records
      .filter(r => r.executionTime !== undefined)
      .map(r => r.executionTime as number);
    
    const averageExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
      : 0;
    
    // Calculate success rate
    const successRate = totalTrades > 0 
      ? (successfulTrades / totalTrades) * 100 
      : 0;
    
    return {
      totalTrades,
      successfulTrades,
      failedTrades,
      totalProfit: totalProfitValue.toFixed(4) + ' ETH',
      averageExecutionTime,
      successRate
    };
  }
  
  /**
   * Export records to JSON
   */
  exportRecords(): string {
    return JSON.stringify(this.records, null, 2);
  }
  
  /**
   * Import records from JSON
   */
  importRecords(json: string): void {
    try {
      const imported = JSON.parse(json) as TradeExecutionRecord[];
      this.records = imported;
      toast({
        title: "Trade Records Imported",
        description: `Successfully imported ${imported.length} trade records.`
      });
    } catch (error) {
      console.error('Error importing trade records:', error);
      toast({
        title: "Import Failed",
        description: "Failed to import trade records. Invalid format.",
        variant: "destructive"
      });
    }
  }
}

// Export singleton instance
export const tradeExecutionStorage = new TradeExecutionStorage();
