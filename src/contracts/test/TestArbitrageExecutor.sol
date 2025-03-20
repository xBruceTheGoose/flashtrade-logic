// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "../security/SecurityManager.sol";

interface IMockDEX {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut);
}

contract TestArbitrageExecutor is 
    Initializable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable,
    PausableUpgradeable 
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    SecurityManager public securityManager;
    uint256 public constant BPS_DENOMINATOR = 10000;

    event ArbitrageExecuted(
        address indexed trader,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _securityManager) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        
        require(_securityManager != address(0), "Invalid security manager");
        securityManager = SecurityManager(_securityManager);
    }

    function executeTrade(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address[] calldata dexes,
        uint256 minProfitBps
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(dexes.length >= 2, "Minimum 2 DEXes required");
        require(tokenIn != address(0) && tokenOut != address(0), "Invalid tokens");
        require(amountIn > 0, "Invalid amount");

        // Security checks through SecurityManager
        require(
            tx.origin == msg.sender,
            "Only EOA can execute trades"
        );

        // Transfer tokens from trader
        IERC20Upgradeable(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Execute first swap
        IERC20Upgradeable(tokenIn).safeApprove(dexes[0], amountIn);
        uint256 intermediateAmount = IMockDEX(dexes[0]).swap(
            tokenIn,
            tokenOut,
            amountIn,
            0, // No min amount for test
            address(this)
        );

        // Execute second swap back to original token
        IERC20Upgradeable(tokenOut).safeApprove(dexes[1], intermediateAmount);
        uint256 finalAmount = IMockDEX(dexes[1]).swap(
            tokenOut,
            tokenIn,
            intermediateAmount,
            0, // No min amount for test
            address(this)
        );

        // Calculate and verify profit
        require(finalAmount > amountIn, "No profit generated");
        uint256 profitBps = ((finalAmount - amountIn) * BPS_DENOMINATOR) / amountIn;
        require(profitBps >= minProfitBps, "Insufficient profit");

        // Transfer profit back to trader
        IERC20Upgradeable(tokenIn).safeTransfer(msg.sender, finalAmount);

        emit ArbitrageExecuted(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            finalAmount,
            profitBps
        );

        return finalAmount;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
