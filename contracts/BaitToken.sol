// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface ITrapTrip {
    function tripByToken(address bait, address taker) external;
}

/// @title BaitToken
/// @notice A dollar-looking balance that sits only in bait wallets. It cannot leave them.
///         Any attempt to move it (transfer, transferFrom, or approving a spender) does not
///         move the balance; it trips the bait's trap instead, which locks the builder's
///         vault and flags the destination or spender. The call does not revert, so the
///         trip is recorded on-chain. The token has no market and no redemption.
contract BaitToken is ERC20 {
    address public immutable factory;
    mapping(address => address) public trapOf; // bait => trap

    event BaitTaken(address indexed bait, address indexed taker, address indexed trap, uint256 attempted);

    error NotFactory();
    error NotBait();

    constructor() ERC20("Reserve USD (Tripwire bait)", "rUSD") {
        factory = msg.sender;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function arm(address bait, address trap, uint256 amount) external {
        if (msg.sender != factory) revert NotFactory();
        trapOf[bait] = trap;
        _mint(bait, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0)) {
            super._update(from, to, value); // minting by the factory
            return;
        }
        address trap = trapOf[from];
        if (trap == address(0)) revert NotBait(); // only bait wallets ever hold rUSD
        emit BaitTaken(from, to, trap, value);
        ITrapTrip(trap).tripByToken(from, to);
        // balance intentionally does not move
    }

    function _approve(address owner, address spender, uint256 value, bool emitEvent) internal override {
        address trap = trapOf[owner];
        if (emitEvent && trap != address(0)) {
            // An explicit approve from a bait wallet is a thief preparing a sweep.
            emit BaitTaken(owner, spender, trap, value);
            ITrapTrip(trap).tripByToken(owner, spender);
        }
        super._approve(owner, spender, value, emitEvent);
    }
}
