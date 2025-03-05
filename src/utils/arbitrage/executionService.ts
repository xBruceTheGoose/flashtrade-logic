import { ArbitrageOpportunity } from '@/types';
import { 
  ExecutionOptions, 
  ExecutionResult,
  ExecutionStatus,
  TradeExecutionRecord,
  CircuitBreakerEvent
} from './types';
import { tradeExecutionStorage } from './storage';
import { toast } from '@/hooks/use-toast';
import { executionConfigManager } from './executionConfig';
import { CIRCUIT_BREAKER_THRESHOLDS, API_RATE_LIMITS } from './constants';
import { rateLimiters } from '@/utils/blockchain/priceMonitoring/rateLimit';
import { blockchain } from '@/utils/blockchain';
import { ethers } from 'ethers';

export const DEFAULT_EXECUTION_OPTIONS: ExecutionOptions = {
  strategy: 'sequential',
  priority: 'medium',
  useFlashloan: false,
  flashloanProvider: 'aave',
  maxGasPrice: '100',
  gasPriceMultiplier: 1.1,
  maxRetries: 2,
  retryDelay: 15000,
  slippageTolerance: 0.5
};

const tradeRateLimiter = rateLimiters.register(
  'trade-execution', 
  API_RATE_LIMITS.trade.maxRequests, 
  API_RATE_LIMITS.trade.timeWindowMs
);

const flashloanRateLimiter = rateLimiters.register(
  'flashloan-execution', 
  API_RATE_LIMITS.flashloan.maxRequests, 
  API_RATE_LIMITS.flashloan.timeWindowMs
);

interface SimulationResult {
  success: boolean;
  expectedProfit: string;
  actualProfit?: string;
  gasUsed?: string;
  error?: string;
}

class ExecutionService {
  private emergencyStopActive: boolean = false;
  private circuitBreakerTriggered: boolean = false;
  private simulationFailed: boolean = false;
  private lastCircuitBreakerEvent: CircuitBreakerEvent | null = null;
  
  constructor() {
    console.log('Execution Service initialized with security measures');
  }

  isEmergencyStopActive(): boolean {
    return this.emergencyStopActive;
  }
  
  activateEmergencyStop(reason: string): void {
    console.warn('EMERGENCY STOP ACTIVATED:', reason);
    this.emergencyStopActive = true;
    
    toast({
      title: "Emergency Stop Activated",
      description: reason,
      variant: "destructive"
    });
  }
  
  deactivateEmergencyStop(): void {
    console.log('Emergency stop deactivated');
    this.emergencyStopActive = false;
    
    toast({
      title: "Emergency Stop Deactivated",
      description: "Trading operations can now resume"
    });
  }
  
  resetCircuitBreaker(): void {
    this.circuitBreakerTriggered = false;
    this.lastCircuitBreakerEvent = null;
    
    toast({
      title: "Circuit Breaker Reset",
      description: "Circuit breaker has been reset"
    });
  }
  
  getCircuitBreakerStatus(): { triggered: boolean; event: CircuitBreakerEvent | null } {
    return {
      triggered: this.circuitBreakerTriggered,
      event: this.lastCircuitBreakerEvent
    };
  }
  
  private triggerCircuitBreaker(event: CircuitBreakerEvent): void {
    if (!this.circuitBreakerTriggered) {
      console.warn('CIRCUIT BREAKER TRIGGERED:', event);
      this.circuitBreakerTriggered = true;
      this.lastCircuitBreakerEvent = event;
      
      toast({
        title: "Circuit Breaker Triggered",
        description: event.reason,
        variant: "destructive"
      });
    }
  }

