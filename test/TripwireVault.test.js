const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { deployArmed, DAY, HOUR, NATIVE, label } = require("./helpers");

const E = (n) => ethers.parseEther(String(n));

describe("TripwireVault: real funds, delayed big withdrawals, lock and rescue", function () {
  describe("instant withdrawals within the daily limit", function () {
    it("owner can withdraw up to the limit", async function () {
      const { vault, owner, payee } = await deployArmed();
      await expect(vault.connect(owner).withdraw(NATIVE, payee.address, E(1))).to.changeEtherBalance(payee, E(1));
    });

    it("rejects amounts over today's remaining limit", async function () {
      const { vault, owner, payee } = await deployArmed();
      await vault.connect(owner).withdraw(NATIVE, payee.address, E("0.6"));
      expect(await vault.remainingToday(NATIVE)).to.equal(E("0.4"));
      await expect(vault.connect(owner).withdraw(NATIVE, payee.address, E("0.5"))).to.be.revertedWithCustomError(
        vault,
        "OverDailyLimit"
      );
    });

    it("limit resets the next day", async function () {
      const { vault, owner, payee } = await deployArmed();
      await vault.connect(owner).withdraw(NATIVE, payee.address, E(1));
      await time.increase(DAY);
      await expect(vault.connect(owner).withdraw(NATIVE, payee.address, E(1))).to.changeEtherBalance(payee, E(1));
    });

    it("a token with no limit set cannot be withdrawn instantly", async function () {
      const { vault, owner, payee } = await deployArmed();
      const t = await ethers.deployContract("MockERC20");
      await expect(vault.connect(owner).withdraw(await t.getAddress(), payee.address, 1n)).to.be.revertedWithCustomError(
        vault,
        "OverDailyLimit"
      );
    });

    it("only the owner can withdraw, never to the zero address", async function () {
      const { vault, stranger, owner } = await deployArmed();
      await expect(vault.connect(stranger).withdraw(NATIVE, stranger.address, 1n)).to.be.revertedWithCustomError(vault, "NotOwner");
      await expect(vault.connect(owner).withdraw(NATIVE, ethers.ZeroAddress, 1n)).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });
  });

  describe("delayed withdrawals", function () {
    it("a big withdrawal waits for the delay, then pays out", async function () {
      const { vault, owner, payee } = await deployArmed();
      await vault.connect(owner).requestWithdraw(NATIVE, payee.address, E(5));
      await expect(vault.connect(owner).executeWithdraw(0)).to.be.revertedWithCustomError(vault, "NotReady");
      await time.increase(DAY);
      await expect(vault.connect(owner).executeWithdraw(0)).to.changeEtherBalance(payee, E(5));
      await expect(vault.connect(owner).executeWithdraw(0)).to.be.revertedWithCustomError(vault, "AlreadyDone");
    });

    it("owner or recovery can cancel; strangers cannot", async function () {
      const { vault, owner, recovery, stranger, payee } = await deployArmed();
      await vault.connect(owner).requestWithdraw(NATIVE, payee.address, E(5));
      await vault.connect(owner).requestWithdraw(NATIVE, payee.address, E(5));
      await expect(vault.connect(stranger).cancelWithdraw(0)).to.be.revertedWithCustomError(vault, "NotAuthorized");
      await expect(vault.connect(recovery).cancelWithdraw(0)).to.emit(vault, "WithdrawCancelled").withArgs(0);
      await vault.connect(owner).cancelWithdraw(1);
      await time.increase(DAY);
      await expect(vault.connect(owner).executeWithdraw(0)).to.be.revertedWithCustomError(vault, "AlreadyDone");
      await expect(vault.connect(owner).cancelWithdraw(0)).to.be.revertedWithCustomError(vault, "AlreadyDone");
      expect(await vault.requestCount()).to.equal(2n);
    });

    it("requests reject the zero address and non-owners", async function () {
      const { vault, owner, stranger } = await deployArmed();
      await expect(vault.connect(owner).requestWithdraw(NATIVE, ethers.ZeroAddress, 1n)).to.be.revertedWithCustomError(vault, "ZeroAddress");
      await expect(vault.connect(stranger).requestWithdraw(NATIVE, stranger.address, 1n)).to.be.revertedWithCustomError(vault, "NotOwner");
    });
  });

  describe("the thief scenario", function () {
    it("bait taken -> vault locked -> thief's queued drain can never execute", async function () {
      const { vault, owner, thief, bait, bait1 } = await deployArmed();
      // Thief has the owner key too and queues a full drain to himself.
      await vault.connect(owner).requestWithdraw(NATIVE, thief.address, E(10));
      // Thief (or his sweeper) also touches a bait key -> trip.
      await bait.connect(bait1).transfer(thief.address, 1n);
      await time.increase(DAY);
      await expect(vault.connect(owner).executeWithdraw(0)).to.be.revertedWithCustomError(vault, "IsLocked");
      await expect(vault.connect(owner).withdraw(NATIVE, thief.address, E("0.1"))).to.be.revertedWithCustomError(vault, "IsLocked");
      await expect(vault.connect(owner).requestWithdraw(NATIVE, thief.address, 1n)).to.be.revertedWithCustomError(vault, "IsLocked");
    });

    it("rescue sends everything to recovery, even when the owner key calls it", async function () {
      const { vault, owner, recovery, bait, bait1, thief } = await deployArmed();
      await bait.connect(bait1).transfer(thief.address, 1n);
      await expect(vault.connect(owner).rescue(NATIVE)).to.changeEtherBalance(recovery, E(10));
      expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(0n);
    });

    it("rescue works for ERC-20 (e.g. QUSDC) too", async function () {
      const { vault, owner, recovery } = await deployArmed();
      const t = await ethers.deployContract("MockERC20");
      await t.mint(owner.address, 1000n);
      await t.connect(owner).approve(await vault.getAddress(), 1000n);
      await expect(vault.connect(owner).deposit(await t.getAddress(), 1000n)).to.emit(vault, "Deposited");
      await vault.connect(owner).lock(label("manual"));
      await expect(vault.connect(recovery).rescue(await t.getAddress())).to.changeTokenBalance(t, recovery, 1000n);
    });

    it("rescue is impossible while unlocked and for strangers", async function () {
      const { vault, owner, stranger } = await deployArmed();
      await expect(vault.connect(owner).rescue(NATIVE)).to.be.revertedWithCustomError(vault, "NotLocked");
      await vault.connect(owner).lock(label("x"));
      await expect(vault.connect(stranger).rescue(NATIVE)).to.be.revertedWithCustomError(vault, "NotAuthorized");
    });

    it("a stolen owner key cannot weaken settings (all settings are recovery-only)", async function () {
      const { vault, owner, trap } = await deployArmed();
      await expect(vault.connect(owner).setGuardian(await trap.getAddress(), false)).to.be.revertedWithCustomError(vault, "NotRecovery");
      await expect(vault.connect(owner).setDailyLimit(NATIVE, E(100))).to.be.revertedWithCustomError(vault, "NotRecovery");
      await expect(vault.connect(owner).setDelay(HOUR)).to.be.revertedWithCustomError(vault, "NotRecovery");
      await expect(vault.connect(owner).setRecovery(owner.address)).to.be.revertedWithCustomError(vault, "NotRecovery");
      await expect(vault.connect(owner).unlock()).to.be.revertedWithCustomError(vault, "NotRecovery");
    });
  });

  describe("lock and unlock", function () {
    it("owner, recovery and guardians can lock; strangers cannot", async function () {
      const { vault, stranger, recovery } = await deployArmed();
      await expect(vault.connect(stranger).lock(label("x"))).to.be.revertedWithCustomError(vault, "NotAuthorized");
      await expect(vault.connect(recovery).lock(label("cold"))).to.emit(vault, "Locked");
      expect(await vault.lockedAt()).to.be.gt(0n);
    });

    it("locking twice is a no-op, not an error", async function () {
      const { vault, owner } = await deployArmed();
      await vault.connect(owner).lock(label("a"));
      await expect(vault.connect(owner).lock(label("b"))).not.to.emit(vault, "Locked");
      expect(await vault.lockReason()).to.equal(label("a"));
    });

    it("only recovery can unlock, and only when locked", async function () {
      const { vault, owner, recovery, payee } = await deployArmed();
      await expect(vault.connect(recovery).unlock()).to.be.revertedWithCustomError(vault, "NotLocked");
      await vault.connect(owner).lock(label("x"));
      await expect(vault.connect(recovery).unlock()).to.emit(vault, "Unlocked");
      expect(await vault.lockReason()).to.equal(ethers.ZeroHash);
      await expect(vault.connect(owner).withdraw(NATIVE, payee.address, E(1))).to.changeEtherBalance(payee, E(1));
    });
  });

  describe("settings", function () {
    it("recovery can change delay within bounds", async function () {
      const { vault, recovery } = await deployArmed();
      await expect(vault.connect(recovery).setDelay(2 * DAY)).to.emit(vault, "DelaySet");
      await expect(vault.connect(recovery).setDelay(60)).to.be.revertedWithCustomError(vault, "BadDelay");
      await expect(vault.connect(recovery).setDelay(31 * DAY)).to.be.revertedWithCustomError(vault, "BadDelay");
    });

    it("recovery can rotate itself, never to zero", async function () {
      const { vault, recovery, stranger } = await deployArmed();
      await expect(vault.connect(recovery).setRecovery(ethers.ZeroAddress)).to.be.revertedWithCustomError(vault, "ZeroAddress");
      await expect(vault.connect(recovery).setRecovery(stranger.address)).to.emit(vault, "RecoverySet").withArgs(stranger.address);
      expect(await vault.recovery()).to.equal(stranger.address);
    });

    it("guardian cannot be the zero address", async function () {
      const { vault, recovery } = await deployArmed();
      await expect(vault.connect(recovery).setGuardian(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });

    it("constructor validates owner, recovery and delay", async function () {
      const [a] = await ethers.getSigners();
      const V = await ethers.getContractFactory("TripwireVault");
      await expect(V.deploy(ethers.ZeroAddress, a.address, DAY)).to.be.revertedWithCustomError(V, "ZeroAddress");
      await expect(V.deploy(a.address, ethers.ZeroAddress, DAY)).to.be.revertedWithCustomError(V, "ZeroAddress");
      await expect(V.deploy(a.address, a.address, 10)).to.be.revertedWithCustomError(V, "BadDelay");
    });

    it("deposit rejects the native pseudo-address", async function () {
      const { vault, owner } = await deployArmed();
      await expect(vault.connect(owner).deposit(NATIVE, 1n)).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });

    it("a payee that rejects native coin makes the withdrawal revert (no silent loss)", async function () {
      const { vault, owner } = await deployArmed();
      const r = await ethers.deployContract("RejectEther");
      await expect(vault.connect(owner).withdraw(NATIVE, await r.getAddress(), 1n)).to.be.revertedWithCustomError(
        vault,
        "NativeTransferFailed"
      );
    });
  });
});
