
import { IFlashloanProvider, FlashloanOptions, FlashloanResult, FlashloanFeeInfo, FlashloanProvider } from './types';
import { AaveFlashloanProvider } from './aave';
import { UniswapFlashloanProvider } from './uniswap';
import { Token } from '@/types';
import { blockchain } from '../blockchain';
import { toast } from '@/hooks/use-toast';

class FlashloanService {
  private providers: Record<FlashloanProvider, IFlashloanProvider> = {
    aave: new AaveFlashloanProvider(),
    uniswap: new UniswapFlashloanProvider(),
  };

  /**
   * Get all available flashloan providers
   */
  getProviders(): IFlashloanProvider[] {
    return Object.values(this.providers);
  }

  /**
   * Get a specific flashloan provider by name
   */
  getProvider(providerName: FlashloanProvider): IFlashloanProvider {
    const provider = this.providers[providerName];
    if (!provider) {
      throw new Error(`Flashloan provider '${providerName}' not found`);
    }
    return provider;
  }
  
  /**
   * Register a new flashloan provider
   */
  registerProvider(provider: IFlashloanProvider): void {
    this.providers[provider.name] = provider;
  }

  /**
   * Find the best flashloan provider for a token based on lowest fees
   */
  async findBestProvider(token: Token, amount: string): Promise<{
    provider: IFlashloanProvider;
    feeInfo: FlashloanFeeInfo;
  }> {
    const availableProviders = this.getProviders().filter(
      provider => provider.isTokenSupported(token.address)
    );

    if (availableProviders.length === 0) {
      throw new Error(`No flashloan providers support token ${token.symbol}`);
    }

    // Get fee information from all providers
    const feePromises = availableProviders.map(provider => 
      provider.getFee(token, amount)
        .catch(error => {
          console.warn(`Error getting fee from ${provider.name}:`, error);
          return null;
        })
    );

    const feeInfos = (await Promise.all(feePromises)).filter(Boolean) as FlashloanFeeInfo[];

    if (feeInfos.length === 0) {
      throw new Error(`Failed to get fee information for token ${token.symbol}`);
    }

    // Find provider with lowest fee
    const bestFeeInfo = feeInfos.reduce((best, current) => 
      parseFloat(current.feeAmount) < parseFloat(best.feeAmount) ? current : best
    );

    const bestProvider = this.getProvider(bestFeeInfo.provider);

    return {
      provider: bestProvider,
      feeInfo: bestFeeInfo
    };
  }

  /**
   * Execute a flashloan using the specified provider
   */
  async executeFlashloan(options: FlashloanOptions): Promise<FlashloanResult> {
    try {
      // Verify wallet is connected
      if (!blockchain.isWalletConnected()) {
        throw new Error('Wallet not connected. Please connect your wallet first.');
      }

      // Get the provider
      const provider = this.getProvider(options.provider);
      
      // Perform safety checks
      if (!provider.isTokenSupported(options.token.address)) {
        throw new Error(`Token ${options.token.symbol} is not supported by ${options.provider}`);
      }

      // Get current network
      const ethersProvider = blockchain.getCurrentProvider();
      const network = await ethersProvider.getNetwork();

      // Check network support for this provider
      // This would be more detailed in a real implementation
      console.log(`Executing flashloan on network: ${network.name} (${network.chainId})`);
      
      // Get fee information to validate
      const feeInfo = await provider.getFee(options.token, options.amount);
      console.log(`Flashloan fee: ${feeInfo.feeAmount} ${options.token.symbol} (${feeInfo.feePercentage * 100}%)`);
      
      // Execute the flashloan
      const result = await provider.executeFlashloan(options);
      
      // Handle result
      if (result.success) {
        toast({
          title: "Flashloan Successful",
          description: `Successfully borrowed and repaid ${options.amount} ${options.token.symbol}`,
        });
      } else {
        toast({
          title: "Flashloan Failed",
          description: result.error || "Unknown error during flashloan execution",
          variant: "destructive",
        });
      }
      
      return result;
    } catch (error: any) {
      console.error('Flashloan execution error:', error);
      
      toast({
        title: "Flashloan Error",
        description: error.message || "Failed to execute flashloan",
        variant: "destructive",
      });
      
      return {
        success: false,
        error: error.message || "Unknown error occurred",
      };
    }
  }

  /**
   * Calculate profitability of an arbitrage opportunity with flashloan costs included
   */
  async calculateArbitrageProfitability(
    token: Token,
    amount: string,
    expectedProfit: string,
    preferredProvider?: FlashloanProvider
  ): Promise<{
    isProfitable: boolean;
    netProfit: string;
    bestProvider: FlashloanProvider;
    feeAmount: string;
  }> {
    try {
      let bestProvider: IFlashloanProvider;
      let feeInfo: FlashloanFeeInfo;

      if (preferredProvider) {
        // Use the specified provider
        bestProvider = this.getProvider(preferredProvider);
        feeInfo = await bestProvider.getFee(token, amount);
      } else {
        // Find the best provider based on lowest fees
        const best = await this.findBestProvider(token, amount);
        bestProvider = best.provider;
        feeInfo = best.feeInfo;
      }

      // Calculate net profit (expected profit - flashloan fee)
      const expectedProfitValue = parseFloat(expectedProfit);
      const feeValue = parseFloat(feeInfo.feeAmount);
      const netProfit = expectedProfitValue - feeValue;

      return {
        isProfitable: netProfit > 0,
        netProfit: netProfit.toFixed(token.decimals),
        bestProvider: bestProvider.name,
        feeAmount: feeInfo.feeAmount
      };
    } catch (error: any) {
      console.error('Error calculating arbitrage profitability:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const flashloanService = new FlashloanService();

// Re-export types
export * from './types';