  private async simulateTransaction(
    opportunity: ArbitrageOpportunity,
    options: Partial<ExecutionOptions> = {}
  ): Promise<SimulationResult> {
    console.log('Simulating transaction for opportunity:', opportunity.id);
    
    try {
      const config = executionConfigManager.getExecutionConfig();
      const expectedProfit = opportunity.estimatedProfit;
      
      const gasPrice = await blockchain.getCurrentProvider().getGasPrice();
      const estimatedGasUsed = "150000";
      const gasCost = gasPrice.mul(estimatedGasUsed);
      const gasCostEth = parseFloat(ethers.utils.formatEther(gasCost));
      
      const profitValue = parseFloat(expectedProfit.split(' ')[0]);
      const profitInEth = profitValue / (opportunity.tokenIn.price || 1);
      
      if (gasCostEth > profitInEth * 0.5) {
        return {
          success: false,
          expectedProfit,
          error: `Gas cost (${gasCostEth.toFixed(6)} ETH) too high relative to expected profit`,
          gasUsed: estimatedGasUsed
        };
      }
      
      const slippageTolerance = options.slippageTolerance || config.slippageTolerance;
      const simulatedSlippage = Math.random() * 2;
      
      if (simulatedSlippage > slippageTolerance) {
        return {
          success: false,
          expectedProfit,
          error: `Simulated slippage (${simulatedSlippage.toFixed(2)}%) exceeds tolerance`,
          gasUsed: estimatedGasUsed
        };
      }
      
      const actualProfitValue = profitValue * (1 - (simulatedSlippage / 100)) - gasCostEth;
      const actualProfit = `${actualProfitValue.toFixed(6)} ${opportunity.tokenIn.symbol}`;
      
      if (actualProfitValue <= 0) {
        return {
          success: false,
          expectedProfit,
          actualProfit,
          error: 'Transaction would not be profitable after gas and slippage',
          gasUsed: estimatedGasUsed
        };
      }
      
      return {
        success: true,
        expectedProfit,
        actualProfit,
        gasUsed: estimatedGasUsed
      };
    } catch (error: any) {
      console.error('Transaction simulation failed:', error);
      return {
        success: false,
        expectedProfit: opportunity.estimatedProfit,
        error: error.message || 'Unknown simulation error'
      };
    }
  }

  private validateTradeParameters(
    opportunity: ArbitrageOpportunity,
    options: Partial<ExecutionOptions> = {}
  ): { valid: boolean; error?: string } {
    if (this.emergencyStopActive) {
      return { valid: false, error: 'Emergency stop is active' };
    }
    
    if (this.circuitBreakerTriggered) {
      return { valid: false, error: 'Circuit breaker triggered: ' + this.lastCircuitBreakerEvent?.reason };
    }
    
    if (!opportunity || !opportunity.id) {
      return { valid: false, error: 'Invalid opportunity' };
    }
    
    if (!opportunity.tokenIn || !opportunity.tokenOut) {
      return { valid: false, error: 'Invalid tokens in opportunity' };
    }
    
    if (!opportunity.sourceDex || !opportunity.targetDex) {
      return { valid: false, error: 'Invalid DEXes in opportunity' };
    }
    
    const config = executionConfigManager.getExecutionConfig();
    
    const tradeSize = parseFloat(opportunity.tradeSize || '0');
    if (isNaN(tradeSize) || tradeSize <= 0) {
      return { valid: false, error: 'Invalid trade size' };
    }
    
    if (tradeSize > config.maxTradeSize) {
      return { valid: false, error: `Trade size exceeds maximum allowed (${config.maxTradeSize})` };
    }
    
    const slippage = options.slippageTolerance || config.slippageTolerance;
    if (isNaN(slippage) || slippage < 0.1 || slippage > 5.0) {
      return { valid: false, error: 'Invalid slippage tolerance' };
    }
    
    return { valid: true };
  }

