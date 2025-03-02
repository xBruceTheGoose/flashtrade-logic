import { ArbitrageOpportunity, DEX, Token } from '@/types';
import { findArbitrageOpportunities } from './dex';
import { v4 as uuidv4 } from 'uuid';
import { flashloanService, FlashloanOptions } from './flashloan';
import { blockchain } from './blockchain';
import { toast } from '@/hooks/use-toast';
import { arbitrageExecutorService } from './contracts/arbitrageExecutor';

// Calculate the estimated gas cost for an arbitrage transaction
export const estimateGasCost = async (): Promise<string> => {
  // In a real implementation, this would estimate the gas cost based on
  // current network conditions and the complexity of the arbitrage transaction
  await new Promise(resolve => setTimeout(resolve, 500));
  return '0.015 ETH';
};

// Execute an arbitrage opportunity
export const executeArbitrage = async (
  opportunity: ArbitrageOpportunity
): Promise<{ success: boolean; txHash?: string; error?: string }> => {
  console.log(`Executing arbitrage opportunity: ${opportunity.id}`);
  
  try {
    // Check if wallet is connected
    if (!blockchain.isWalletConnected()) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    // Check if we should use smart contract or direct flashloan
    const useSmartContract = await shouldUseSmartContract();
    
    if (useSmartContract) {
      return executeArbitrageViaSmartContract(opportunity);
    } else {
      return executeArbitrageViaFlashloan(opportunity);
    }
  } catch (error: any) {
    console.error('Arbitrage execution failed:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during arbitrage execution'
    };
  }
};

// Check if we should use the smart contract implementation
const shouldUseSmartContract = async (): Promise<boolean> => {
  try {
    // Check if current network has contract deployed
    const provider = blockchain.getCurrentProvider();
    const network = await provider.getNetwork();
    
    // Check if user is authorized
    const isAuthorized = await arbitrageExecutorService.isUserAuthorized();
    
    return isAuthorized;
  } catch (error) {
    console.warn('Error checking smart contract availability:', error);
    return false;
  }
};

// Execute arbitrage using the smart contract
const executeArbitrageViaSmartContract = async (
  opportunity: ArbitrageOpportunity
): Promise<{ success: boolean; txHash?: string; error?: string }> => {
  try {
    // Determine which flashloan provider to use
    // In this case, we'll default to Aave but you could implement logic to choose
    const useAave = true;
    
    // Execute the arbitrage via the smart contract
    return await arbitrageExecutorService.executeArbitrage(
      opportunity.sourceDex,
      opportunity.targetDex,
      opportunity.tokenIn,
      opportunity.tokenOut,
      opportunity.tradeSize || '1.0',
      opportunity.estimatedProfit,
      useAave
    );
  } catch (error: any) {
    console.error('Smart contract arbitrage execution failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to execute arbitrage via smart contract'
    };
  }
};

