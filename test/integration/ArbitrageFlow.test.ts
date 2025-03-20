import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { parseEther } from 'ethers';

// Import the hardhat-chai-matchers plugin to add the event assertions
import '@nomicfoundation/hardhat-chai-matchers';

// Import the OpenZeppelin upgrades plugin
import '@openzeppelin/hardhat-upgrades';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

// Explicitly import the upgrades object
// @ts-ignore - Hardhat modules may have type issues with the current setup
import { upgrades } from '@openzeppelin/hardhat-upgrades/dist/src/index';

// We'll use type references without importing actual interfaces
// until TypeChain generates them during compilation
type TestArbitrageExecutor = any;
type SecurityManager = any;
type MockDEX = any;
type MockToken = any;

describe('Arbitrage Integration Tests', () => {
  let arbitrageExecutor: TestArbitrageExecutor;
  let securityManager: SecurityManager;
  let mockDexA: MockDEX;
  let mockDexB: MockDEX;
  let tokenA: MockToken;
  let tokenB: MockToken;
  let owner: HardhatEthersSigner;
  let trader: HardhatEthersSigner;
  
  const INITIAL_LIQUIDITY = parseEther('1000000');
  const TRADE_AMOUNT = parseEther('1000');
  
  beforeEach(async () => {
    [owner, trader] = await ethers.getSigners();
    
    // Deploy mock tokens
    const MockToken = await ethers.getContractFactory('MockToken');
    tokenA = await MockToken.deploy('Token A', 'TKA');
    tokenB = await MockToken.deploy('Token B', 'TKB');
    await tokenA.waitForDeployment();
    await tokenB.waitForDeployment();
    
    // Deploy mock DEXes
    const MockDEX = await ethers.getContractFactory('MockDEX');
    mockDexA = await MockDEX.deploy();
    mockDexB = await MockDEX.deploy();
    await mockDexA.waitForDeployment();
    await mockDexB.waitForDeployment();
    
    // Setup initial liquidity
    await tokenA.mint(await mockDexA.getAddress(), INITIAL_LIQUIDITY);
    await tokenB.mint(await mockDexA.getAddress(), INITIAL_LIQUIDITY);
    await tokenA.mint(await mockDexB.getAddress(), INITIAL_LIQUIDITY);
    await tokenB.mint(await mockDexB.getAddress(), INITIAL_LIQUIDITY);
    
    // Deploy SecurityManager
    const SecurityManager = await ethers.getContractFactory('SecurityManager');
    securityManager = await upgrades.deployProxy(SecurityManager, [
      await owner.getAddress(),
      parseEther('500'), // maxGasPrice in gwei
      100n, // rateLimit
      60n // rateLimitWindow (seconds)
    ]) as any;
    await securityManager.waitForDeployment();
    
    // Deploy TestArbitrageExecutor
    const TestArbitrageExecutor = await ethers.getContractFactory('TestArbitrageExecutor');
    arbitrageExecutor = await upgrades.deployProxy(TestArbitrageExecutor, [
      await securityManager.getAddress()
    ]) as any;
    await arbitrageExecutor.waitForDeployment();
    
    // Grant roles
    await securityManager.grantRole(await securityManager.EXECUTOR_ROLE(), await arbitrageExecutor.getAddress());
    await securityManager.grantRole(await securityManager.TRADER_ROLE(), await trader.getAddress());
  });

  describe('End-to-end trade flow', () => {
    it('should execute a profitable trade within security limits', async () => {
      // Setup price discrepancy between DEXes
      await mockDexA.setPrice(await tokenA.getAddress(), await tokenB.getAddress(), parseEther('1.05'));
      await mockDexB.setPrice(await tokenA.getAddress(), await tokenB.getAddress(), parseEther('0.95'));
      
      // Approve tokens
      await tokenA.connect(trader).approve(await arbitrageExecutor.getAddress(), TRADE_AMOUNT);
      await tokenB.connect(trader).approve(await arbitrageExecutor.getAddress(), TRADE_AMOUNT);
      
      // Execute trade
      const dexes = [await mockDexA.getAddress(), await mockDexB.getAddress()];
      const tx = await arbitrageExecutor.connect(trader).executeTrade(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        TRADE_AMOUNT,
        dexes,
        500n // minProfitBps (5%)
      );
      
      // Wait for transaction and check it succeeded
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);
    });
  });

  describe('Security and risk management', () => {
    it('should enforce rate limits', async () => {
      // Setup profitable trade
      await mockDexA.setPrice(await tokenA.getAddress(), await tokenB.getAddress(), parseEther('1.05'));
      await mockDexB.setPrice(await tokenA.getAddress(), await tokenB.getAddress(), parseEther('0.95'));
      
      // Approve tokens
      const doubleTradeAmount = TRADE_AMOUNT * 2n;
      await tokenA.connect(trader).approve(await arbitrageExecutor.getAddress(), doubleTradeAmount);
      await tokenB.connect(trader).approve(await arbitrageExecutor.getAddress(), doubleTradeAmount);
      
      const dexes = [await mockDexA.getAddress(), await mockDexB.getAddress()];
      
      // First trade should succeed
      await arbitrageExecutor.connect(trader).executeTrade(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        TRADE_AMOUNT,
        dexes,
        500n
      );
      
      // Second trade should fail due to rate limit
      // Use a try/catch pattern instead of chai matchers for reliability
      try {
        await arbitrageExecutor.connect(trader).executeTrade(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          TRADE_AMOUNT,
          dexes,
          500n
        );
        // If we get here, the test should fail because we expected a revert
        expect.fail('Expected transaction to be reverted');
      } catch (error: any) {
        // Check if the error message contains our expected string
        expect(error.message).to.include('Rate limit exceeded');
      }
    });
  });
});
