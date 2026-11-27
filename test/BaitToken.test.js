const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployArmed } = require("./helpers");

describe("BaitToken: bait never leaves, every attempt trips the trap", function () {
  it("shows a 500 rUSD balance in each bait wallet", async function () {
    const { bait, bait1, bait2 } = await deployArmed();
    expect(await bait.balanceOf(bait1.address)).to.equal(500_000_000n);
    expect(await bait.balanceOf(bait2.address)).to.equal(500_000_000n);
    expect(await bait.decimals()).to.equal(6);
    expect(await bait.symbol()).to.equal("rUSD");
  });

  it("transfer() does not revert, does not move the balance, and trips the trap", async function () {
    const { bait, bait1, thief, trap, labels } = await deployArmed();
    await expect(bait.connect(bait1).transfer(thief.address, 500_000_000n))
      .to.emit(trap, "Tripped")
      .withArgs(bait1.address, labels[0], thief.address, true, 0);
    expect(await bait.balanceOf(bait1.address)).to.equal(500_000_000n);
    expect(await bait.balanceOf(thief.address)).to.equal(0n);
  });

  it("emits BaitTaken with the attempted amount", async function () {
    const { bait, bait1, thief, trap } = await deployArmed();
    await expect(bait.connect(bait1).transfer(thief.address, 123n))
      .to.emit(bait, "BaitTaken")
      .withArgs(bait1.address, thief.address, await trap.getAddress(), 123n);
  });

  it("approve() from a bait wallet trips the trap and flags the spender", async function () {
    const { bait, bait1, stranger, registry, trap } = await deployArmed();
    await expect(bait.connect(bait1).approve(stranger.address, 10n)).to.emit(trap, "Tripped");
    expect(await registry.isFlagged(stranger.address)).to.equal(true);
  });

  it("transferFrom() by a sweeper contract/spender trips the trap and flags the destination", async function () {
    const { bait, bait1, stranger, thief, registry, trap } = await deployArmed();
    await bait.connect(bait1).approve(stranger.address, 500_000_000n); // trip 1 (spender)
    await expect(bait.connect(stranger).transferFrom(bait1.address, thief.address, 1n))
      .to.emit(trap, "Tripped")
      .withArgs(bait1.address, await trap.labelOf(bait1.address), thief.address, true, 1);
    expect(await registry.isFlagged(thief.address)).to.equal(true);
    expect(await bait.balanceOf(thief.address)).to.equal(0n);
  });

  it("only the factory can arm bait", async function () {
    const { bait, stranger } = await deployArmed();
    await expect(bait.connect(stranger).arm(stranger.address, stranger.address, 1n)).to.be.revertedWithCustomError(
      bait,
      "NotFactory"
    );
  });

  it("each bait trips its own label", async function () {
    const { bait, bait2, thief, trap, labels } = await deployArmed();
    await expect(bait.connect(bait2).transfer(thief.address, 1n))
      .to.emit(trap, "Tripped")
      .withArgs(bait2.address, labels[1], thief.address, true, 0);
  });

  it("repeated attempts are all recorded", async function () {
    const { bait, bait1, thief, trap, registry } = await deployArmed();
    for (let i = 0; i < 3; i++) await bait.connect(bait1).transfer(thief.address, 1n);
    expect(await trap.tripCount()).to.equal(3n);
    expect((await registry.flagOf(thief.address)).count).to.equal(3);
  });

  it("transfer to the zero address is rejected by ERC-20 rules before any trip", async function () {
    const { bait, bait1 } = await deployArmed();
    await expect(bait.connect(bait1).transfer(ethers.ZeroAddress, 1n)).to.be.revertedWithCustomError(
      bait,
      "ERC20InvalidReceiver"
    );
  });
});
