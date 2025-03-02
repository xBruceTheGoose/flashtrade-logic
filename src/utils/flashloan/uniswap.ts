
import { ethers } from 'ethers';
import { IFlashloanProvider, FlashloanOptions, FlashloanResult, FlashloanFeeInfo } from './types';
import { Token } from '@/types';
import { blockchain } from '../blockchain';
import { toast } from '@/hooks/use-toast';

// Simplified ABI for Uniswap V3 Flash
const UNISWAP_FLASH_ABI = [
  'function flash(address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external',
  'function fee() external view returns (uint24)',
];

// Mapping of token addresses to pool addresses for common pairs
const UNISWAP_POOL_ADDRESSES: Record<string, Record<number, string>> = {
  // WETH-USDC pool addresses by chain ID
  'WETH-USDC': {
    1: '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8', // Ethereum Mainnet
    137: '0x45dDa9cb7c25131DF268515131f647d726f50608', // Polygon
    42161: '0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443', // Arbitrum
    10: '0x85149247691df622eaF1a8Bd0CaFd40BC45154a9', // Optimism
  },
  // Add more token pairs as needed
};

export class UniswapFlashloanProvider implements IFlashloanProvider {
  name = 'uniswap' as const;
  supportedTokens: string[] = [
    // Common tokens supported by Uniswap
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
    '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
  ];

  isTokenSupported(tokenAddress: string): boolean {
    return this.supportedTokens.includes(tokenAddress.toLowerCase());
  }

  // Helper to find appropriate Uniswap pool for a token
  private async getPoolAddress(token: Token, chainId: number): Promise<string> {
    // In a real implementation, you'd likely query the Uniswap factory
    // or use the Uniswap SDK to find the appropriate pool
    
    // For this demo, we're using a simplified approach with predefined pools
    const poolKey = token.symbol === 'WETH' || token.symbol === 'ETH' 
      ? 'WETH-USDC' 
      : `${token.symbol}-WETH`;
      
    const poolAddress = UNISWAP_POOL_ADDRESSES[poolKey]?.[chainId];
    
    if (!poolAddress) {
      throw new Error(`No Uniswap pool found for ${token.symbol} on network ${chainId}`);
    }
    
    return poolAddress;
  }

  async getFee(token: Token, amount: string): Promise<FlashloanFeeInfo> {
    try {
      const provider = blockchain.getCurrentProvider();
      const chainId = (await provider.getNetwork()).chainId;
      
      try {
        const poolAddress = await this.getPoolAddress(token, chainId);
        const pool = new ethers.Contract(poolAddress, UNISWAP_FLASH_ABI, provider);

        // Get the pool fee
        let feePercentage = 0.003; // Default 0.3% if contract call fails
        try {
          const fee = await pool.fee();
          feePercentage = fee.toNumber() / 1000000; // Convert from parts per million
        } catch (error) {
          console.warn('Failed to get Uniswap pool fee, using default:', error);
        }

        const amountInWei = ethers.utils.parseUnits(amount, token.decimals);
        const feeAmount = amountInWei.mul(Math.floor(feePercentage * 10000)).div(10000);
        const totalRequired = amountInWei.add(feeAmount);

        return {
          provider: this.name,
          token,
          amount,
          feePercentage,
          feeAmount: ethers.utils.formatUnits(feeAmount, token.decimals),
          totalRequired: ethers.utils.formatUnits(totalRequired, token.decimals),
        };
      } catch (error) {
        console.error('Error finding Uniswap pool:', error);
        throw new Error(`Failed to find suitable Uniswap pool for ${token.symbol}`);
      }
    } catch (error) {
      console.error('Error calculating Uniswap flashloan fee:', error);
      throw error;
    }
  }

  async executeFlashloan(options: FlashloanOptions): Promise<FlashloanResult> {
    try {
      const { token, amount, recipient, callbackData = '0x' } = options;
      const provider = blockchain.getCurrentProvider();
      const chainId = (await provider.getNetwork()).chainId;
      
      // Make sure there's a signer
      const signer = blockchain.getSigner();
      if (!signer) {
        throw new Error('No signer available. Please connect your wallet.');
      }

      // Verify token is supported
      if (!this.isTokenSupported(token.address)) {
        throw new Error(`Token ${token.symbol} is not supported for Uniswap flashloans.`);
      }

      // Find appropriate pool
      const poolAddress = await this.getPoolAddress(token, chainId);
      const pool = new ethers.Contract(poolAddress, UNISWAP_FLASH_ABI, signer);

      // Get fee info to verify it's profitable
      const feeInfo = await this.getFee(token, amount);
      
      // Determine if token is token0 or token1 in the pool
      // This is simplified - in a real implementation we'd query the pool
      const isToken0 = token.symbol === 'WETH'; // Assuming WETH is usually token0
      
      // Prepare the flashloan parameters
      const amount0 = isToken0 
        ? ethers.utils.parseUnits(amount, token.decimals) 
        : ethers.constants.Zero;
      const amount1 = !isToken0 
        ? ethers.utils.parseUnits(amount, token.decimals) 
        : ethers.constants.Zero;

      // Execute the flashloan
      const tx = await pool.flash(
        recipient,
        amount0,
        amount1,
        callbackData,
        {
          gasLimit: 2000000, // Adjust gas limit as needed
        }
      );

      toast({
        title: "Flashloan Initiated",
        description: `Borrowing ${amount} ${token.symbol} from Uniswap...`,
      });

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      // Check if transaction was successful
      if (receipt.status === 1) {
        return {
          success: true,
          transactionHash: receipt.transactionHash,
          fee: feeInfo.feeAmount,
          borrowed: amount,
          repaid: feeInfo.totalRequired,
        };
      } else {
        return {
          success: false,
          transactionHash: receipt.transactionHash,
          error: "Transaction failed during execution.",
        };
      }
    } catch (error: any) {
      console.error('Uniswap flashloan execution error:', error);
      
      // Provide more specific error message
      let errorMessage = 'Failed to execute Uniswap flashloan.';
      if (error.message) {
        if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds to cover flashloan fees and gas.';
        } else if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected by the user.';
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
