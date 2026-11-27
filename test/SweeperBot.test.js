const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployArmed } = require("./helpers");

// Real drainers approve a sweeper contract from the stolen key, then pull every token
// in one call. These tests run that exact pattern against bait.
describe("Sweeper bots: the drainer pattern trips the trap at both steps", function () {
  async function setup() {
    const ctx = await deployArmed();
    const bot = await ethers.deployContract("SweeperBot", [ctx.thief.address]);
    const real = await ethers.deployContract("MockERC20"); // a real token the bait wallet also holds
    await real.mint(ctx.bait1.address, 1000n);
    return { ...ctx, bot, real };
  }

  it("step 1: approving the sweeper trips the trap and flags the sweeper contract", async function () {
    const { bait, bait1, bot, registry, vault } = await setup();
    await bait.connect(bait1).approve(await bot.getAddress(), ethers.MaxUint256);
    expect(await registry.isFlagged(await bot.getAddress())).to.equal(true);
    expect(await vault.locked()).to.equal(true);
  });

  it("step 2: the sweep trips again, flags the attacker, and moves no bait", async function () {
    const { bait, bait1, bot, thief, registry, trap, real } = await setup();
    await bait.connect(bait1).approve(await bot.getAddress(), ethers.MaxUint256);
    await real.connect(bait1).approve(await bot.getAddress(), ethers.MaxUint256);
    await bot.sweep(bait1.address, [await bait.getAddress(), await real.getAddress()]);
    expect(await registry.isFlagged(thief.address)).to.equal(true);
    expect(await trap.tripCount()).to.equal(2n); // approve + sweep
    expect(await bait.balanceOf(bait1.address)).to.equal(500_000_000n);
    expect(await bait.balanceOf(thief.address)).to.equal(0n);
    // the real token in the bait wallet is swept as usual; bait wallets should hold no real value
    expect(await real.balanceOf(thief.address)).to.equal(1000n);
  });

  it("a sweep that skips approve still cannot move bait (no allowance) and does not revert other tokens", async function () {
    const { bait, bait1, bot, thief, real } = await setup();
    await real.connect(bait1).approve(await bot.getAddress(), ethers.MaxUint256);
    await bot.sweep(bait1.address, [await bait.getAddress(), await real.getAddress()]);
    expect(await bait.balanceOf(thief.address)).to.equal(0n);
    expect(await real.balanceOf(thief.address)).to.equal(1000n);
  });

  it("after the trip, any app can refuse the attacker with one call", async function () {
    const { bait, bait1, thief, registry, stranger } = await setup();
    await bait.connect(bait1).transfer(thief.address, 1n);
    expect(await registry.isFlagged(thief.address)).to.equal(true);
    expect(await registry.isFlagged(stranger.address)).to.equal(false);
  });
});
