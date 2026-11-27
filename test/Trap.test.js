const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployArmed, label } = require("./helpers");

describe("Trap: a trip locks the vault, flags the taker and names the leak", function () {
  it("records the trip and locks the vault with the leak label as reason", async function () {
    const { bait, bait1, thief, trap, vault, labels } = await deployArmed();
    await bait.connect(bait1).transfer(thief.address, 1n);
    expect(await vault.locked()).to.equal(true);
    expect(await vault.lockReason()).to.equal(labels[0]);
    const t = await trap.trips(0);
    expect(t.bait).to.equal(bait1.address);
    expect(t.taker).to.equal(thief.address);
    expect(t.viaToken).to.equal(true);
    expect(ethers.decodeBytes32String(await trap.labelOf(bait1.address))).to.equal("github:zelkaro/.env");
  });

  it("keeper can report a native-coin sweep (lock + flag, no funds moved)", async function () {
    const { keeper, bait2, thief, trap, vault, registry } = await deployArmed();
    const before = await ethers.provider.getBalance(await vault.getAddress());
    await expect(trap.connect(keeper).tripByKeeper(bait2.address, thief.address))
      .to.emit(trap, "Tripped")
      .withArgs(bait2.address, label("drive:notes.txt"), thief.address, false, 0);
    expect(await vault.locked()).to.equal(true);
    expect(await registry.isFlagged(thief.address)).to.equal(true);
    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(before);
  });

  it("only the keeper can report sweeps", async function () {
    const { stranger, bait1, thief, trap } = await deployArmed();
    await expect(trap.connect(stranger).tripByKeeper(bait1.address, thief.address)).to.be.revertedWithCustomError(
      trap,
      "NotKeeper"
    );
  });

  it("only the bait token can trip by token", async function () {
    const { stranger, bait1, thief, trap } = await deployArmed();
    await expect(trap.connect(stranger).tripByToken(bait1.address, thief.address)).to.be.revertedWithCustomError(
      trap,
      "NotBaitToken"
    );
  });

  it("unknown bait cannot be tripped (no fake flags against innocent addresses)", async function () {
    const { keeper, stranger, thief, trap } = await deployArmed();
    await expect(trap.connect(keeper).tripByKeeper(stranger.address, thief.address)).to.be.revertedWithCustomError(
      trap,
      "UnknownBait"
    );
  });

  it("a trip still flags the taker when the trap is not a guardian (lock fails safely)", async function () {
    const { bait, bait1, thief, trap, vault, registry, recovery } = await deployArmed();
    await vault.connect(recovery).setGuardian(await trap.getAddress(), false);
    await expect(bait.connect(bait1).transfer(thief.address, 1n)).to.emit(trap, "LockFailed");
    expect(await vault.locked()).to.equal(false);
    expect(await registry.isFlagged(thief.address)).to.equal(true);
  });

  it("a second trip on a locked vault does not revert", async function () {
    const { bait, bait1, bait2, thief, trap } = await deployArmed();
    await bait.connect(bait1).transfer(thief.address, 1n);
    await expect(bait.connect(bait2).transfer(thief.address, 1n)).to.emit(trap, "Tripped");
    expect(await trap.tripCount()).to.equal(2n);
  });

  it("owner can add more bait; duplicates and empty labels are rejected", async function () {
    const { recovery, stranger, bait1, trap } = await deployArmed();
    await expect(trap.connect(recovery).addBait(stranger.address, label("email:draft"))).to.emit(trap, "BaitAdded");
    expect(await trap.baitCount()).to.equal(3n);
    await expect(trap.connect(recovery).addBait(bait1.address, label("x"))).to.be.revertedWithCustomError(
      trap,
      "DuplicateBait"
    );
    await expect(trap.connect(recovery).addBait(ethers.Wallet.createRandom().address, ethers.ZeroHash)).to.be.revertedWithCustomError(
      trap,
      "UnknownBait"
    );
    await expect(trap.connect(recovery).addBait(ethers.ZeroAddress, label("x"))).to.be.revertedWithCustomError(
      trap,
      "ZeroAddress"
    );
  });

  it("strangers cannot add bait, change keeper or set the bait token", async function () {
    const { stranger, trap } = await deployArmed();
    await expect(trap.connect(stranger).addBait(stranger.address, label("x"))).to.be.revertedWithCustomError(trap, "NotOwner");
    await expect(trap.connect(stranger).setKeeper(stranger.address)).to.be.revertedWithCustomError(trap, "NotOwner");
    await expect(trap.connect(stranger).setBaitToken(stranger.address)).to.be.revertedWithCustomError(trap, "NotFactory");
  });

  it("owner can rotate or remove the keeper", async function () {
    const { recovery, keeper, stranger, bait1, thief, trap } = await deployArmed();
    await expect(trap.connect(recovery).setKeeper(stranger.address)).to.emit(trap, "KeeperSet").withArgs(stranger.address);
    await expect(trap.connect(keeper).tripByKeeper(bait1.address, thief.address)).to.be.revertedWithCustomError(trap, "NotKeeper");
    await trap.connect(recovery).setKeeper(ethers.ZeroAddress);
    await expect(trap.connect(stranger).tripByKeeper(bait1.address, thief.address)).to.be.revertedWithCustomError(trap, "NotKeeper");
  });

  it("constructor rejects zero addresses", async function () {
    const { registry, vault, owner } = await deployArmed();
    const Trap = await ethers.getContractFactory("Trap");
    await expect(Trap.deploy(ethers.ZeroAddress, await vault.getAddress(), await registry.getAddress(), owner.address)).to.be.revertedWithCustomError(Trap, "ZeroAddress");
    await expect(Trap.deploy(owner.address, ethers.ZeroAddress, await registry.getAddress(), owner.address)).to.be.revertedWithCustomError(Trap, "ZeroAddress");
    await expect(Trap.deploy(owner.address, await vault.getAddress(), ethers.ZeroAddress, owner.address)).to.be.revertedWithCustomError(Trap, "ZeroAddress");
  });
});
