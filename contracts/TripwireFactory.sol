// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TripwireVault} from "./TripwireVault.sol";
import {Trap} from "./Trap.sol";
import {BaitToken} from "./BaitToken.sol";

interface IRegistry {
    function registerTrap(address trap) external;
}

/// @title TripwireFactory
/// @notice Arms a builder in one transaction: deploys a trap for their existing vault,
///         registers it with the flag registry and gives each bait wallet a bait balance.
contract TripwireFactory {
    IRegistry public immutable registry;
    BaitToken public immutable baitToken;

    uint256 public constant BAIT_AMOUNT = 500e6; // shows as 500 rUSD in the bait wallet

    address[] public traps;
    mapping(address => address[]) public trapsOf; // owner => traps

    event VaultCreated(address indexed owner, address indexed vault, address recovery, uint64 delay);
    event Armed(address indexed owner, address indexed trap, address indexed vault, uint256 baits);

    error LengthMismatch();
    error NoBaits();
    error NotVaultRecovery();

    constructor(address registry_) {
        registry = IRegistry(registry_);
        baitToken = new BaitToken();
    }

    function createVault(address recovery, uint64 delay) external returns (address vault) {
        vault = address(new TripwireVault(msg.sender, recovery, delay));
        emit VaultCreated(msg.sender, vault, recovery, delay);
    }

    /// @param vault   the builder's vault; the caller must be its recovery address, which is
    ///                also the address that must then call vault.setGuardian(trap, true).
    /// @param keeper  optional lock-only watcher for native sweeps (address(0) for none)
    /// @param baits   addresses whose private keys will be planted
    /// @param labels  where each key is planted, e.g. "github:zelkaro/.env"
    function arm(address vault, address keeper, address[] calldata baits, bytes32[] calldata labels)
        external
        returns (address trap)
    {
        if (baits.length == 0) revert NoBaits();
        if (baits.length != labels.length) revert LengthMismatch();
        if (TripwireVault(payable(vault)).recovery() != msg.sender) revert NotVaultRecovery();

        Trap t = new Trap(msg.sender, vault, address(registry), keeper);
        t.setBaitToken(address(baitToken));
        for (uint256 i = 0; i < baits.length; i++) {
            t.addBait(baits[i], labels[i]);
            baitToken.arm(baits[i], address(t), BAIT_AMOUNT);
        }
        registry.registerTrap(address(t));

        trap = address(t);
        traps.push(trap);
        trapsOf[msg.sender].push(trap);
        emit Armed(msg.sender, trap, vault, baits.length);
    }

    function trapCount() external view returns (uint256) {
        return traps.length;
    }
}