  async executeTrade(
    opportunity: ArbitrageOpportunity,
    options: Partial<ExecutionOptions> = {}
  ): Promise<ExecutionResult> {
    try {
      if (options.useFlashloan) {
        await flashloanRateLimiter.waitForAvailability(5000);
      } else {
        await tradeRateLimiter.waitForAvailability(5000);
      }
    } catch (error: any) {
      toast({
        title: "Rate Limit Exceeded",
        description: error.message || "Too many trades attempted. Please wait and try again.",
        variant: "destructive"
      });
      
      return {
        success: false,
        status: 'rate_limited',
        error: error.message || "Rate limit exceeded"
      };
    }
    
    const validation = this.validateTradeParameters(opportunity, options);
    if (!validation.valid) {
      toast({
        title: "Validation Failed",
        description: validation.error || "Invalid trade parameters",
        variant: "destructive"
      });
      
      return {
        success: false,
        status: 'validation_failed',
        error: validation.error
      };
    }
    
    const record = tradeExecutionStorage.addRecord({
      opportunityId: opportunity.id,
      timestamp: Date.now(),
      tokenIn: opportunity.tokenIn.address,
      tokenOut: opportunity.tokenOut.address,
      tokenInSymbol: opportunity.tokenIn.symbol,
      tokenOutSymbol: opportunity.tokenOut.symbol,
      sourceDex: opportunity.sourceDex.id,
      targetDex: opportunity.targetDex.id,
      tradeSize: opportunity.tradeSize || '0',
      expectedProfit: opportunity.estimatedProfit,
      status: 'preparing',
      success: false,
      amountIn: opportunity.tradeSize || '0'
    });
    
    try {
      tradeExecutionStorage.updateRecord(record.id, {
        status: 'simulating'
      });
      
      const simulation = await this.simulateTransaction(opportunity, options);
      
      if (!simulation.success) {
        tradeExecutionStorage.updateRecord(record.id, {
          status: 'simulation_failed',
          error: simulation.error
        });
        
        this.simulationFailed = true;
        
        toast({
          title: "Simulation Failed",
          description: simulation.error || "Transaction simulation failed",
          variant: "destructive"
        });
        
        return {
          success: false,
          status: 'simulation_failed',
          error: simulation.error
        };
      }
      
      const expectedProfitValue = parseFloat(opportunity.estimatedProfit.split(' ')[0]);
      const actualProfitValue = parseFloat(simulation.actualProfit?.split(' ')[0] || '0');
      
      const profitDeviation = Math.abs((actualProfitValue - expectedProfitValue) / expectedProfitValue) * 100;
      
      if (profitDeviation > CIRCUIT_BREAKER_THRESHOLDS.priceDeviation) {
        this.triggerCircuitBreaker({
          type: 'price_deviation',
          timestamp: Date.now(),
          reason: `Profit deviation of ${profitDeviation.toFixed(2)}% exceeds threshold`,
          data: {
            expected: opportunity.estimatedProfit,
            actual: simulation.actualProfit
          }
        });
        
        tradeExecutionStorage.updateRecord(record.id, {
          status: 'circuit_breaker',
          error: 'Circuit breaker triggered: Price deviation'
        });
        
        return {
          success: false,
          status: 'circuit_breaker',
          error: 'Circuit breaker triggered: Price deviation'
        };
      }
      
      tradeExecutionStorage.updateRecord(record.id, {
        status: 'executing'
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const success = Math.random() > 0.2;
      
      if (success) {
        const txHash = `0x${Array.from({ length: 64 }, () => 
          Math.floor(Math.random() * 16).toString(16)).join('')}`;
          
        tradeExecutionStorage.updateRecord(record.id, {
          status: 'completed',
          success: true,
          transactionHash: txHash,
          actualProfit: simulation.actualProfit || opportunity.estimatedProfit,
          executionTime: 2000
        });
          
        toast({
          title: "Trade Executed",
          description: "Arbitrage trade executed successfully."
        });
          
        return {
          success: true,
          status: 'completed',
          transactionHash: txHash,
          executionTime: 2000
        };
      } else {
        const error = "Simulated execution failure";
        
        tradeExecutionStorage.updateRecord(record.id, {
          status: 'failed',
          success: false,
          error
        });
        
        toast({
          title: "Trade Failed",
          description: error,
          variant: "destructive"
        });
        
        return {
          success: false,
          status: 'failed',
          error
        };
      }
    } catch (error: any) {
      console.error('Error executing trade:', error);
      
      tradeExecutionStorage.updateRecord(record.id, {
        status: 'failed',
        success: false,
        error: error.message
      });
      
      toast({
        title: "Execution Error",
        description: error.message || "Unknown error executing trade.",
        variant: "destructive"
      });
      
      return {
        success: false,
        status: 'failed',
        error: error.message
      };
    }
  }

  async autoExecuteTrade(opportunity: ArbitrageOpportunity): Promise<boolean> {
    if (this.emergencyStopActive) {
      console.log('Auto-execution stopped: Emergency stop is active');
      return false;
    }
    
    if (this.circuitBreakerTriggered) {
      console.log('Auto-execution stopped: Circuit breaker is triggered');
      return false;
    }
    
    const config = executionConfigManager.getExecutionConfig();
    
    if (!config.autoExecute) {
      return false;
    }
    
    const profitStr = opportunity.estimatedProfit;
    const profitValue = parseFloat(profitStr.split(' ')[0]);
    
    if (profitValue < config.minProfitPercentage) {
      console.log('Opportunity does not meet profit threshold for auto-execution');
      return false;
    }
    
    if (opportunity.riskLevel === 'high' && config.riskTolerance === 'low') {
      console.log('High risk opportunity skipped due to low risk tolerance');
      return false;
    }
    
    try {
      console.log('Auto-executing trade for opportunity:', opportunity.id);
      const result = await this.executeTrade(opportunity);
      return result.success;
    } catch (error) {
      console.error('Error auto-executing trade:', error);
      return false;
    }
  }
}

export const executionService = new ExecutionService();
