import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { parseEther } from 'ethers';
import { BigNumber } from 'bignumber.js';
import { IntegrationTest } from './IntegrationTest';
import { MarketConditions } from '../../types';

describe('ArbitrageFlow', () => {
  let test: IntegrationTest;

  beforeEach(async () => {
    test = new IntegrationTest();
    await test.setup();
  });

  afterEach(async () => {
    await test.teardown();
  });

  it('should execute arbitrage when profitable opportunity exists', async () => {
    const marketConditions: MarketConditions = await test.createMarketConditions({
      liquidityDepth: {
        'uniswap': {
          token0: new BigNumber('1000000'),
          token1: new BigNumber('1000000'),
          priceImpact: 0.005
        },
        'sushiswap': {
          token0: new BigNumber('800000'),
          token1: new BigNumber('800000'),
          priceImpact: 0.008
        }
      },
      spreadAnalysis: {
        bestBid: new BigNumber('1000'),
        bestAsk: new BigNumber('990'),
        averageSpread: 1
      }
    });

    const networkState = await test.createNetworkState({
      congestionLevel: 30, // Low congestion
      averageGasPrice: parseEther('0.000000002').toString() // 2 gwei
    });

    const context = test.getContext();
    const { systemOrchestrator } = context;

    const opportunity = await systemOrchestrator.findArbitrageOpportunity(
      marketConditions,
      networkState
    );

    expect(opportunity).toBeDefined();
    expect(opportunity?.profitability).toBeGreaterThan(0);

    const executionResult = await systemOrchestrator.executeArbitrage(opportunity!);
    expect(executionResult.success).toBe(true);
    expect(executionResult.profit).toBeGreaterThan(0);

    const transactions = await test.getSuccessfulTransactions();
    expect(transactions.length).toBe(1);
    expect(transactions[0].status).toBe('confirmed');
  });

  it('should not execute arbitrage when conditions are unfavorable', async () => {
    const marketConditions = await test.createMarketConditions({
      liquidityDepth: {
        'uniswap': {
          token0: new BigNumber('100000'),
          token1: new BigNumber('100000'),
          priceImpact: 0.02
        },
        'sushiswap': {
          token0: new BigNumber('80000'),
          token1: new BigNumber('80000'),
          priceImpact: 0.025
        }
      },
      spreadAnalysis: {
        bestBid: new BigNumber('1000'),
        bestAsk: new BigNumber('1001'),
        averageSpread: 0.1
      }
    });

    const networkState = await test.createNetworkState({
      congestionLevel: 80, // High congestion
      averageGasPrice: parseEther('0.00000005').toString() // 50 gwei
    });

    const context = test.getContext();
    const { systemOrchestrator } = context;

    const opportunity = await systemOrchestrator.findArbitrageOpportunity(
      marketConditions,
      networkState
    );

    expect(opportunity).toBeNull();
    
    const transactions = await test.getTransactions();
    expect(transactions.length).toBe(0);
  });
});
