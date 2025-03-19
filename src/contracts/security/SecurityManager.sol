// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/**
 * @title SecurityManager
 * @dev Manages security features for the flash trade system
 */
contract SecurityManager is Initializable, PausableUpgradeable, AccessControlUpgradeable, ReentrancyGuardUpgradeable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    uint256 public maxGasPrice;
    uint256 public rateLimit;
    uint256 public rateLimitWindow;
    mapping(address => uint256) public lastTradeTimestamp;
    
    event SecurityLimitUpdated(string parameter, uint256 newValue);
    event EmergencyShutdown(address indexed triggeredBy);
    event RateLimitExceeded(address indexed trader);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(
        address admin,
        uint256 _maxGasPrice,
        uint256 _rateLimit,
        uint256 _rateLimitWindow
    ) public initializer {
        __Pausable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        
        maxGasPrice = _maxGasPrice;
        rateLimit = _rateLimit;
        rateLimitWindow = _rateLimitWindow;
    }
    
    modifier checkTradeLimit(address trader) {
        require(
            block.timestamp >= lastTradeTimestamp[trader] + rateLimitWindow,
            "Rate limit exceeded"
        );
        require(tx.gasprice <= maxGasPrice, "Gas price too high");
        _;
        lastTradeTimestamp[trader] = block.timestamp;
    }
    
    function setMaxGasPrice(uint256 _maxGasPrice) external onlyRole(ADMIN_ROLE) {
        maxGasPrice = _maxGasPrice;
        emit SecurityLimitUpdated("maxGasPrice", _maxGasPrice);
    }
    
    function setRateLimit(uint256 _rateLimit) external onlyRole(ADMIN_ROLE) {
        rateLimit = _rateLimit;
        emit SecurityLimitUpdated("rateLimit", _rateLimit);
    }
    
    function setRateLimitWindow(uint256 _rateLimitWindow) external onlyRole(ADMIN_ROLE) {
        rateLimitWindow = _rateLimitWindow;
        emit SecurityLimitUpdated("rateLimitWindow", _rateLimitWindow);
    }
    
    function emergencyShutdown() external onlyRole(ADMIN_ROLE) {
        _pause();
        emit EmergencyShutdown(msg.sender);
    }
    
    function resume() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
