// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TripwireVault
/// @notice Holds a builder's real funds (native QIE and ERC-20s such as QUSDC).
///         - Small withdrawals up to a daily limit go out instantly.
///         - Larger withdrawals wait `delay` seconds and can be cancelled.
///         - A guardian (the builder's Trap, or a lock-only keeper) can lock the vault.
///         - When locked, nothing leaves except a rescue to the pre-set recovery address.
///         - Security settings can only be changed by the recovery address, so a stolen
///           owner key cannot weaken the vault before draining it.
contract TripwireVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant NATIVE = address(0);

    struct Request {
        address token;
        address to;
        uint256 amount;
        uint64 readyAt;
        bool done; // executed or cancelled
    }

    address public immutable owner;
    address public recovery;
    uint64 public delay;
    bool public locked;
    uint64 public lockedAt;
    bytes32 public lockReason;

    mapping(address => bool) public isGuardian;
    mapping(address => uint256) public dailyLimit; // per token, NATIVE = address(0)
    mapping(address => mapping(uint256 => uint256)) public spentOnDay; // token => day => amount

    Request[] public requests;

    event Deposited(address indexed token, address indexed from, uint256 amount);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);
    event WithdrawRequested(uint256 indexed id, address indexed token, address indexed to, uint256 amount, uint64 readyAt);
    event WithdrawExecuted(uint256 indexed id);
    event WithdrawCancelled(uint256 indexed id);
    event Locked(address indexed by, bytes32 reason);
    event Unlocked(address indexed by);
    event Rescued(address indexed token, address indexed to, uint256 amount);
    event GuardianSet(address indexed guardian, bool enabled);
    event DailyLimitSet(address indexed token, uint256 limit);
    event DelaySet(uint64 delay);
    event RecoverySet(address indexed recovery);

    error NotOwner();
    error NotRecovery();
    error NotAuthorized();
    error IsLocked();
    error NotLocked();
    error OverDailyLimit();
    error NotReady();
    error AlreadyDone();
    error ZeroAddress();
    error NativeTransferFailed();
    error BadDelay();

    uint64 public constant MIN_DELAY = 1 hours;
    uint64 public constant MAX_DELAY = 30 days;

    constructor(address owner_, address recovery_, uint64 delay_) {
        if (owner_ == address(0) || recovery_ == address(0)) revert ZeroAddress();
        if (delay_ < MIN_DELAY || delay_ > MAX_DELAY) revert BadDelay();
        owner = owner_;
        recovery = recovery_;
        delay = delay_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRecovery() {
        if (msg.sender != recovery) revert NotRecovery();
        _;
    }

    modifier notLocked() {
        if (locked) revert IsLocked();
        _;
    }

    // ------------------------------------------------------------------ deposits

    receive() external payable {
        emit Deposited(NATIVE, msg.sender, msg.value);
    }

    function deposit(address token, uint256 amount) external nonReentrant {
        if (token == NATIVE) revert ZeroAddress();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(token, msg.sender, amount);
    }

    // ------------------------------------------------------------------ withdrawals

    function today() public view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function remainingToday(address token) public view returns (uint256) {
        uint256 spent = spentOnDay[token][today()];
        uint256 limit = dailyLimit[token];
        return spent >= limit ? 0 : limit - spent;
    }

    /// @notice Instant withdrawal within the daily limit.
    function withdraw(address token, address to, uint256 amount) external onlyOwner notLocked nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > remainingToday(token)) revert OverDailyLimit();
        spentOnDay[token][today()] += amount;
        _send(token, to, amount);
        emit Withdrawn(token, to, amount);
    }

    /// @notice Queue a withdrawal above the daily limit. It can run after `delay`.
    function requestWithdraw(address token, address to, uint256 amount) external onlyOwner notLocked returns (uint256 id) {
        if (to == address(0)) revert ZeroAddress();
        uint64 readyAt = uint64(block.timestamp) + delay;
        requests.push(Request({token: token, to: to, amount: amount, readyAt: readyAt, done: false}));
        id = requests.length - 1;
        emit WithdrawRequested(id, token, to, amount, readyAt);
    }

    function executeWithdraw(uint256 id) external onlyOwner notLocked nonReentrant {
        Request storage r = requests[id];
        if (r.done) revert AlreadyDone();
        if (block.timestamp < r.readyAt) revert NotReady();
        r.done = true;
        _send(r.token, r.to, r.amount);
        emit WithdrawExecuted(id);
    }

    /// @notice Owner or recovery can cancel a queued withdrawal, even while locked.
    function cancelWithdraw(uint256 id) external {
        if (msg.sender != owner && msg.sender != recovery) revert NotAuthorized();
        Request storage r = requests[id];
        if (r.done) revert AlreadyDone();
        r.done = true;
        emit WithdrawCancelled(id);
    }

    function requestCount() external view returns (uint256) {
        return requests.length;
    }

    // ------------------------------------------------------------------ lock / rescue

    /// @notice Owner, recovery or any guardian can lock. Locking only ever protects funds.
    function lock(bytes32 reason) external {
        if (msg.sender != owner && msg.sender != recovery && !isGuardian[msg.sender]) revert NotAuthorized();
        if (locked) return; // idempotent: a second trip must not revert the trap
        locked = true;
        lockedAt = uint64(block.timestamp);
        lockReason = reason;
        emit Locked(msg.sender, reason);
    }

    function unlock() external onlyRecovery {
        if (!locked) revert NotLocked();
        locked = false;
        lockReason = bytes32(0);
        emit Unlocked(msg.sender);
    }

    /// @notice While locked, owner or recovery can sweep a token to the recovery address.
    ///         A thief holding the owner key can only send funds to the builder's recovery.
    function rescue(address token) external nonReentrant {
        if (!locked) revert NotLocked();
        if (msg.sender != owner && msg.sender != recovery) revert NotAuthorized();
        uint256 amount = token == NATIVE ? address(this).balance : IERC20(token).balanceOf(address(this));
        _send(token, recovery, amount);
        emit Rescued(token, recovery, amount);
    }

    // ------------------------------------------------------------------ settings (recovery only)

    function setGuardian(address guardian, bool enabled) external onlyRecovery {
        if (guardian == address(0)) revert ZeroAddress();
        isGuardian[guardian] = enabled;
        emit GuardianSet(guardian, enabled);
    }

    function setDailyLimit(address token, uint256 limit) external onlyRecovery {
        dailyLimit[token] = limit;
        emit DailyLimitSet(token, limit);
    }

    function setDelay(uint64 delay_) external onlyRecovery {
        if (delay_ < MIN_DELAY || delay_ > MAX_DELAY) revert BadDelay();
        delay = delay_;
        emit DelaySet(delay_);
    }

    function setRecovery(address recovery_) external onlyRecovery {
        if (recovery_ == address(0)) revert ZeroAddress();
        recovery = recovery_;
        emit RecoverySet(recovery_);
    }

    // ------------------------------------------------------------------ internal

    function _send(address token, address to, uint256 amount) internal {
        if (token == NATIVE) {
            (bool ok, ) = to.call{value: amount}("");
            if (!ok) revert NativeTransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
}
