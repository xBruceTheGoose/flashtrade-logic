
import { ArbitrageOpportunity } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { executeArbitrage } from '@/utils/arbitrage';
import { toast } from '@/hooks/use-toast';

/**
 * Manages arbitrage opportunities
 */
export class OpportunityManager {
  private pendingOpportunities: Map<string, ArbitrageOpportunity> = new Map();

  /**
   * Add a new opportunity
   */
  addOpportunity(opportunity: ArbitrageOpportunity): void {
    if (!this.pendingOpportunities.has(opportunity.id)) {
      this.pendingOpportunities.set(opportunity.id, opportunity);
    }
  }

  /**
   * Get all pending opportunities
   */
  getPendingOpportunities(): ArbitrageOpportunity[] {
    return Array.from(this.pendingOpportunities.values());
  }

  /**
   * Get an opportunity by ID
   */
  getOpportunity(id: string): ArbitrageOpportunity | undefined {
    return this.pendingOpportunities.get(id);
  }

  /**
   * Execute an arbitrage opportunity
   */
  async executeOpportunity(opportunity: ArbitrageOpportunity): Promise<void> {
    try {
      // Update opportunity status
      opportunity.status = 'executing';
      this.pendingOpportunities.set(opportunity.id, opportunity);
      
      // Execute arbitrage
      const result = await executeArbitrage(opportunity);
      
      // Update opportunity status based on result
      if (result.success) {
        opportunity.status = 'completed';
        
        toast({
          title: "Arbitrage Executed",
          description: `Successfully executed ${opportunity.tokenIn.symbol} arbitrage with ${opportunity.profitPercentage.toFixed(2)}% profit`,
        });
      } else {
        opportunity.status = 'failed';
        
        toast({
          title: "Arbitrage Failed",
          description: result.error || "Transaction failed",
          variant: "destructive",
        });
      }
      
      // Update in pending opportunities
      this.pendingOpportunities.set(opportunity.id, opportunity);
    } catch (error) {
      console.error('Error executing arbitrage opportunity:', error);
      
      // Update opportunity status
      opportunity.status = 'failed';
      this.pendingOpportunities.set(opportunity.id, opportunity);
      
      toast({
        title: "Arbitrage Failed",
        description: "Error executing arbitrage opportunity",
        variant: "destructive",
      });
    }
  }
}

// Export singleton instance
export const opportunityManager = new OpportunityManager();
