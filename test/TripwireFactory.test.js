const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployArmed, DAY, label } = require("./helpers");

describe("TripwireFactory: arm a builder in one transaction", function () {
  it("creates a vault owned by the caller with the given recovery and delay", async function () {
    const { vault, owner, recovery } = await deployArmed();
    expect(await vault.owner()).to.equal(owner.address);
    expect(await vault.recovery()).to.equal(recovery.address);
    expect(await vault.delay()).to.equal(BigInt(DAY));
  });

  it("arms a trap, registers it and mints bait to every bait wallet", async function () {
    const { factory, registry, trap, bait, recovery, bait1, bait2 } = await deployArmed();
    expect(await registry.isTrap(await trap.getAddress())).to.equal(true);
    expect(await factory.trapCount()).to.equal(1n);
    expect(await factory.trapsOf(recovery.address, 0)).to.equal(await trap.getAddress());
    expect(await trap.baitCount()).to.equal(2n);
    expect(await bait.trapOf(bait1.address)).to.equal(await trap.getAddress());
    expect(await bait.trapOf(bait2.address)).to.equal(await trap.getAddress());
    expect(await trap.baitToken()).to.equal(await bait.getAddress());
  });

  it("only the vault's recovery address can arm it", async function () {
    const { factory, vault, owner } = await deployArmed();
    const b = ethers.Wallet.createRandom().address;
    await expect(
      factory.connect(owner).arm(await vault.getAddress(), ethers.ZeroAddress, [b], [label("x")])
    ).to.be.revertedWithCustomError(factory, "NotVaultRecovery");
  });

  it("rejects empty or mismatched bait lists", async function () {
    const { factory, vault, recovery } = await deployArmed();
    const v = await vault.getAddress();
    await expect(factory.connect(recovery).arm(v, ethers.ZeroAddress, [], [])).to.be.revertedWithCustomError(factory, "NoBaits");
    await expect(
      factory.connect(recovery).arm(v, ethers.ZeroAddress, [ethers.Wallet.createRandom().address], [])
    ).to.be.revertedWithCustomError(factory, "LengthMismatch");
  });

  it("emits Armed and VaultCreated", async function () {
    const { factory, recovery, owner } = await deployArmed();
    await expect(factory.connect(owner).createVault(recovery.address, DAY)).to.emit(factory, "VaultCreated");
    const v = (await ethers.getContractAt("TripwireVault", await factory.connect(owner).createVault.staticCall(recovery.address, DAY)));
    await factory.connect(owner).createVault(recovery.address, DAY);
    await expect(
      factory.connect(recovery).arm(await v.getAddress(), ethers.ZeroAddress, [ethers.Wallet.createRandom().address], [label("x")])
    ).to.emit(factory, "Armed");
  });

  it("two builders' traps are independent", async function () {
    const ctx = await deployArmed();
    const { factory, bait, stranger, payee, thief } = ctx;
    // second builder: stranger owns, payee is recovery
    const v2addr = await factory.connect(stranger).createVault.staticCall(payee.address, DAY);
    await factory.connect(stranger).createVault(payee.address, DAY);
    const b = ethers.Wallet.createRandom().connect(ethers.provider);
    const t2addr = await factory.connect(payee).arm.staticCall(v2addr, ethers.ZeroAddress, [b.address], [label("ci:secrets")]);
    await factory.connect(payee).arm(v2addr, ethers.ZeroAddress, [b.address], [label("ci:secrets")]);
    const v2 = await ethers.getContractAt("TripwireVault", v2addr);
    await v2.connect(payee).setGuardian(t2addr, true);
    // trip builder 1's bait: only vault 1 locks
    await bait.connect(ctx.bait1).transfer(thief.address, 1n);
    expect(await ctx.vault.locked()).to.equal(true);
    expect(await v2.locked()).to.equal(false);
  });
});
