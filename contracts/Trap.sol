// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVaultLock {
    function lock(bytes32 reason) external;
}

interface IFlagRegistry {
    function flag(address who, address bait) external;
}

/// @title Trap
/// @notice One builder's set of bait keys. Each bait address is labelled with where its
///         private key was planted (for example "github:zelkaro/.env"). When bait is
///         taken, the trap locks the builder's vault, flags the taker on the public
///         registry and emits the label, so the builder knows exactly what leaked.
contract Trap {
    struct Trip {
        address bait;
        address taker;
        uint64 at;
        bool viaToken; // true: proven on-chain by the bait token; false: reported by keeper
    }

    address public immutable factory;
    address public immutable owner; // builder (usually the vault's recovery address)
    address public immutable vault;
    IFlagRegistry public immutable registry;
    address public baitToken;
    address public keeper; // optional lock-only watcher for native-coin sweeps

    mapping(address => bytes32) public labelOf; // bait => where it was planted
    address[] public baits;
    Trip[] public trips;

    event BaitAdded(address indexed bait, bytes32 label);
    event Tripped(address indexed bait, bytes32 indexed label, address indexed taker, bool viaToken, uint256 tripIndex);
    event KeeperSet(address indexed keeper);
    event LockFailed(address indexed bait, bytes32 label);

    error NotFactory();
    error NotOwner();
    error NotBaitToken();
    error NotKeeper();
    error UnknownBait();
    error DuplicateBait();
    error ZeroAddress();

    constructor(address owner_, address vault_, address registry_, address keeper_) {
        if (owner_ == address(0) || vault_ == address(0) || registry_ == address(0)) revert ZeroAddress();
        factory = msg.sender;
        owner = owner_;
        vault = vault_;
        registry = IFlagRegistry(registry_);
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    function setBaitToken(address token) external {
        if (msg.sender != factory) revert NotFactory();
        baitToken = token;
    }

    function addBait(address bait, bytes32 label) external {
        if (msg.sender != factory && msg.sender != owner) revert NotOwner();
        if (bait == address(0)) revert ZeroAddress();
        if (labelOf[bait] != bytes32(0)) revert DuplicateBait();
        if (label == bytes32(0)) revert UnknownBait();
        labelOf[bait] = label;
        baits.push(bait);
        emit BaitAdded(bait, label);
    }

    function setKeeper(address keeper_) external {
        if (msg.sender != owner) revert NotOwner();
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    /// @notice Called by the bait token when someone tries to move bait. Fully on-chain proof.
    function tripByToken(address bait, address taker) external {
        if (msg.sender != baitToken) revert NotBaitToken();
        _trip(bait, taker, true);
    }

    /// @notice Called by the keeper when a bait key's native QIE is swept (seen off-chain).
    ///         The keeper can only cause protective actions: a lock and a flag that cites
    ///         the bait. It cannot move any funds.
    function tripByKeeper(address bait, address taker) external {
        if (msg.sender != keeper || keeper == address(0)) revert NotKeeper();
        _trip(bait, taker, false);
    }

    function _trip(address bait, address taker, bool viaToken) internal {
        bytes32 label = labelOf[bait];
        if (label == bytes32(0)) revert UnknownBait();
        // A failed lock (e.g. the trap was never made a guardian) must not erase the trip.
        try IVaultLock(vault).lock(label) {} catch {
            emit LockFailed(bait, label);
        }
        registry.flag(taker, bait);
        trips.push(Trip({bait: bait, taker: taker, at: uint64(block.timestamp), viaToken: viaToken}));
        emit Tripped(bait, label, taker, viaToken, trips.length - 1);
    }

    function baitCount() external view returns (uint256) {
        return baits.length;
    }

    function tripCount() external view returns (uint256) {
        return trips.length;
    }
}
