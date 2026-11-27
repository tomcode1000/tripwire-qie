const { expect } = require("chai");
const { ethers } = require("hardhat");
const { findBaitUse, Keeper } = require("../keeper/keeper");
const { deployArmed } = require("./helpers");

describe("Keeper: catches native-coin sweeps from bait wallets", function () {
  describe("findBaitUse (pure)", function () {
    const bait = "0x000000000000000000000000000000000000bA17";
    const set = new Set([bait.toLowerCase()]);

    it("returns transactions sent from a bait wallet, case-insensitively", function () {
      const hits = findBaitUse(
        [
          { from: bait.toUpperCase().replace("0X", "0x"), to: "0x00000000000000000000000000000000000000aa", hash: "0x1", value: 5n },
          { from: "0x00000000000000000000000000000000000000bb", to: bait, hash: "0x2", value: 1n },
        ],
        set
      );
      expect(hits).to.have.length(1);
      expect(hits[0].hash).to.equal("0x1");
    });

    it("ignores incoming transfers to bait (funding bait is not a theft)", function () {
      expect(findBaitUse([{ from: "0x00000000000000000000000000000000000000cc", to: bait, hash: "0x3", value: 1n }], set)).to.have.length(0);
    });

    it("handles empty blocks and missing senders", function () {
      expect(findBaitUse([], set)).to.deep.equal([]);
      expect(findBaitUse([{ from: null, to: bait, hash: "0x4", value: 0n }], set)).to.deep.equal([]);
    });
  });

  describe("Keeper on a chain", function () {
    async function setup() {
      const ctx = await deployArmed();
      // the bait wallets in helpers are hardhat signers, so they can "be robbed" here
      const keeper = new Keeper({ provider: ethers.provider, signer: ctx.keeper, trapAddress: await ctx.trap.getAddress(), log: () => {} });
      await keeper.loadBaits();
      return { ...ctx, k: keeper };
    }

    it("a native sweep from bait is reported: vault locks, thief flagged", async function () {
      const { k, bait1, thief, vault, registry, trap } = await setup();
      const tx = await bait1.sendTransaction({ to: thief.address, value: ethers.parseEther("1") });
      const r = await tx.wait();
      const reports = await k.scanBlock(r.blockNumber);
      expect(reports).to.have.length(1);
      expect(reports[0].taker).to.equal(thief.address);
      expect(await vault.locked()).to.equal(true);
      expect(await registry.isFlagged(thief.address)).to.equal(true);
      const t = await trap.trips(0);
      expect(t.viaToken).to.equal(false);
    });

    it("does not report the same sweep twice", async function () {
      const { k, bait1, thief, trap } = await setup();
      const r = await (await bait1.sendTransaction({ to: thief.address, value: 1n })).wait();
      await k.scanBlock(r.blockNumber);
      expect(await k.scanBlock(r.blockNumber)).to.have.length(0);
      expect(await trap.tripCount()).to.equal(1n);
    });

    it("blocks without bait activity produce no reports", async function () {
      const { k, stranger, payee, trap } = await setup();
      const r = await (await stranger.sendTransaction({ to: payee.address, value: 1n })).wait();
      expect(await k.scanBlock(r.blockNumber)).to.have.length(0);
      expect(await trap.tripCount()).to.equal(0n);
    });

    it("a keeper key that is not the trap's keeper cannot report", async function () {
      const { trap, stranger, bait1, thief } = await setup();
      const fake = new Keeper({ provider: ethers.provider, signer: stranger, trapAddress: await trap.getAddress(), log: () => {} });
      await fake.loadBaits();
      const r = await (await bait1.sendTransaction({ to: thief.address, value: 1n })).wait();
      let err;
      try {
        await fake.scanBlock(r.blockNumber);
      } catch (e) {
        err = e;
      }
      expect(err).to.exist;
      expect(await trap.tripCount()).to.equal(0n);
    });
  });
});
