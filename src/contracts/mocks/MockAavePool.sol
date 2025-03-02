
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockAavePool {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external {
        // Transfer tokens to receiver (simulating flashloan)
        for (uint i = 0; i < assets.length; i++) {
            IERC20(assets[i]).transfer(receiverAddress, amounts[i]);
        }
        
        // Call executeOperation on receiver
        (bool success, ) = receiverAddress.call(
            abi.encodeWithSignature(
                "executeOperation(address[],uint256[],uint256[],address,bytes)",
                assets,
                amounts,
                calculatePremiums(amounts),
                msg.sender,
                params
            )
        );
        
        require(success, "Flashloan callback failed");
        
        // Transfer tokens back (simulating repayment)
        for (uint i = 0; i < assets.length; i++) {
            uint256 amountPlusPremium = amounts[i] + calculatePremium(amounts[i]);
            IERC20(assets[i]).transferFrom(receiverAddress, address(this), amountPlusPremium);
        }
    }
    
    function calculatePremiums(uint256[] calldata amounts) private pure returns (uint256[] memory) {
        uint256[] memory premiums = new uint256[](amounts.length);
        for (uint i = 0; i < amounts.length; i++) {
            premiums[i] = calculatePremium(amounts[i]);
        }
        return premiums;
    }
    
    function calculatePremium(uint256 amount) private pure returns (uint256) {
        // 0.09% premium for Aave flashloans
        return amount * 9 / 10000;
    }
}
