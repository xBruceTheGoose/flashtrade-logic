// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockDEX is Ownable {
    mapping(address => mapping(address => uint256)) public prices;
    
    event PriceSet(address tokenIn, address tokenOut, uint256 price);
    event Trade(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);

    function setPrice(address tokenIn, address tokenOut, uint256 price) external onlyOwner {
        prices[tokenIn][tokenOut] = price;
        emit PriceSet(tokenIn, tokenOut, price);
    }

    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn) public view returns (uint256) {
        require(prices[tokenIn][tokenOut] > 0, "Price not set");
        return (amountIn * prices[tokenIn][tokenOut]) / 1e18;
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        require(prices[tokenIn][tokenOut] > 0, "Price not set");
        
        amountOut = getAmountOut(tokenIn, tokenOut, amountIn);
        require(amountOut >= minAmountOut, "Insufficient output amount");

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).transfer(recipient, amountOut);

        emit Trade(tokenIn, tokenOut, amountIn, amountOut);
        return amountOut;
    }
}
