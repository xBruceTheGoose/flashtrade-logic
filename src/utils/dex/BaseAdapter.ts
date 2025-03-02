
import { ethers } from 'ethers';
import { Token } from '@/types';
import { IDEXAdapter, DEXAdapterConfig } from './interfaces';
import { toast } from '@/components/ui/use-toast';

/**
 * Base class for DEX adapters that implements common functionality
 */
export abstract class BaseAdapter implements IDEXAdapter {
  protected chainId: number;
  protected providerOrSigner: any;
  protected config: Record<string, any>;
  protected ready: boolean = false;

  constructor(config: DEXAdapterConfig) {
    this.chainId = config.chainId;
    this.providerOrSigner = config.providerOrSigner;
    this.config = { ...config.additionalConfig };
    
    if (config.routerAddress) {
      this.config.routerAddress = config.routerAddress;
    }
    
    if (config.factoryAddress) {
      this.config.factoryAddress = config.factoryAddress;
    }
  }

  abstract getDexId(): string;
  abstract getDexName(): string;
  abstract isPairSupported(tokenA: Token, tokenB: Token): Promise<boolean>;
  abstract getTokenPrice(tokenA: Token, tokenB: Token): Promise<number>;
  abstract getExpectedOutput(tokenIn: Token, tokenOut: Token, amountIn: string): Promise<{
    amountOut: string;
    priceImpact: number;
    path?: string[];
  }>;
  abstract executeSwap(
    tokenIn: Token,
    tokenOut: Token,
    amountIn: string,
    minAmountOut: string,
    recipient: string,
    deadline?: number
  ): Promise<{
    success: boolean;
    transactionHash?: string;
    amountOut?: string;
    error?: string;
  }>;
  abstract getLiquidity(tokenA: Token, tokenB: Token): Promise<{
    token0Reserves: string;
    token1Reserves: string;
    totalLiquidityUSD: number;
  }>;
  abstract getSwapFee(tokenA: Token, tokenB: Token): Promise<number>;

  /**
   * Check if the adapter is ready to use
   */
  async isReady(): Promise<boolean> {
    return this.ready;
  }

  /**
   * Helper to convert amount from token decimals to human-readable format
   */
  protected formatUnits(amount: ethers.BigNumber, decimals: number): string {
    return ethers.utils.formatUnits(amount, decimals);
  }

  /**
   * Helper to convert amount from human-readable format to token decimals
   */
  protected parseUnits(amount: string, decimals: number): ethers.BigNumber {
    return ethers.utils.parseUnits(amount, decimals);
  }

  /**
   * Calculate price impact as a percentage
   */
  protected calculatePriceImpact(
    marketPrice: number,
    executionPrice: number
  ): number {
    if (marketPrice === 0) return 0;
    return ((marketPrice - executionPrice) / marketPrice) * 100;
  }

  /**
   * Handle errors with proper logging and user feedback
   */
  protected handleError(methodName: string, error: any): never {
    console.error(`${this.getDexName()} ${methodName} error:`, error);
    
    let errorMessage = 'Unknown error occurred';
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error.message) {
      errorMessage = error.message;
      
      // Clean up common error messages for better user experience
      if (errorMessage.includes('user rejected')) {
        errorMessage = 'Transaction rejected by user';
      } else if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for transaction';
      }
    }
    
    toast({
      variant: "destructive",
      title: "DEX Operation Failed",
      description: errorMessage
    });
    
    throw new Error(errorMessage);
  }
  
  /**
   * Approve tokens for spending if needed
   */
  protected async approveTokenIfNeeded(
    token: Token,
    spender: string,
    amount: string
  ): Promise<boolean> {
    try {
      if (!ethers.utils.isAddress(spender)) {
        throw new Error('Invalid spender address');
      }
      
      const signer = this.getSigner();
      if (!signer) {
        throw new Error('No signer available for token approval');
      }
      
      const userAddress = await signer.getAddress();
      const tokenContract = new ethers.Contract(
        token.address,
        [
          'function allowance(address owner, address spender) view returns (uint256)',
          'function approve(address spender, uint256 amount) returns (bool)'
        ],
        signer
      );
      
      // Check current allowance
      const currentAllowance = await tokenContract.allowance(userAddress, spender);
      const amountBN = this.parseUnits(amount, token.decimals);
      
      if (currentAllowance.lt(amountBN)) {
        // Need to approve
        toast({
          title: "Approval Required",
          description: `Approving ${token.symbol} for trading...`
        });
        
        const tx = await tokenContract.approve(spender, ethers.constants.MaxUint256);
        await tx.wait();
        
        toast({
          title: "Approval Successful",
          description: `${token.symbol} approved for trading`
        });
        
        return true;
      }
      
      return true; // Already approved
    } catch (error) {
      this.handleError('approveToken', error);
      return false;
    }
  }
  
  /**
   * Get signer from provider (if available)
   */
  protected getSigner(): ethers.Signer | null {
    if (this.providerOrSigner instanceof ethers.Signer) {
      return this.providerOrSigner;
    } else if (this.providerOrSigner.getSigner) {
      try {
        return this.providerOrSigner.getSigner();
      } catch (error) {
        return null;
      }
    }
    return null;
  }
}