// Execute arbitrage using direct flashloan (original implementation)
const executeArbitrageViaFlashloan = async (
  opportunity: ArbitrageOpportunity
): Promise<{ success: boolean; txHash?: string; error?: string }> => {
  // Check if flashloan is needed based on the trade size
  const useFlashloan = parseFloat(opportunity.tokenIn.balance || "0") < parseFloat(opportunity.tradeSize || "0");
  
  if (useFlashloan) {
    // Calculate if the arbitrage is profitable with flashloan fees included
    const profitabilityCheck = await flashloanService.calculateArbitrageProfitability(
      opportunity.tokenIn,
      opportunity.tradeSize || "1.0", // Default to 1.0 if tradeSize is not specified
      opportunity.estimatedProfit
    );
    
    if (!profitabilityCheck.isProfitable) {
      return {
        success: false,
        error: `Not profitable after flashloan fees. Net profit: ${profitabilityCheck.netProfit} ${opportunity.tokenIn.symbol}`
      };
    }
    
    console.log(`Using flashloan from ${profitabilityCheck.bestProvider} provider`);
    console.log(`Flashloan fee: ${profitabilityCheck.feeAmount} ${opportunity.tokenIn.symbol}`);
    
    // Get wallet address
    const signer = blockchain.getSigner();
    if (!signer) {
      throw new Error("No signer available");
    }
    const address = await signer.getAddress();
    
    // Execute flashloan
    const flashloanOptions: FlashloanOptions = {
      provider: profitabilityCheck.bestProvider,
      token: opportunity.tokenIn,
      amount: opportunity.tradeSize || "1.0",
      recipient: address, // In a real implementation, this would be a contract address that handles the arbitrage
      // callbackData would contain encoded instructions for the arbitrage
    };
    
    // Execute the flashloan (in a real implementation, this would trigger the arbitrage contract)
    const flashloanResult = await flashloanService.executeFlashloan(flashloanOptions);
    
    if (!flashloanResult.success) {
      return {
        success: false,
        error: flashloanResult.error || "Flashloan execution failed"
      };
    }
    
    return {
      success: true,
      txHash: flashloanResult.transactionHash
    };
  } else {
    // Simulate the execution process with delays (regular arbitrage without flashloan)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate a 90% success rate
    const success = Math.random() > 0.1;
    
    if (success) {
      return {
        success: true,
        txHash: `0x${Array.from({ length: 64 }, () => 
          Math.floor(Math.random() * 16).toString(16)).join('')}`
      };
    } else {
      throw new Error('Transaction reverted due to price change');
    }
  }
};

// Search for arbitrage opportunities across DEXes
export const scanForArbitrageOpportunities = async (
  dexes: DEX[],
  tokens: Token[]
): Promise<ArbitrageOpportunity[]> => {
  const opportunities: ArbitrageOpportunity[] = [];
  const activeDexes = dexes.filter(dex => dex.active);
  
  // For each pair of DEXes, check for opportunities
  for (let i = 0; i < activeDexes.length; i++) {
    for (let j = i + 1; j < activeDexes.length; j++) {
      const sourceDex = activeDexes[i];
      const targetDex = activeDexes[j];
      
      // For each token, check if there's an arbitrage opportunity
      for (const tokenIn of tokens) {
        for (const tokenOut of tokens) {
          if (tokenIn.address === tokenOut.address) continue;
          
          // Check for an opportunity
          const result = await findArbitrageOpportunities(
            sourceDex.id,
            targetDex.id,
            tokenIn.address
          );
          
          if (result.hasOpportunity && result.profitPercentage > 0) {
            const gasEstimate = await estimateGasCost();
            const estimatedProfit = `${(tokenIn.price || 0) * (result.profitPercentage / 100)} USD`;
            
            // Calculate a reasonable trade size based on the opportunity
            const tradeSize = ((tokenIn.price || 1) * 1000 / (result.profitPercentage || 1)).toFixed(4);
            
            // Check if this would be profitable with flashloan fees
            let includeFlashloanFees = false;
            let netProfitAfterFees = estimatedProfit;
            
            try {
              // Determine if we would need a flashloan based on user's balance
              const needsFlashloan = parseFloat(tokenIn.balance || "0") < parseFloat(tradeSize);
              
              if (needsFlashloan) {
                includeFlashloanFees = true;
                const profitCheck = await flashloanService.calculateArbitrageProfitability(
                  tokenIn,
                  tradeSize,
                  estimatedProfit
                );
                
                if (!profitCheck.isProfitable) {
                  // Skip this opportunity if it's not profitable after flashloan fees
                  continue;
                }
                
                netProfitAfterFees = profitCheck.netProfit;
              }
            } catch (error) {
              console.warn("Error calculating flashloan profitability:", error);
              // Continue without considering flashloan
            }
            
            opportunities.push({
              id: uuidv4(),
              sourceDex,
              targetDex,
              tokenIn,
              tokenOut,
              profitPercentage: result.profitPercentage,
              estimatedProfit: includeFlashloanFees ? 
                `${netProfitAfterFees} ${tokenIn.symbol} (after fees)` : 
                estimatedProfit,
              gasEstimate,
              tradeSize,
              timestamp: Date.now(),
              status: 'pending'
            });
          }
        }
      }
    }
  }
  
  // Sort opportunities by profit percentage (descending)
  return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
};
