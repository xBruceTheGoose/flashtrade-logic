
import { ethers } from 'ethers';
import { Token } from '@/types';
import { getWETHAddress } from './common';

// ABIs
export const UNISWAP_V2_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
  'function factory() view returns (address)'
];

export const UNISWAP_V2_FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) view returns (address pair)',
  'function feeTo() view returns (address)'
];

export const UNISWAP_V2_PAIR_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function totalSupply() view returns (uint)'
];

export const WETH_ABI = [
  'function deposit() payable',
  'function withdraw(uint) public'
];

// Default router addresses for different chains
export const getDefaultRouterAddress = (chainId: number): string => {
  // Uniswap V2 router addresses for different chains
  const routers: Record<number, string> = {
    1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Ethereum Mainnet
    3: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Ropsten
    4: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Rinkeby
    5: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Görli
    42: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Kovan
    56: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // BSC
    137: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // Polygon
    42161: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // Arbitrum
  };
  
  return routers[chainId] || routers[1]; // Default to Ethereum Mainnet
};

// Check if a token pair is supported
export const checkPairSupported = async (
  factoryContract: ethers.Contract,
  tokenA: Token,
  tokenB: Token
): Promise<boolean> => {
  try {
    const pairAddress = await factoryContract.getPair(tokenA.address, tokenB.address);
    return pairAddress !== ethers.constants.AddressZero;
  } catch (error) {
    console.error('Error checking pair support:', error);
    return false;
  }
};

// Build trading path with potential WETH intermediate
export const buildTradingPath = async (
  factoryContract: ethers.Contract | null,
  tokenIn: Token,
  tokenOut: Token,
  wethAddress: string
): Promise<string[]> => {
  // Default direct path
  let path = [tokenIn.address, tokenOut.address];
  
  // Check if direct path exists
  if (factoryContract) {
    const isPairSupported = await checkPairSupported(factoryContract, tokenIn, tokenOut);
    
    if (!isPairSupported && wethAddress) {
      // Try path through WETH
      path = [tokenIn.address, wethAddress, tokenOut.address];
    }
  }
  
  return path;
};

// Get token reserves from a liquidity pair
export const getTokenReserves = async (
  providerOrSigner: ethers.providers.Provider | ethers.Signer,
  factoryContract: ethers.Contract,
  tokenA: Token,
  tokenB: Token
): Promise<{
  token0Reserves: string;
  token1Reserves: string;
  totalLiquidityUSD: number;
}> => {
  try {
    // Get pair address
    const pairAddress = await factoryContract.getPair(tokenA.address, tokenB.address);
    
    if (pairAddress === ethers.constants.AddressZero) {
      return {
        token0Reserves: '0',
        token1Reserves: '0',
        totalLiquidityUSD: 0
      };
    }
    
    // Initialize pair contract
    const pairContract = new ethers.Contract(
      pairAddress,
      UNISWAP_V2_PAIR_ABI,
      providerOrSigner
    );
    
    // Get tokens in the pair to determine order
    const token0Address = await pairContract.token0();
    const token1Address = await pairContract.token1();
    
    // Get reserves
    const [reserve0, reserve1] = await pairContract.getReserves();
    
    // Format reserves according to decimals
    const token0 = token0Address.toLowerCase() === tokenA.address.toLowerCase() ? tokenA : tokenB;
    const token1 = token1Address.toLowerCase() === tokenA.address.toLowerCase() ? tokenA : tokenB;
    
    const token0Reserves = ethers.utils.formatUnits(reserve0, token0.decimals);
    const token1Reserves = ethers.utils.formatUnits(reserve1, token1.decimals);
    
    // Calculate total liquidity in USD if prices are available
    let totalLiquidityUSD = 0;
    if (token0.price && token1.price) {
      const reserve0USD = parseFloat(token0Reserves) * token0.price;
      const reserve1USD = parseFloat(token1Reserves) * token1.price;
      totalLiquidityUSD = reserve0USD + reserve1USD;
    }
    
    return {
      token0Reserves,
      token1Reserves,
      totalLiquidityUSD
    };
  } catch (error) {
    console.error('Error getting liquidity:', error);
    return {
      token0Reserves: '0',
      token1Reserves: '0',
      totalLiquidityUSD: 0
    };
  }
};

// Calculate expected output for a swap
export const calculateExpectedOutput = async (
  routerContract: ethers.Contract,
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  path: string[]
): Promise<{
  amountOut: string;
  priceImpact: number;
}> => {
  // Parse input amount
  const amountInBN = ethers.utils.parseUnits(amountIn, tokenIn.decimals);
  
  // Get expected output
  const amounts = await routerContract.getAmountsOut(amountInBN, path);
  const amountOut = ethers.utils.formatUnits(amounts[amounts.length - 1], tokenOut.decimals);
  
  // Calculate price impact
  // Get market price for 1 token (small amount won't have impact)
  const smallAmount = ethers.utils.parseUnits('1', tokenIn.decimals);
  const marketAmounts = await routerContract.getAmountsOut(smallAmount, path);
  const marketRate = parseFloat(ethers.utils.formatUnits(marketAmounts[marketAmounts.length - 1], tokenOut.decimals));
  
  // Calculate execution price
  const executionRate = parseFloat(amountOut) / parseFloat(amountIn);
  
  // Calculate price impact
  const priceImpact = ((marketRate - executionRate) / marketRate) * 100;
  
  return {
    amountOut,
    priceImpact: priceImpact > 0 ? priceImpact : 0
  };
};

// Execute swap with appropriate method based on tokens
export const executeSwapTransaction = async (
  routerWithSigner: ethers.Contract,
  tokenIn: Token,
  tokenOut: Token,
  wethAddress: string,
  amountInBN: ethers.BigNumber,
  minAmountOutBN: ethers.BigNumber,
  path: string[],
  recipient: string,
  deadline: number
): Promise<ethers.ContractTransaction> => {
  // Handle different swap types (ETH <> Token)
  const isETHIn = tokenIn.address.toLowerCase() === wethAddress.toLowerCase();
  const isETHOut = tokenOut.address.toLowerCase() === wethAddress.toLowerCase();
  
  let tx;
  
  if (isETHIn) {
    // ETH -> Token
    tx = await routerWithSigner.swapExactETHForTokens(
      minAmountOutBN,
      path.slice(1), // Remove WETH from path
      recipient,
      deadline,
      { value: amountInBN }
    );
  } else if (isETHOut) {
    // Token -> ETH
    tx = await routerWithSigner.swapExactTokensForETH(
      amountInBN,
      minAmountOutBN,
      path.slice(0, -1), // Remove WETH from path
      recipient,
      deadline
    );
  } else {
    // Token -> Token
    tx = await routerWithSigner.swapExactTokensForTokens(
      amountInBN,
      minAmountOutBN,
      path,
      recipient,
      deadline
    );
  }
  
  return tx;
};
