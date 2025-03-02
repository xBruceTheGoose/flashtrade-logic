
import { ethers } from 'ethers';
import { IFlashloanProvider, FlashloanOptions, FlashloanResult, FlashloanFeeInfo } from './types';
import { Token } from '@/types';
import { blockchain, convertUnits } from '../blockchain';
import { toast } from '@/hooks/use-toast';

// Simplified ABI for Aave FlashLoan
const AAVE_LENDING_POOL_ABI = [
  'function flashLoan(address receiverAddress, address[] calldata assets, uint256[] calldata amounts, uint256[] calldata modes, address onBehalfOf, bytes calldata params, uint16 referralCode) external',
  'function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128)',
];

// Aave V3 Lending Pool addresses for different networks
const AAVE_LENDING_POOL_ADDRESSES: Record<number, string> = {
  1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // Ethereum Mainnet
  137: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', // Polygon
  42161: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', // Arbitrum
  10: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', // Optimism
};

export class AaveFlashloanProvider implements IFlashloanProvider {
  name = 'aave' as const;
  supportedTokens: string[] = [
    // Common tokens supported by Aave
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
    '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
  ];

  isTokenSupported(tokenAddress: string): boolean {
    return this.supportedTokens.includes(tokenAddress.toLowerCase());
  }

  async getFee(token: Token, amount: string): Promise<FlashloanFeeInfo> {
    try {
      const provider = blockchain.getCurrentProvider();
      const chainId = (await provider.getNetwork()).chainId;
      const lendingPoolAddress = AAVE_LENDING_POOL_ADDRESSES[chainId];
      
      if (!lendingPoolAddress) {
        throw new Error(`Aave is not supported on network: ${chainId}`);
      }

      const lendingPool = new ethers.Contract(
        lendingPoolAddress,
        AAVE_LENDING_POOL_ABI,
        provider
      );

      // Get the premium percentage from the contract
      let feePercentage = 0.0009; // Default 0.09% if contract call fails
      try {
        const premium = await lendingPool.FLASHLOAN_PREMIUM_TOTAL();
        feePercentage = premium.toNumber() / 10000; // Convert from basis points
      } catch (error) {
        console.warn('Failed to get Aave premium, using default:', error);
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
      console.error('Error calculating Aave flashloan fee:', error);
      throw error;
    }
  }

  async executeFlashloan(options: FlashloanOptions): Promise<FlashloanResult> {
    try {
      const { token, amount, recipient, callbackData = '0x', referralCode = 0 } = options;
      const provider = blockchain.getCurrentProvider();
      const chainId = (await provider.getNetwork()).chainId;
      const lendingPoolAddress = AAVE_LENDING_POOL_ADDRESSES[chainId];
      
      if (!lendingPoolAddress) {
        throw new Error(`Aave is not supported on network: ${chainId}`);
      }

      // Make sure there's a signer
      const signer = blockchain.getSigner();
      if (!signer) {
        throw new Error('No signer available. Please connect your wallet.');
      }

      // Verify token is supported
      if (!this.isTokenSupported(token.address)) {
        throw new Error(`Token ${token.symbol} is not supported for Aave flashloans.`);
      }

      // Get fee info to verify it's profitable
      const feeInfo = await this.getFee(token, amount);
      
      const lendingPool = new ethers.Contract(
        lendingPoolAddress,
        AAVE_LENDING_POOL_ABI,
        signer
      );

      // Prepare the flashloan parameters
      const assets = [token.address];
      const amounts = [ethers.utils.parseUnits(amount, token.decimals)];
      const modes = [0]; // 0 = no debt, flashloan must be repaid in the same transaction
      const onBehalfOf = recipient; // The contract or address that will receive the funds

      // Execute the flashloan
      const tx = await lendingPool.flashLoan(
        recipient,
        assets,
        amounts,
        modes,
        onBehalfOf,
        callbackData,
        referralCode,
        {
          gasLimit: 2000000, // Adjust gas limit as needed
        }
      );

      toast({
        title: "Flashloan Initiated",
        description: `Borrowing ${amount} ${token.symbol} from Aave...`,
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
      console.error('Aave flashloan execution error:', error);
      
      // Provide more specific error message
      let errorMessage = 'Failed to execute Aave flashloan.';
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
