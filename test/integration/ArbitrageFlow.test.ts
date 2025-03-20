import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TestArbitrageExecutor, SecurityManager, MockDEX, MockToken } from '../../typechain';
import { time } from '@nomicfoundation/hardhat-network-helpers';

describe('Arbitrage Integration Tests', () => {
  let arbitrageExecutor: TestArbitrageExecutor;
  let securityManager: SecurityManager;
  let mockDexA: MockDEX;
  let mockDexB: MockDEX;
  let tokenA: MockToken;
  let tokenB: MockToken;
  let owner: SignerWithAddress;
  let trader: SignerWithAddress;
  
  const INITIAL_LIQUIDITY = ethers.utils.parseEther('1000000');
  const TRADE_AMOUNT = ethers.utils.parseEther('1000');
  
  beforeEach(async () => {
    [owner, trader] = await ethers.getSigners();
    
    // Deploy mock tokens
    const MockToken = await ethers.getContractFactory('MockToken');
    tokenA = await MockToken.deploy('Token A', 'TKA');
    tokenB = await MockToken.deploy('Token B', 'TKB');
    await tokenA.deployed();
    await tokenB.deployed();
    
    // Deploy mock DEXes
    const MockDEX = await ethers.getContractFactory('MockDEX');
    mockDexA = await MockDEX.deploy();
    mockDexB = await MockDEX.deploy();
    await mockDexA.deployed();
    await mockDexB.deployed();
    
    // Setup initial liquidity
    await tokenA.mint(mockDexA.address, INITIAL_LIQUIDITY);
    await tokenB.mint(mockDexA.address, INITIAL_LIQUIDITY);
    await tokenA.mint(mockDexB.address, INITIAL_LIQUIDITY);
    await tokenB.mint(mockDexB.address, INITIAL_LIQUIDITY);
    
    // Deploy SecurityManager
    const SecurityManager = await ethers.getContractFactory('SecurityManager');
    securityManager = await upgrades.deployProxy(SecurityManager, [
      owner.address,
      ethers.utils.parseUnits('500', 'gwei'), // maxGasPrice
      100, // rateLimit
      60 // rateLimitWindow (seconds)
    ]) as SecurityManager;
    await securityManager.deployed();
    
    // Deploy TestArbitrageExecutor
    const TestArbitrageExecutor = await ethers.getContractFactory('TestArbitrageExecutor');
    arbitrageExecutor = await upgrades.deployProxy(TestArbitrageExecutor, [
      securityManager.address
    ]) as TestArbitrageExecutor;
    await arbitrageExecutor.deployed();
    
    // Grant OPERATOR_ROLE to ArbitrageExecutor
    await securityManager.grantRole(
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OPERATOR_ROLE")),
      arbitrageExecutor.address
    );
  });

  describe('End-to-end trade flow', () => {
    it('should execute a profitable trade within security limits', async () => {
      // Setup price discrepancy between DEXes
      await mockDexA.setPrice(tokenA.address, tokenB.address, ethers.utils.parseEther('1.05'));
      await mockDexB.setPrice(tokenA.address, tokenB.address, ethers.utils.parseEther('0.95'));
      
      // Fund trader
      await tokenA.mint(trader.address, TRADE_AMOUNT);
      await tokenA.connect(trader).approve(arbitrageExecutor.address, TRADE_AMOUNT);
      
      const initialBalance = await tokenA.balanceOf(trader.address);
      
      // Execute trade
      const tradeTx = await arbitrageExecutor.connect(trader).executeTrade(
        tokenA.address,
        tokenB.address,
        TRADE_AMOUNT,
        [mockDexA.address, mockDexB.address],
        100 // 1% minimum profit
      );
      
      const receipt = await tradeTx.wait();
      expect(receipt.status).to.equal(1);
      
      // Verify profit
      const finalBalance = await tokenA.balanceOf(trader.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it('should handle multiple concurrent opportunities', async () => {
      // Setup multiple profitable paths
      await mockDexA.setPrice(tokenA.address, tokenB.address, ethers.utils.parseEther('1.05'));
      await mockDexB.setPrice(tokenA.address, tokenB.address, ethers.utils.parseEther('0.95'));
      
      // Fund multiple traders
      const traders = await ethers.getSigners();
      const traderCount = 3;
      
      for (let i = 0; i < traderCount; i++) {
        await tokenA.mint(traders[i].address, TRADE_AMOUNT);
        await tokenA.connect(traders[i]).approve(arbitrageExecutor.address, TRADE_AMOUNT);
      }
      
      // Execute concurrent trades
      const trades = await Promise.all(
        traders.slice(0, traderCount).map(trader =>
          arbitrageExecutor.connect(trader).executeTrade(
            tokenA.address,
            tokenB.address,
            TRADE_AMOUNT,
            [mockDexA.address, mockDexB.address],
            100 // 1% minimum profit
          )
        )
      );
      
      // Verify all trades succeeded
      for (const trade of trades) {
        const receipt = await trade.wait();
        expect(receipt.status).to.equal(1);
      }
    });

    it('should respect rate limits', async () => {
      // Setup profitable trade condition
      await mockDexA.setPrice(tokenA.address, tokenB.address, ethers.utils.parseEther('1.05'));
      await mockDexB.setPrice(tokenA.address, tokenB.address, ethers.utils.parseEther('0.95'));
      
      // Fund trader
      await tokenA.mint(trader.address, TRADE_AMOUNT.mul(2));
      await tokenA.connect(trader).approve(arbitrageExecutor.address, TRADE_AMOUNT.mul(2));
      
      // Execute first trade
      await arbitrageExecutor.connect(trader).executeTrade(
        tokenA.address,
        tokenB.address,
        TRADE_AMOUNT,
        [mockDexA.address, mockDexB.address],
        100 // 1% minimum profit
      );

      // Attempt second trade immediately
      await expect(
        arbitrageExecutor.connect(trader).executeTrade(
          tokenA.address,
          tokenB.address,
          TRADE_AMOUNT,
          [mockDexA.address, mockDexB.address],
          100 // 1% minimum profit
        )
      ).to.be.revertedWith('Rate limit exceeded');
      
      // Wait for rate limit window
      await time.increase(61);
      
      // Third trade should succeed
      const tradeTx = await arbitrageExecutor.connect(trader).executeTrade(
        tokenA.address,
        tokenB.address,
        TRADE_AMOUNT,
        [mockDexA.address, mockDexB.address],
        100 // 1% minimum profit
      );
      const receipt = await tradeTx.wait();
      expect(receipt.status).to.equal(1);
    });

    it('should adapt to changing market conditions', async () => {
      // Initial profitable setup
      await mockDexA.setPrice(tokenA.address, tokenB.address, ethers.utils.parseEther('1.05'));
      await mockDexB.setPrice(tokenA.address, tokenB.address, ethers.utils.parseEther('0.95'));
      
      // Fund trader
      await tokenA.mint(trader.address, TRADE_AMOUNT.mul(2));
      await tokenA.connect(trader).approve(arbitrageExecutor.address, TRADE_AMOUNT.mul(2));
      
      // First trade with profit
      const trade1 = await arbitrageExecutor.connect(trader).executeTrade(
        tokenA.address,
        tokenB.address,
        TRADE_AMOUNT,
        [mockDexA.address, mockDexB.address],
        100 // 1% minimum profit
      );
      expect((await trade1.wait()).status).to.equal(1);
      
      // Change market conditions
      await mockDexA.setPrice(tokenA.address, tokenB.address, ethers.utils.parseEther('1.00'));
      await mockDexB.setPrice(tokenA.address, tokenB.address, ethers.utils.parseEther('1.00'));
      
      // Wait for rate limit
      await time.increase(61);
      
      // Second trade should fail due to insufficient profit
      await expect(
        arbitrageExecutor.connect(trader).executeTrade(
          tokenA.address,
          tokenB.address,
          TRADE_AMOUNT,
          [mockDexA.address, mockDexB.address],
          100 // 1% minimum profit
        )
      ).to.be.revertedWith('Insufficient profit');
    });
  });

  describe('Security and risk management', () => {
    it('should enforce gas price limits', async () => {
      await mockDexA.setPrice(tokenA.address, tokenB.address, ethers.utils.parseEther('1.05'));
      await mockDexB.setPrice(tokenA.address, tokenB.address, ethers.utils.parseEther('0.95'));
      
      await tokenA.mint(trader.address, TRADE_AMOUNT);
      await tokenA.connect(trader).approve(arbitrageExecutor.address, TRADE_AMOUNT);
      
      // Attempt trade with high gas price
      await expect(
        arbitrageExecutor.connect(trader).executeTrade(
          tokenA.address,
          tokenB.address,
          TRADE_AMOUNT,
          [mockDexA.address, mockDexB.address],
          100, // 1% minimum profit
          { gasPrice: ethers.utils.parseUnits('600', 'gwei') }
        )
      ).to.be.revertedWith('Gas price too high');
    });

    it('should handle emergency shutdown gracefully', async () => {
      await mockDexA.setPrice(tokenA.address, tokenB.address, ethers.utils.parseEther('1.05'));
      await mockDexB.setPrice(tokenA.address, tokenB.address, ethers.utils.parseEther('0.95'));
      
      await tokenA.mint(trader.address, TRADE_AMOUNT);
      await tokenA.connect(trader).approve(arbitrageExecutor.address, TRADE_AMOUNT);
      
      // Trigger emergency shutdown
      await securityManager.emergencyShutdown();
      
      // Verify all trading is halted
      await expect(
        arbitrageExecutor.connect(trader).executeTrade(
          tokenA.address,
          tokenB.address,
          TRADE_AMOUNT,
          [mockDexA.address, mockDexB.address],
          100 // 1% minimum profit
        )
      ).to.be.revertedWith('Pausable: paused');
      
      // Resume trading
      await securityManager.resume();
      
      // Verify trading resumes successfully
      const tradeTx = await arbitrageExecutor.connect(trader).executeTrade(
        tokenA.address,
        tokenB.address,
        TRADE_AMOUNT,
        [mockDexA.address, mockDexB.address],
        100 // 1% minimum profit
      );
      const receipt = await tradeTx.wait();
      expect(receipt.status).to.equal(1);
    });
  });
});
