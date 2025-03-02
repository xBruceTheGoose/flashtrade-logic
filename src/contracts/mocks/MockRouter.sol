
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockRouter {
    // Mock rates for token swaps (token address => rate multiplier * 1000)
    mapping(address => mapping(address => uint256)) public mockRates;
    
    function setMockRate(address tokenIn, address tokenOut, uint256 rate) external {
        mockRates[tokenIn][tokenOut] = rate;
    }
    
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        require(path.length >= 2, "Invalid path");
        require(deadline >= block.timestamp, "Expired");
        
        // Calculate amounts based on mock rates
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        
        // Transfer input token from sender to this contract
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        
        // Calculate output amount for each step in the path
        for (uint i = 0; i < path.length - 1; i++) {
            address currentToken = path[i];
            address nextToken = path[i + 1];
            
            uint256 rate = mockRates[currentToken][nextToken];
            if (rate == 0) {
                rate = 1000; // Default 1:1 rate
            }
            
            amounts[i + 1] = amounts[i] * rate / 1000;
        }
        
        require(amounts[path.length - 1] >= amountOutMin, "Insufficient output amount");
        
        // Transfer output token to recipient
        IERC20(path[path.length - 1]).transfer(to, amounts[path.length - 1]);
        
        return amounts;
    }
}
