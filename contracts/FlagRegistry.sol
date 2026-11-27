// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FlagRegistry
/// @notice Public list of addresses caught taking Tripwire bait on QIE.
///         Only traps created by the Tripwire factory can add flags, so a flag
///         always points to an on-chain trip event that anyone can inspect.
///         Any wallet, app or AI agent can call `isFlagged` before paying an address.
contract FlagRegistry {
    struct Flag {
        uint64 firstSeen; // block timestamp of the first trip
        uint64 lastSeen; // block timestamp of the latest trip
        uint32 count; // number of trips by this address
        address lastTrap; // trap that recorded the latest trip
        address lastBait; // bait address used in the latest trip
    }

    address public immutable deployer;
    address public factory;

    mapping(address => bool) public isTrap;
    mapping(address => Flag) private _flags;
    uint256 public flaggedCount;

    event FactorySet(address indexed factory);
    event TrapRegistered(address indexed trap);
    event Flagged(address indexed who, address indexed trap, address indexed bait, uint32 count);

    error NotDeployer();
    error FactoryAlreadySet();
    error NotFactory();
    error NotTrap();
    error ZeroAddress();

    constructor() {
        deployer = msg.sender;
    }

    /// @notice One-time link to the factory (the factory needs this registry's address first).
    function setFactory(address factory_) external {
        if (msg.sender != deployer) revert NotDeployer();
        if (factory != address(0)) revert FactoryAlreadySet();
        if (factory_ == address(0)) revert ZeroAddress();
        factory = factory_;
        emit FactorySet(factory_);
    }

    function registerTrap(address trap) external {
        if (msg.sender != factory) revert NotFactory();
        isTrap[trap] = true;
        emit TrapRegistered(trap);
    }

    /// @notice Called by a trap when `who` took bait `bait`.
    function flag(address who, address bait) external {
        if (!isTrap[msg.sender]) revert NotTrap();
        if (who == address(0)) revert ZeroAddress();
        Flag storage f = _flags[who];
        if (f.count == 0) {
            f.firstSeen = uint64(block.timestamp);
            flaggedCount += 1;
        }
        f.lastSeen = uint64(block.timestamp);
        f.count += 1;
        f.lastTrap = msg.sender;
        f.lastBait = bait;
        emit Flagged(who, msg.sender, bait, f.count);
    }

    function isFlagged(address who) external view returns (bool) {
        return _flags[who].count > 0;
    }

    function flagOf(address who) external view returns (Flag memory) {
        return _flags[who];
    }
}
