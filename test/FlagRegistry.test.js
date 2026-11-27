const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployArmed } = require("./helpers");

describe("FlagRegistry: public list of bait takers", function () {
  it("starts empty and answers isFlagged for anyone", async function () {
    const { registry, thief } = await deployArmed();
    expect(await registry.isFlagged(thief.address)).to.equal(false);
    expect(await registry.flaggedCount()).to.equal(0n);
  });

  it("records first and last seen, count, trap and bait", async function () {
    const { bait, bait1, bait2, thief, registry, trap } = await deployArmed();
    await bait.connect(bait1).transfer(thief.address, 1n);
    const first = await registry.flagOf(thief.address);
    await bait.connect(bait2).transfer(thief.address, 1n);
    const f = await registry.flagOf(thief.address);
    expect(f.count).to.equal(2);
    expect(f.firstSeen).to.equal(first.firstSeen);
    expect(f.lastSeen).to.be.gte(first.lastSeen);
    expect(f.lastTrap).to.equal(await trap.getAddress());
    expect(f.lastBait).to.equal(bait2.address);
    expect(await registry.flaggedCount()).to.equal(1n); // one unique address
  });

  it("only registered traps can flag", async function () {
    const { registry, stranger, thief } = await deployArmed();
    await expect(registry.connect(stranger).flag(thief.address, stranger.address)).to.be.revertedWithCustomError(
      registry,
      "NotTrap"
    );
  });

  it("only the factory can register traps", async function () {
    const { registry, stranger } = await deployArmed();
    await expect(registry.connect(stranger).registerTrap(stranger.address)).to.be.revertedWithCustomError(
      registry,
      "NotFactory"
    );
  });

  it("factory can be set once, only by the deployer, never to zero", async function () {
    const [d, other] = await ethers.getSigners();
    const r = await ethers.deployContract("FlagRegistry");
    await expect(r.connect(other).setFactory(other.address)).to.be.revertedWithCustomError(r, "NotDeployer");
    await expect(r.setFactory(ethers.ZeroAddress)).to.be.revertedWithCustomError(r, "ZeroAddress");
    await expect(r.setFactory(other.address)).to.emit(r, "FactorySet").withArgs(other.address);
    await expect(r.setFactory(d.address)).to.be.revertedWithCustomError(r, "FactoryAlreadySet");
  });

  it("a registered trap cannot flag the zero address", async function () {
    const [d, fakeFactory, fakeTrap] = await ethers.getSigners();
    const r = await ethers.deployContract("FlagRegistry");
    await r.setFactory(fakeFactory.address);
    await r.connect(fakeFactory).registerTrap(fakeTrap.address);
    await expect(r.connect(fakeTrap).flag(ethers.ZeroAddress, d.address)).to.be.revertedWithCustomError(r, "ZeroAddress");
  });
});
