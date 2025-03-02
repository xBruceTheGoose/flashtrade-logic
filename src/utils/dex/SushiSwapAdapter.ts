
import { Token } from '@/types';
import { DEXAdapterConfig } from './interfaces';
import { UniswapV2Adapter } from './UniswapV2Adapter';

/**
 * Adapter for SushiSwap (extends UniswapV2 since they share the same interface)
 */
export class SushiSwapAdapter extends UniswapV2Adapter {
  constructor(config: DEXAdapterConfig) {
    // If router not specified, use SushiSwap router
    if (!config.routerAddress) {
      config.routerAddress = SushiSwapAdapter.getDefaultRouterAddress(config.chainId);
    }
    super(config);
  }

  getDexId(): string {
    return 'sushiswap';
  }

  getDexName(): string {
    return 'SushiSwap';
  }

  /**
   * Get default SushiSwap router address based on chain ID
   */
  private static getDefaultRouterAddress(chainId: number): string {
    // SushiSwap router addresses for different chains
    const routers: Record<number, string> = {
      1: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', // Ethereum Mainnet
      3: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // Ropsten
      4: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // Rinkeby
      5: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // Görli
      42: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // Kovan
      56: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // BSC
      137: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // Polygon
      42161: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // Arbitrum
    };
    
    return routers[chainId] || routers[1]; // Default to Ethereum Mainnet
  }
}
