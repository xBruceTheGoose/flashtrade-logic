
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUniswapPool {
    address public token0;
    address public token1;
    
    constructor() {
        // These would be set in a real implementation
        token0 = address(0);
        token1 = address(0);
    }
    
    function setTokens(address _token0, address _token1) external {
        token0 = _token0;
        token1 = _token1;
    }
    
    function flash(
        address recipient,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external {
        // Transfer tokens to recipient (simulating flashloan)
        if (amount0 > 0 && token0 != address(0)) {
            IERC20(token0).transfer(recipient, amount0);
        }
        
        if (amount1 > 0 && token1 != address(0)) {
            IERC20(token1).transfer(recipient, amount1);
        }
        
        // Calculate fees
        uint256 fee0 = amount0 * 3 / 1000; // 0.3% fee
        uint256 fee1 = amount1 * 3 / 1000; // 0.3% fee
        
        // Call uniswapV3FlashCallback on recipient
        (bool success, ) = recipient.call(
            abi.encodeWithSignature(
                "uniswapV3FlashCallback(uint256,uint256,bytes)",
                fee0,
                fee1,
                data
            )
        );
        
        require(success, "Flashloan callback failed");
        
        // Transfer tokens back (simulating repayment)
        if (amount0 > 0 && token0 != address(0)) {
            IERC20(token0).transferFrom(recipient, address(this), amount0 + fee0);
        }
        
        if (amount1 > 0 && token1 != address(0)) {
            IERC20(token1).transferFrom(recipient, address(this), amount1 + fee1);
        }
    }
}
