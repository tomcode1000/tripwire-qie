// End-to-end live trip on a real network, saved as evidence.
//   npx hardhat run scripts/demo-trip.js --network qieTestnet
// Uses deployments/<network>.json. Generates one-time recovery, bait and thief keys
// (kept in git-ignored keys/), then:
//   1. builder creates a vault and funds it
//   2. recovery arms a trap with two bait keys and makes the trap a guardian
//   3. the "thief" uses a stolen bait key to move the bait balance
//   4. we read back: vault locked (reason = leak label), thief flagged, trip recorded
// Writes docs/runs/<date>-<network>-live-trip.json (no private keys).
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const label = (s) => ethers.encodeBytes32String(s);

async function main() {
  const root = path.join(__dirname, "..");
  const dep = JSON.parse(fs.readFileSync(path.join(root, "deployments", `${network.name}.json`), "utf8"));
  const [builder] = await ethers.getSigners();
  const provider = ethers.provider;

  const keysDir = path.join(root, "keys");
  fs.mkdirSync(keysDir, { recursive: true });
  const mk = () => ethers.Wallet.createRandom().connect(provider);
  const recovery = mk(), bait1 = mk(), bait2 = mk(), thief = mk();
  fs.writeFileSync(
    path.join(keysDir, `${network.name}-demo-${Date.now()}.json`),
    JSON.stringify({ recovery: recovery.privateKey, bait1: bait1.privateKey, bait2: bait2.privateKey, thief: thief.privateKey }, null, 2)
  );

  const txs = {};
  const send = async (name, p) => {
    const tx = await p;
    const r = await tx.wait();
    txs[name] = r.hash;
    console.log(`${name}: ${r.hash}`);
    return r;
  };

  const factory = await ethers.getContractAt("TripwireFactory", dep.TripwireFactory.address);
  const registry = await ethers.getContractAt("FlagRegistry", dep.FlagRegistry.address);
  const bait = await ethers.getContractAt("BaitToken", dep.BaitToken.address);

  // gas for recovery (arms + settings) and for the thief's attempt from bait1
  await send("fundRecovery", builder.sendTransaction({ to: recovery.address, value: ethers.parseEther("0.05") }));
  await send("fundBait1Gas", builder.sendTransaction({ to: bait1.address, value: ethers.parseEther("0.01") }));

  // 1. vault
  const vaultAddr = await factory.createVault.staticCall(recovery.address, 24 * 3600);
  await send("createVault", factory.createVault(recovery.address, 24 * 3600));
  const vault = await ethers.getContractAt("TripwireVault", vaultAddr);
  await send("fundVault", builder.sendTransaction({ to: vaultAddr, value: ethers.parseEther("0.1") }));

  // 2. arm
  const labels = [label("github:demo-repo/.env"), label("notes:keys.txt")];
  const f = factory.connect(recovery);
  const trapAddr = await f.arm.staticCall(vaultAddr, ethers.ZeroAddress, [bait1.address, bait2.address], labels);
  await send("arm", f.arm(vaultAddr, ethers.ZeroAddress, [bait1.address, bait2.address], labels));
  await send("setGuardian", vault.connect(recovery).setGuardian(trapAddr, true));
  const trap = await ethers.getContractAt("Trap", trapAddr);

  const before = {
    vaultLocked: await vault.locked(),
    thiefFlagged: await registry.isFlagged(thief.address),
    bait1Balance: (await bait.balanceOf(bait1.address)).toString(),
  };

  // 3. thief uses the stolen bait key
  const t0 = Date.now();
  const r = await send("thiefAttempt", bait.connect(bait1).transfer(thief.address, 500_000_000n));
  const block = await provider.getBlock(r.blockNumber);

  // 4. read back
  const flag = await registry.flagOf(thief.address);
  const after = {
    vaultLocked: await vault.locked(),
    lockReason: ethers.decodeBytes32String(await vault.lockReason()),
    thiefFlagged: await registry.isFlagged(thief.address),
    thiefFlagCount: Number(flag.count),
    bait1Balance: (await bait.balanceOf(bait1.address)).toString(),
    thiefBaitBalance: (await bait.balanceOf(thief.address)).toString(),
    tripCount: Number(await trap.tripCount()),
  };

  const out = {
    network: network.name,
    chainId: dep.chainId,
    ranAt: new Date().toISOString(),
    contracts: { FlagRegistry: dep.FlagRegistry.address, TripwireFactory: dep.TripwireFactory.address, BaitToken: dep.BaitToken.address, vault: vaultAddr, trap: trapAddr },
    actors: { builder: builder.address, recovery: recovery.address, bait1: bait1.address, bait2: bait2.address, thief: thief.address },
    labels: ["github:demo-repo/.env", "notes:keys.txt"],
    before,
    after,
    thiefAttempt: { tx: r.hash, block: r.blockNumber, blockTime: new Date(block.timestamp * 1000).toISOString(), clientRoundTripMs: Date.now() - t0 },
    txs,
  };
  console.log(JSON.stringify(out, null, 2));
  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(root, "docs", "runs", `${day}-${network.name}-live-trip.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`saved ${file}`);
  if (!after.vaultLocked || !after.thiefFlagged || after.bait1Balance !== before.bait1Balance) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
