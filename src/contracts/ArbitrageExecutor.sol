
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

// Interfaces for DEX interactions
interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

interface ISushiSwapRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

// Interface for Aave flashloan
interface ILendingPool {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

// Interface for Uniswap flashloan
interface IUniswapV3Pool {
    function flash(
        address recipient,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external;
}

/**
 * @title ArbitrageExecutor
 * @dev Contract to execute arbitrage trades across multiple DEXes using flashloans
 */
contract ArbitrageExecutor is 
    Initializable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable,
    PausableUpgradeable 
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // Constants
    uint256 public constant MAX_BPS = 10000; // 100%
    
    // State variables
    mapping(address => bool) public authorizedUsers;
    mapping(address => bool) public supportedTokens;
    uint256 public minProfitThreshold; // Minimum profit in basis points
    address public feeCollector;
    uint256 public protocolFeeBps; // Protocol fee in basis points
    
    // DEX router addresses
    address public uniswapRouter;
    address public sushiswapRouter;
    
    // Flashloan provider addresses
    address public aaveLendingPool;
    address public uniswapV3Pool;

    // Events
    event ArbitrageExecuted(
        address indexed user,
        address indexed tokenBorrowed,
        uint256 amountBorrowed,
        uint256 profit,
        string sourceDex,
        string targetDex
    );
    
    event CircuitBreakerTriggered(
        address indexed tokenBorrowed,
        uint256 amountBorrowed,
        uint256 expectedProfit,
        uint256 actualProfit
    );
    
    event TokenSupportUpdated(address indexed token, bool isSupported);
    event UserAuthorizationUpdated(address indexed user, bool isAuthorized);
    event FeeCollected(address indexed token, uint256 amount);

    /**
     * @dev Initializer function (replaces constructor for upgradeable contracts)
     */
    function initialize(
        address _owner,
        address _feeCollector,
        uint256 _protocolFeeBps,
        uint256 _minProfitThreshold
    ) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        
        transferOwnership(_owner);
        feeCollector = _feeCollector;
        protocolFeeBps = _protocolFeeBps;
        minProfitThreshold = _minProfitThreshold;
        
        // Authorize owner by default
        authorizedUsers[_owner] = true;
    }
    
    /**
     * @dev Configure DEX routers
     */
    function configureDexRouters(
        address _uniswapRouter,
        address _sushiswapRouter
    ) external onlyOwner {
        uniswapRouter = _uniswapRouter;
        sushiswapRouter = _sushiswapRouter;
    }
    
    /**
     * @dev Configure flashloan providers
     */
    function configureFlashloanProviders(
        address _aaveLendingPool,
        address _uniswapV3Pool
    ) external onlyOwner {
        aaveLendingPool = _aaveLendingPool;
        uniswapV3Pool = _uniswapV3Pool;
    }
    
    /**
     * @dev Update token support status
     */
    function setTokenSupport(address token, bool isSupported) external onlyOwner {
        supportedTokens[token] = isSupported;
        emit TokenSupportUpdated(token, isSupported);
    }
    
    /**
     * @dev Update user authorization status
     */
    function setUserAuthorization(address user, bool isAuthorized) external onlyOwner {
        authorizedUsers[user] = isAuthorized;
        emit UserAuthorizationUpdated(user, isAuthorized);
    }
    
    /**
     * @dev Set minimum profit threshold
     */
    function setMinProfitThreshold(uint256 _minProfitThreshold) external onlyOwner {
        minProfitThreshold = _minProfitThreshold;
    }
    
    /**
     * @dev Set protocol fee and collector
     */
    function setFeeParameters(address _feeCollector, uint256 _protocolFeeBps) external onlyOwner {
        require(_protocolFeeBps <= 1000, "Fee too high"); // Max 10%
        feeCollector = _feeCollector;
        protocolFeeBps = _protocolFeeBps;
    }
    
    /**
     * @dev Emergency pause/unpause
     */
    function setPaused(bool _paused) external onlyOwner {
        if (_paused) {
            _pause();
        } else {
            _unpause();
        }
    }
    
