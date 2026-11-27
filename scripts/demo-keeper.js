// Live keeper run on a real network, saved as evidence.
//   npx hardhat run scripts/demo-keeper.js --network qieTestnet
// Reuses the trap from the latest live-trip record and its keys in git-ignored keys/.
//   1. recovery makes the deployer the trap's keeper
//   2. a "bot" with bait2's key sweeps bait2's native QIE to a fresh thief address
//   3. the keeper scans that block and reports it
// Writes docs/runs/<date>-<network>-keeper-sweep.json (no private keys).
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { Keeper } = require("../keeper/keeper");

async function main() {
  const root = path.join(__dirname, "..");
  const day = new Date().toISOString().slice(0, 10);
  const trip = JSON.parse(fs.readFileSync(path.join(root, "docs", "runs", `${day}-${network.name}-live-trip.json`), "utf8"));
  const keyFiles = fs.readdirSync(path.join(root, "keys")).filter((f) => f.startsWith(`${network.name}-demo-`)).sort();
  const keys = JSON.parse(fs.readFileSync(path.join(root, "keys", keyFiles[keyFiles.length - 1]), "utf8"));

  const [keeperSigner] = await ethers.getSigners();
  const provider = ethers.provider;
  const recovery = new ethers.Wallet(keys.recovery, provider);
  const bait2 = new ethers.Wallet(keys.bait2, provider);
  if (bait2.address !== trip.actors.bait2) throw new Error("keys file does not match the live-trip record");
  const thief2 = ethers.Wallet.createRandom();

  const trap = await ethers.getContractAt("Trap", trip.contracts.trap);
  const registry = await ethers.getContractAt("FlagRegistry", trip.contracts.FlagRegistry);
  const txs = {};
  const send = async (name, p) => {
    const r = await (await p).wait();
    txs[name] = r.hash;
    console.log(`${name}: ${r.hash}`);
    return r;
  };

  await send("setKeeper", trap.connect(recovery).setKeeper(keeperSigner.address));
  await send("fundBait2", keeperSigner.sendTransaction({ to: bait2.address, value: ethers.parseEther("0.02") }));

  const before = { thief2Flagged: await registry.isFlagged(thief2.address), tripCount: Number(await trap.tripCount()) };

  // the "bot" sweeps bait2's native QIE with the leaked key
  const sweep = await send("botSweep", bait2.sendTransaction({ to: thief2.address, value: ethers.parseEther("0.015") }));

  const k = new Keeper({ provider, signer: keeperSigner, trapAddress: trip.contracts.trap });
  await k.loadBaits();
  const t0 = Date.now();
  const reports = await k.scanBlock(sweep.blockNumber);
  const reportMs = Date.now() - t0;

  const after = {
    thief2Flagged: await registry.isFlagged(thief2.address),
    tripCount: Number(await trap.tripCount()),
    lastTripViaToken: (await trap.trips(Number(await trap.tripCount()) - 1)).viaToken,
  };
  const out = {
    network: network.name,
    ranAt: new Date().toISOString(),
    trap: trip.contracts.trap,
    keeper: keeperSigner.address,
    bait: bait2.address,
    thief: thief2.address,
    before,
    after,
    sweepTx: sweep.hash,
    reports,
    keeperReportMs: reportMs,
    txs,
  };
  console.log(JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(root, "docs", "runs", `${day}-${network.name}-keeper-sweep.json`), JSON.stringify(out, null, 2) + "\n");
  if (!after.thief2Flagged || reports.length !== 1) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
