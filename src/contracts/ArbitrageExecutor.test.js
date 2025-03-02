
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("ArbitrageExecutor", function () {
  let arbitrageExecutor;
  let owner, user1, user2, feeCollector;
  let mockToken, mockAavePool, mockUniswapPool, mockUniswapRouter, mockSushiSwapRouter;
  
  const PROTOCOL_FEE_BPS = 500; // 5%
  const MIN_PROFIT_THRESHOLD = 100; // 1%
  
  beforeEach(async function () {
    // Get signers
    [owner, user1, user2, feeCollector] = await ethers.getSigners();
    
    // Deploy mock contracts
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Mock Token", "MOCK", 18);
    
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
    await arbitrageExecutor.setTokenSupport(mockToken.address, true);
    
    // Authorize user1
    await arbitrageExecutor.setUserAuthorization(user1.address, true);
  });
  
  describe("Initialization", function () {
    it("Should set the owner correctly", async function () {
      expect(await arbitrageExecutor.owner()).to.equal(owner.address);
    });
    
    it("Should set the fee collector correctly", async function () {
      expect(await arbitrageExecutor.feeCollector()).to.equal(feeCollector.address);
    });
    
    it("Should set the protocol fee correctly", async function () {
      expect(await arbitrageExecutor.protocolFeeBps()).to.equal(PROTOCOL_FEE_BPS);
    });
    
    it("Should set the min profit threshold correctly", async function () {
      expect(await arbitrageExecutor.minProfitThreshold()).to.equal(MIN_PROFIT_THRESHOLD);
    });
    
    it("Should authorize the owner", async function () {
      expect(await arbitrageExecutor.authorizedUsers(owner.address)).to.be.true;
    });
  });
  
  describe("Access Control", function () {
    it("Should allow owner to set token support", async function () {
      await arbitrageExecutor.setTokenSupport(ethers.constants.AddressZero, true);
      expect(await arbitrageExecutor.supportedTokens(ethers.constants.AddressZero)).to.be.true;
      
      await arbitrageExecutor.setTokenSupport(ethers.constants.AddressZero, false);
      expect(await arbitrageExecutor.supportedTokens(ethers.constants.AddressZero)).to.be.false;
    });
    
    it("Should not allow non-owner to set token support", async function () {
      await expect(
        arbitrageExecutor.connect(user1).setTokenSupport(ethers.constants.AddressZero, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    
    it("Should allow owner to set user authorization", async function () {
      await arbitrageExecutor.setUserAuthorization(user2.address, true);
      expect(await arbitrageExecutor.authorizedUsers(user2.address)).to.be.true;
      
      await arbitrageExecutor.setUserAuthorization(user2.address, false);
      expect(await arbitrageExecutor.authorizedUsers(user2.address)).to.be.false;
    });
    
    it("Should not allow non-owner to set user authorization", async function () {
      await expect(
        arbitrageExecutor.connect(user1).setUserAuthorization(user2.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
  
  describe("Configuration", function () {
    it("Should allow owner to set fee parameters", async function () {
      const newFeeCollector = user2.address;
      const newProtocolFeeBps = 300;
      
      await arbitrageExecutor.setFeeParameters(newFeeCollector, newProtocolFeeBps);
      
      expect(await arbitrageExecutor.feeCollector()).to.equal(newFeeCollector);
      expect(await arbitrageExecutor.protocolFeeBps()).to.equal(newProtocolFeeBps);
    });
    
    it("Should not allow setting fee above 10%", async function () {
      await expect(
        arbitrageExecutor.setFeeParameters(feeCollector.address, 1100)
      ).to.be.revertedWith("Fee too high");
    });
    
    it("Should allow owner to set min profit threshold", async function () {
      const newThreshold = 200;
      await arbitrageExecutor.setMinProfitThreshold(newThreshold);
      expect(await arbitrageExecutor.minProfitThreshold()).to.equal(newThreshold);
    });
    
    it("Should allow owner to pause/unpause the contract", async function () {
      await arbitrageExecutor.setPaused(true);
      expect(await arbitrageExecutor.paused()).to.be.true;
      
      await arbitrageExecutor.setPaused(false);
      expect(await arbitrageExecutor.paused()).to.be.false;
    });
  });
  
  describe("Token Recovery", function () {
    it("Should allow owner to recover tokens", async function () {
      // Send tokens to the contract
      const amount = ethers.utils.parseEther("100");
      await mockToken.mint(arbitrageExecutor.address, amount);
      
      // Recover tokens
      await arbitrageExecutor.recoverERC20(mockToken.address, amount);
      
      // Check balances
      expect(await mockToken.balanceOf(arbitrageExecutor.address)).to.equal(0);
      expect(await mockToken.balanceOf(owner.address)).to.equal(amount);
    });
    
    it("Should not allow non-owner to recover tokens", async function () {
      const amount = ethers.utils.parseEther("100");
      await mockToken.mint(arbitrageExecutor.address, amount);
      
      await expect(
        arbitrageExecutor.connect(user1).recoverERC20(mockToken.address, amount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
  
  // Additional tests would include flashloan execution scenarios
  // These would require complex mocking of the flashloan protocols
  // which is beyond the scope of this implementation
});
