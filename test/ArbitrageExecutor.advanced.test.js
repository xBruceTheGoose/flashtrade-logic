
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("ArbitrageExecutor Advanced Tests", function () {
  let arbitrageExecutor;
  let owner, user1, user2, feeCollector;
  let mockToken, mockWETH, mockUSDC;
  let mockAavePool, mockUniswapPool, mockUniswapRouter, mockSushiSwapRouter;
  
  const PROTOCOL_FEE_BPS = 500; // 5%
  const MIN_PROFIT_THRESHOLD = 100; // 1%
  
  beforeEach(async function () {
    // Get signers
    [owner, user1, user2, feeCollector] = await ethers.getSigners();
    
    // Deploy mock tokens
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockWETH = await MockToken.deploy("Wrapped Ether", "WETH", 18);
    mockUSDC = await MockToken.deploy("USD Coin", "USDC", 6);
    
    // Deploy mock contracts
    const MockAavePool = await ethers.getContractFactory("MockAavePool");
    mockAavePool = await MockAavePool.deploy();
    
    const MockUniswapPool = await ethers.getContractFactory("MockUniswapPool");
    mockUniswapPool = await MockUniswapPool.deploy();
    
    const MockRouter = await ethers.getContractFactory("MockRouter");
    mockUniswapRouter = await MockRouter.deploy();
    mockSushiSwapRouter = await MockRouter.deploy();
    
    // Deploy ArbitrageExecutor through proxy
    const ArbitrageExecutor = await ethers.getContractFactory("ArbitrageExecutor");
    arbitrageExecutor = await upgrades.deployProxy(
      ArbitrageExecutor, 
      [
        owner.address, 
        feeCollector.address, 
        PROTOCOL_FEE_BPS, 
        MIN_PROFIT_THRESHOLD
      ]
    );
    await arbitrageExecutor.deployed();
    
    // Configure ArbitrageExecutor
    await arbitrageExecutor.configureDexRouters(
      mockUniswapRouter.address,
      mockSushiSwapRouter.address
    );
    
    await arbitrageExecutor.configureFlashloanProviders(
      mockAavePool.address,
      mockUniswapPool.address
    );
    
    // Set token support
    await arbitrageExecutor.setTokenSupport(mockWETH.address, true);
    await arbitrageExecutor.setTokenSupport(mockUSDC.address, true);
    
    // Authorize user1
    await arbitrageExecutor.setUserAuthorization(user1.address, true);
  });
  
  describe("Security Features", function () {
    it("Should allow only owner to activate emergency stop", async function () {
      await expect(
        arbitrageExecutor.connect(user1).activateEmergencyStop()
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      await arbitrageExecutor.activateEmergencyStop();
      expect(await arbitrageExecutor.emergencyStop()).to.be.true;
    });
    
    it("Should prevent actions when emergency stop is active", async function () {
      await arbitrageExecutor.activateEmergencyStop();
      
      // Mock flashloan parameters
      const tokenBorrow = mockWETH.address;
      const amount = ethers.utils.parseEther("1.0");
      const sourceDex = "uniswap";
      const targetDex = "sushiswap";
      const tradeData = ethers.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256', 'uint256'],
        [[mockWETH.address, mockUSDC.address], 0, (Math.floor(Date.now() / 1000) + 3600)]
      );
      const expectedProfit = ethers.utils.parseEther("0.01");
      
      await expect(
        arbitrageExecutor.connect(user1).executeAaveArbitrage(
          tokenBorrow,
          amount,
          sourceDex,
          targetDex,
          tradeData,
          expectedProfit
        )
      ).to.be.revertedWith("Emergency stop is active");
    });
    
    it("Should not allow unauthorized users to execute arbitrage", async function () {
      // Mock flashloan parameters
      const tokenBorrow = mockWETH.address;
      const amount = ethers.utils.parseEther("1.0");
      const sourceDex = "uniswap";
      const targetDex = "sushiswap";
      const tradeData = ethers.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256', 'uint256'],
        [[mockWETH.address, mockUSDC.address], 0, (Math.floor(Date.now() / 1000) + 3600)]
      );
      const expectedProfit = ethers.utils.parseEther("0.01");
      
      await expect(
        arbitrageExecutor.connect(user2).executeAaveArbitrage(
          tokenBorrow,
          amount,
          sourceDex,
          targetDex,
          tradeData,
          expectedProfit
        )
      ).to.be.revertedWith("Not authorized");
    });
    
    it("Should enforce daily transaction limits", async function () {
      // Set a low daily limit for user1
      const lowLimit = ethers.utils.parseEther("0.5");
      await arbitrageExecutor.setTransactionLimit(user1.address, lowLimit);
      
      // Mock flashloan parameters
      const tokenBorrow = mockWETH.address;
      const amount = ethers.utils.parseEther("1.0"); // Amount exceeds limit
      const sourceDex = "uniswap";
      const targetDex = "sushiswap";
      const tradeData = ethers.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256', 'uint256'],
        [[mockWETH.address, mockUSDC.address], 0, (Math.floor(Date.now() / 1000) + 3600)]
      );
      const expectedProfit = ethers.utils.parseEther("0.01");
      
      await expect(
        arbitrageExecutor.connect(user1).executeAaveArbitrage(
          tokenBorrow,
          amount,
          sourceDex,
          targetDex,
          tradeData,
          expectedProfit
        )
      ).to.be.revertedWith("Daily transaction limit exceeded");
    });
    
    it("Should protect against token approval vulnerabilities", async function () {
      // Try to approve too much
      const excessiveAmount = ethers.utils.parseEther("1000000");
      await arbitrageExecutor.setWalletApprovalLimit(ethers.utils.parseEther("10"));
      
      await expect(
        arbitrageExecutor.safeApprove(mockWETH.address, mockUniswapRouter.address, excessiveAmount)
      ).to.be.revertedWith("Approval exceeds limit");
      
      // Safe approval under limit should work
      const safeAmount = ethers.utils.parseEther("5");
      await arbitrageExecutor.safeApprove(mockWETH.address, mockUniswapRouter.address, safeAmount);
    });
  });
  
  describe("Circuit Breaker", function () {
    it("Should set circuit breaker parameters", async function () {
      await arbitrageExecutor.setCircuitBreakerParameters(true, 300, 5, 43200);
      
      expect(await arbitrageExecutor.circuitBreakerEnabled()).to.be.true;
      expect(await arbitrageExecutor.priceDeviationThreshold()).to.equal(300);
      expect(await arbitrageExecutor.maxFailedExecutions()).to.equal(5);
      expect(await arbitrageExecutor.circuitBreakerTimeout()).to.equal(43200);
    });
    
    it("Should reset circuit breaker", async function () {
      // This test is simplified since we can't easily simulate the circuit breaker being triggered
      await arbitrageExecutor.resetCircuitBreaker();
      expect(await arbitrageExecutor.failedExecutionCount()).to.equal(0);
    });
  });
  
  describe("Fee Collection", function () {
    it("Should set fee parameters correctly", async function () {
      const newFeeCollector = user2.address;
      const newProtocolFeeBps = 300;
      
      await arbitrageExecutor.setFeeParameters(newFeeCollector, newProtocolFeeBps);
      
      expect(await arbitrageExecutor.feeCollector()).to.equal(newFeeCollector);
      expect(await arbitrageExecutor.protocolFeeBps()).to.equal(newProtocolFeeBps);
    });
    
    it("Should not allow setting fee above max limit", async function () {
      await expect(
        arbitrageExecutor.setFeeParameters(feeCollector.address, 1100)
      ).to.be.revertedWith("Fee too high");
    });
  });
  
  describe("Token Recovery", function () {
    it("Should allow owner to recover tokens", async function () {
      // Mint tokens to the contract
      const amount = ethers.utils.parseEther("100");
      await mockWETH.mint(arbitrageExecutor.address, amount);
      
      // Initial balances
      const initialContractBalance = await mockWETH.balanceOf(arbitrageExecutor.address);
      const initialOwnerBalance = await mockWETH.balanceOf(owner.address);
      
      // Recover tokens
      await arbitrageExecutor.recoverERC20(mockWETH.address, amount);
      
      // Final balances
      const finalContractBalance = await mockWETH.balanceOf(arbitrageExecutor.address);
      const finalOwnerBalance = await mockWETH.balanceOf(owner.address);
      
      expect(finalContractBalance).to.equal(0);
      expect(finalOwnerBalance.sub(initialOwnerBalance)).to.equal(amount);
    });
  });
});