    /**
     * @dev Execute arbitrage using Aave flashloan
     */
    function executeAaveArbitrage(
        address tokenBorrow,
        uint256 amount,
        string calldata sourceDex,
        string calldata targetDex,
        bytes calldata tradeData,
        uint256 expectedProfit
    ) external nonReentrant whenNotPaused {
        // Security checks
        require(authorizedUsers[msg.sender], "Not authorized");
        require(supportedTokens[tokenBorrow], "Token not supported");
        
        // Prepare flashloan
        address[] memory assets = new address[](1);
        assets[0] = tokenBorrow;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0; // No debt, pay all at once

        // Pack trade parameters into flashloan callback data
        bytes memory params = abi.encode(
            msg.sender,
            sourceDex,
            targetDex,
            tradeData,
            expectedProfit
        );
        
        // Execute flashloan
        ILendingPool(aaveLendingPool).flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            params,
            0 // referral code
        );
    }
    
    /**
     * @dev Execute arbitrage using Uniswap flashloan
     */
    function executeUniswapArbitrage(
        address tokenBorrow,
        uint256 amount,
        string calldata sourceDex,
        string calldata targetDex,
        bytes calldata tradeData,
        uint256 expectedProfit
    ) external nonReentrant whenNotPaused {
        // Security checks
        require(authorizedUsers[msg.sender], "Not authorized");
        require(supportedTokens[tokenBorrow], "Token not supported");
        
        // Pack trade parameters into flashloan callback data
        bytes memory data = abi.encode(
            msg.sender,
            tokenBorrow,
            sourceDex,
            targetDex,
            tradeData,
            expectedProfit
        );
        
        // Determine token0/token1 based on the pool configuration
        // This is simplified - in a real implementation, you'd need to know the token order
        uint256 amount0 = tokenBorrow == getToken0Address() ? amount : 0;
        uint256 amount1 = tokenBorrow == getToken1Address() ? amount : 0;
        
        // Execute flashloan
        IUniswapV3Pool(uniswapV3Pool).flash(
            address(this),
            amount0,
            amount1,
            data
        );
    }
    
    /**
     * @dev Callback function for Aave flashloan
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        require(msg.sender == aaveLendingPool, "Unauthorized callback");
        require(initiator == address(this), "Unauthorized initiator");
        
        // Decode trade parameters
        (
            address user,
            string memory sourceDex,
            string memory targetDex,
            bytes memory tradeData,
            uint256 expectedProfit
        ) = abi.decode(params, (address, string, string, bytes, uint256));
        
        // Get borrowed token and amount
        address token = assets[0];
        uint256 amountBorrowed = amounts[0];
        uint256 fee = premiums[0];
        uint256 amountToRepay = amountBorrowed + fee;
        
        // Track initial balance to calculate profit
        uint256 initialBalance = IERC20Upgradeable(token).balanceOf(address(this));
        
        // Execute the arbitrage trade
        bool success = executeArbitrageTrade(
            token,
            amountBorrowed,
            sourceDex,
            targetDex,
            tradeData
        );
        
        // Check if trade was successful and profitable
        if (success) {
            uint256 finalBalance = IERC20Upgradeable(token).balanceOf(address(this));
            uint256 profit = finalBalance > initialBalance ? 
                finalBalance - initialBalance : 0;
            
            // Calculate profit as percentage of borrowed amount (in basis points)
            uint256 profitBps = profit * MAX_BPS / amountBorrowed;
            
            // Circuit breaker: check if profit meets minimum threshold
            if (profitBps < minProfitThreshold || profit <= fee) {
                emit CircuitBreakerTriggered(token, amountBorrowed, expectedProfit, profit);
                revert("Trade not profitable enough");
            }
            
            // Calculate protocol fee
            uint256 protocolFee = profit * protocolFeeBps / MAX_BPS;
            
            // Repay the flashloan
            IERC20Upgradeable(token).safeApprove(aaveLendingPool, amountToRepay);
            
            // Send protocol fee to fee collector
            if (protocolFee > 0 && feeCollector != address(0)) {
                IERC20Upgradeable(token).safeTransfer(feeCollector, protocolFee);
                emit FeeCollected(token, protocolFee);
            }
            
            // Transfer remaining profit to user
            uint256 remainingProfit = profit - protocolFee;
            if (remainingProfit > 0) {
                IERC20Upgradeable(token).safeTransfer(user, remainingProfit);
            }
            
            emit ArbitrageExecuted(
                user,
                token,
                amountBorrowed,
                profit,
                sourceDex,
                targetDex
            );
        } else {
            revert("Arbitrage trade failed");
        }
        
        return true;
    }
    
    /**
     * @dev Callback function for Uniswap flashloan
     */
    function uniswapV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external {
        require(msg.sender == uniswapV3Pool, "Unauthorized callback");
        
        // Decode trade parameters
        (
            address user,
            address token,
            string memory sourceDex,
            string memory targetDex,
            bytes memory tradeData,
            uint256 expectedProfit
        ) = abi.decode(data, (address, address, string, string, bytes, uint256));
        
        // Determine which token and fee to use
        uint256 amountBorrowed;
        uint256 fee;
        
        if (token == getToken0Address()) {
            amountBorrowed = IERC20Upgradeable(token).balanceOf(address(this));
            fee = fee0;
        } else {
            amountBorrowed = IERC20Upgradeable(token).balanceOf(address(this));
            fee = fee1;
        }
        
        uint256 amountToRepay = amountBorrowed + fee;
        
        // Track initial balance to calculate profit
        uint256 initialBalance = IERC20Upgradeable(token).balanceOf(address(this));
        
        // Execute the arbitrage trade
        bool success = executeArbitrageTrade(
            token,
            amountBorrowed,
            sourceDex,
            targetDex,
            tradeData
        );
        
        // Check if trade was successful and profitable
        if (success) {
            uint256 finalBalance = IERC20Upgradeable(token).balanceOf(address(this));
            uint256 profit = finalBalance > initialBalance ? 
                finalBalance - initialBalance : 0;
            
            // Calculate profit as percentage of borrowed amount (in basis points)
            uint256 profitBps = profit * MAX_BPS / amountBorrowed;
            
            // Circuit breaker: check if profit meets minimum threshold
            if (profitBps < minProfitThreshold || profit <= fee) {
                emit CircuitBreakerTriggered(token, amountBorrowed, expectedProfit, profit);
                revert("Trade not profitable enough");
            }
            
            // Calculate protocol fee
            uint256 protocolFee = profit * protocolFeeBps / MAX_BPS;
            
            // Repay the flashloan
            IERC20Upgradeable(token).safeApprove(uniswapV3Pool, amountToRepay);
            
            // Send protocol fee to fee collector
            if (protocolFee > 0 && feeCollector != address(0)) {
                IERC20Upgradeable(token).safeTransfer(feeCollector, protocolFee);
                emit FeeCollected(token, protocolFee);
            }
            
            // Transfer remaining profit to user
            uint256 remainingProfit = profit - protocolFee;
            if (remainingProfit > 0) {
                IERC20Upgradeable(token).safeTransfer(user, remainingProfit);
            }
            
            emit ArbitrageExecuted(
                user,
                token,
                amountBorrowed,
                profit,
                sourceDex,
                targetDex
            );
        } else {
            revert("Arbitrage trade failed");
        }
    }
    
    /**
     * @dev Execute the actual arbitrage trade across DEXes
     */
    function executeArbitrageTrade(
        address token,
        uint256 amount,
        string memory sourceDex,
        string memory targetDex,
        bytes memory tradeData
    ) internal returns (bool) {
        // Decode the trade path and parameters
        (
            address[] memory path,
            uint256 amountOutMin,
            uint256 deadline
        ) = abi.decode(tradeData, (address[], uint256, uint256));
        
        // Make sure first token in path matches borrowed token
        require(path[0] == token, "Token mismatch");
        
        // Execute swap on source DEX
        try this.executeSwap(sourceDex, path, amount, amountOutMin, deadline) {
            // If successful, determine the received token
            address receivedToken = path[path.length - 1];
            uint256 receivedAmount = IERC20Upgradeable(receivedToken).balanceOf(address(this));
            
            // Reverse the path for the second swap
            address[] memory reversePath = new address[](path.length);
            for (uint i = 0; i < path.length; i++) {
                reversePath[i] = path[path.length - 1 - i];
            }
            
            // Execute swap on target DEX
            try this.executeSwap(targetDex, reversePath, receivedAmount, 0, deadline) {
                return true;
            } catch {
                return false;
            }
        } catch {
            return false;
        }
    }
    
    /**
     * @dev Execute a swap on the specified DEX
     */
    function executeSwap(
        string memory dexName,
        address[] memory path,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 deadline
    ) external returns (uint[] memory amounts) {
        // Only allow internal calls from this contract
        require(msg.sender == address(this), "External swap not allowed");
        
        // Approve token for router
        address router;
        if (compareStrings(dexName, "uniswap")) {
            router = uniswapRouter;
        } else if (compareStrings(dexName, "sushiswap")) {
            router = sushiswapRouter;
        } else {
            revert("Unsupported DEX");
        }
        
        IERC20Upgradeable(path[0]).safeApprove(router, amountIn);
        
        // Execute swap
        if (compareStrings(dexName, "uniswap")) {
            return IUniswapV2Router(router).swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                address(this),
                deadline
            );
        } else if (compareStrings(dexName, "sushiswap")) {
            return ISushiSwapRouter(router).swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                address(this),
                deadline
            );
        }
        
        revert("Swap failed");
    }
    
    /**
     * @dev Recover tokens sent to the contract by mistake
     */
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        IERC20Upgradeable(token).safeTransfer(owner(), amount);
    }
    
    /**
     * @dev Helper functions
     */
    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
    
    // These functions would be implemented properly in a real contract
    // They're simplified here for demonstration
    function getToken0Address() internal view returns (address) {
        // This would retrieve token0 from the Uniswap pool
        return address(0);
    }
    
    function getToken1Address() internal view returns (address) {
        // This would retrieve token1 from the Uniswap pool
        return address(0);
    }
}
