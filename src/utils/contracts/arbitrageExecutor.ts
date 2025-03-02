
import { ethers } from 'ethers';
import { Token, DEX } from '@/types';
import { blockchain } from '../blockchain';
import { toast } from '@/hooks/use-toast';

// ABI for the ArbitrageExecutor contract
const ARBITRAGE_EXECUTOR_ABI = [
  'function executeAaveArbitrage(address tokenBorrow, uint256 amount, string sourceDex, string targetDex, bytes tradeData, uint256 expectedProfit) external',
  'function executeUniswapArbitrage(address tokenBorrow, uint256 amount, string sourceDex, string targetDex, bytes tradeData, uint256 expectedProfit) external',
  'function authorizedUsers(address) external view returns (bool)',
  'function supportedTokens(address) external view returns (bool)',
  'function minProfitThreshold() external view returns (uint256)'
];

// Contract addresses for different networks
const CONTRACT_ADDRESSES: Record<number, string> = {
  1: '0x1234567890123456789012345678901234567890', // Mainnet (placeholder)
  5: '0x1234567890123456789012345678901234567890', // Goerli (placeholder)
  137: '0x1234567890123456789012345678901234567890', // Polygon (placeholder)
  42161: '0x1234567890123456789012345678901234567890', // Arbitrum (placeholder)
};

/**
 * Class to interact with the ArbitrageExecutor smart contract
 */
export class ArbitrageExecutorService {
  private contract: ethers.Contract | null = null;
  
  /**
   * Initialize the contract instance
   */
  private async initContract(): Promise<ethers.Contract> {
    if (this.contract) return this.contract;
    
    try {
      const provider = blockchain.getCurrentProvider();
      const chainId = (await provider.getNetwork()).chainId;
      const contractAddress = CONTRACT_ADDRESSES[chainId];
      
      if (!contractAddress) {
        throw new Error(`ArbitrageExecutor not deployed on network: ${chainId}`);
      }
      
      // Get signer if available, otherwise use provider
      const signerOrProvider = blockchain.getSigner() || provider;
      
      this.contract = new ethers.Contract(
        contractAddress,
        ARBITRAGE_EXECUTOR_ABI,
        signerOrProvider
      );
      
      return this.contract;
    } catch (error) {
      console.error('Failed to initialize ArbitrageExecutor contract:', error);
      throw error;
    }
  }
  
  /**
   * Check if the current user is authorized to use the contract
   */
  async isUserAuthorized(address?: string): Promise<boolean> {
    try {
      const contract = await this.initContract();
      
      // Use provided address or get from connected wallet
      const userAddress = address || await blockchain.getWalletAddress();
      if (!userAddress) return false;
      
      return await contract.authorizedUsers(userAddress);
    } catch (error) {
      console.error('Error checking user authorization:', error);
      return false;
    }
  }
  
  /**
   * Check if a token is supported for flashloans
   */
  async isTokenSupported(tokenAddress: string): Promise<boolean> {
    try {
      const contract = await this.initContract();
      return await contract.supportedTokens(tokenAddress);
    } catch (error) {
      console.error('Error checking token support:', error);
      return false;
    }
  }
  
  /**
   * Get minimum profit threshold (in basis points)
   */
  async getMinProfitThreshold(): Promise<number> {
    try {
      const contract = await this.initContract();
      const threshold = await contract.minProfitThreshold();
      return threshold.toNumber();
    } catch (error) {
      console.error('Error getting min profit threshold:', error);
      return 0;
    }
  }
  
  /**
   * Execute an arbitrage trade using a flashloan
   */
  async executeArbitrage(
    sourceDex: DEX,
    targetDex: DEX,
    tokenIn: Token,
    tokenOut: Token,
    amount: string,
    expectedProfit: string,
    useAave: boolean = true
  ): Promise<{
    success: boolean;
    transactionHash?: string;
    error?: string;
  }> {
    try {
      // Check if wallet is connected
      if (!blockchain.isWalletConnected()) {
        throw new Error("Wallet not connected");
      }
      
      // Initialize contract
      const contract = await this.initContract();
      
      // Check if user is authorized
      const authorized = await this.isUserAuthorized();
      if (!authorized) {
        throw new Error("User not authorized to execute arbitrage");
      }
      
      // Check if token is supported
      const tokenSupported = await this.isTokenSupported(tokenIn.address);
      if (!tokenSupported) {
        throw new Error(`Token ${tokenIn.symbol} not supported for flashloan`);
      }
      
      // Prepare trade data
      // This is simplified - in a real implementation, you'd encode specific paths and parameters
      const path = [tokenIn.address, tokenOut.address];
      const amountOutMin = 0; // In a real implementation, this would include slippage protection
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now
      
      const tradeData = ethers.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256', 'uint256'],
        [path, amountOutMin, deadline]
      );
      
      // Parse amount to wei
      const amountInWei = ethers.utils.parseUnits(amount, tokenIn.decimals);
      
      // Parse expected profit
      const expectedProfitInWei = ethers.utils.parseUnits(expectedProfit, tokenIn.decimals);
      
      // Prepare transaction
      let tx;
      if (useAave) {
        tx = await contract.executeAaveArbitrage(
          tokenIn.address,
          amountInWei,
          sourceDex.id,
          targetDex.id,
          tradeData,
          expectedProfitInWei,
          {
            gasLimit: 3000000, // Adjust as needed
          }
        );
      } else {
        tx = await contract.executeUniswapArbitrage(
          tokenIn.address,
          amountInWei,
          sourceDex.id,
          targetDex.id,
          tradeData,
          expectedProfitInWei,
          {
            gasLimit: 3000000, // Adjust as needed
          }
        );
      }
      
      toast({
        title: "Arbitrage Initiated",
        description: `Executing arbitrage between ${sourceDex.name} and ${targetDex.name} for ${amount} ${tokenIn.symbol}`,
      });
      
      // Wait for transaction to confirm
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        toast({
          title: "Arbitrage Successful",
          description: `Successfully executed arbitrage trade`,
        });
        
        return {
          success: true,
          transactionHash: receipt.transactionHash,
        };
      } else {
        return {
          success: false,
          transactionHash: receipt.transactionHash,
          error: "Transaction failed",
        };
      }
    } catch (error: any) {
      console.error('Error executing arbitrage:', error);
      
      // Extract error message
      let errorMessage = "Unknown error executing arbitrage";
      if (error.message) {
        errorMessage = error.message;
        
        // Clean up common ethers error messages
        if (error.message.includes("user rejected transaction")) {
          errorMessage = "Transaction rejected by user";
        } else if (error.message.includes("execution reverted")) {
          // Try to extract revert reason
          const revertReason = error.message.match(/reason="([^"]+)"/);
          if (revertReason && revertReason[1]) {
            errorMessage = revertReason[1];
          } else {
            errorMessage = "Transaction reverted by contract";
          }
        }
      }
      
      toast({
        title: "Arbitrage Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

// Export singleton instance
export const arbitrageExecutorService = new ArbitrageExecutorService();
