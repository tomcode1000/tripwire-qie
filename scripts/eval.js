// Offline attack evaluation on a local Hardhat chain.
//   npx hardhat run scripts/eval.js
// Runs N randomised attacks. Each run deploys a fresh system, funds a builder with 10 QIE
// and replays one attacker strategy against (a) a plain wallet and (b) Tripwire.
// Measures: was the attack detected, was the vault locked, how much QIE the attacker got,
// and whether any innocent address was flagged. Writes docs/runs/<date>-eval.json.
const { ethers, network } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const fs = require("fs");
const path = require("path");

const RUNS = Number(process.env.EVAL_RUNS || 50);
const REACT = process.env.REACT === "1";
const SEED = Number(process.env.EVAL_SEED || 20261127);
const FUNDS = ethers.parseEther("10");
const DAILY = ethers.parseEther("0.5");
const DAY = 24 * 3600;
const label = (s) => ethers.encodeBytes32String(s);

// small deterministic PRNG so the run is reproducible
let s = SEED;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const STRATEGIES = {
  // attacker has a bait key (leaked file) and the builder's everyday key
  "bait-transfer + owner drain": { usesBait: "transfer", hasOwnerKey: true },
  "bait-approve-sweeper + owner drain": { usesBait: "sweeper", hasOwnerKey: true },
  "native sweep of bait (keeper) + owner drain": { usesBait: "native", hasOwnerKey: true },
  // attacker has only a bait key
  "bait-transfer only": { usesBait: "transfer", hasOwnerKey: false },
  // honest limit: attacker never touches bait but holds the owner key
  "owner key only, bait untouched": { usesBait: "none", hasOwnerKey: true },
};

async function runOne(strategyName) {
  const st = STRATEGIES[strategyName];
  const signers = await ethers.getSigners();
  const [deployer, owner, recovery, keeper, attacker, innocent] = signers;
  const bait1 = ethers.Wallet.createRandom().connect(ethers.provider);
  await deployer.sendTransaction({ to: bait1.address, value: ethers.parseEther("0.01") });

  const registry = await ethers.deployContract("FlagRegistry");
  const factory = await ethers.deployContract("TripwireFactory", [await registry.getAddress()]);
  await registry.setFactory(await factory.getAddress());
  const bait = await ethers.getContractAt("BaitToken", await factory.baitToken());
  const vAddr = await factory.connect(owner).createVault.staticCall(recovery.address, DAY);
  await factory.connect(owner).createVault(recovery.address, DAY);
  const vault = await ethers.getContractAt("TripwireVault", vAddr);
  const tAddr = await factory.connect(recovery).arm.staticCall(vAddr, keeper.address, [bait1.address], [label("github:repo/.env")]);
  await factory.connect(recovery).arm(vAddr, keeper.address, [bait1.address], [label("github:repo/.env")]);
  const trap = await ethers.getContractAt("Trap", tAddr);
  await vault.connect(recovery).setGuardian(tAddr, true);
  await vault.connect(recovery).setDailyLimit(ethers.ZeroAddress, DAILY);
  await owner.sendTransaction({ to: vAddr, value: FUNDS });

  const atkStart = await ethers.provider.getBalance(attacker.address);
  const steps = [];

  // 1. bait step (order randomised against the owner-key step below)
  const baitStep = async () => {
    if (st.usesBait === "transfer") {
      await bait.connect(bait1).transfer(attacker.address, 500_000_000n);
      steps.push("bait.transfer");
    } else if (st.usesBait === "sweeper") {
      const bot = await ethers.deployContract("SweeperBot", [attacker.address]);
      await bait.connect(bait1).approve(await bot.getAddress(), ethers.MaxUint256);
      await bot.sweep(bait1.address, [await bait.getAddress()]);
      steps.push("bait.approve+sweep");
    } else if (st.usesBait === "native") {
      // the bot sweeps the bait's native coin; the keeper sees it and reports
      const bal = await ethers.provider.getBalance(bait1.address);
      const tx = await bait1.sendTransaction({ to: attacker.address, value: bal / 2n });
      await tx.wait();
      await trap.connect(keeper).tripByKeeper(bait1.address, attacker.address);
      steps.push("native sweep -> keeper");
    }
  };

  // 2. owner-key step: try everything a thief with the everyday key would try
  const ownerStep = async () => {
    if (!st.hasOwnerKey) return;
    const v = vault.connect(owner);
    const tryTx = async (name, p) => {
      try {
        await (await p).wait();
        steps.push(`${name}:ok`);
      } catch {
        steps.push(`${name}:blocked`);
      }
    };
    await tryTx("withdraw(all)", v.withdraw(ethers.ZeroAddress, attacker.address, FUNDS));
    await tryTx("withdraw(daily)", v.withdraw(ethers.ZeroAddress, attacker.address, DAILY));
    await tryTx("setDailyLimit", v.setDailyLimit(ethers.ZeroAddress, FUNDS));
    await tryTx("setGuardian(off)", v.setGuardian(tAddr, false));
    await tryTx("requestWithdraw(rest)", v.requestWithdraw(ethers.ZeroAddress, attacker.address, FUNDS - DAILY));
  };

  const baitFirst = rnd() < 0.5;
  if (baitFirst) {
    await baitStep();
    await ownerStep();
  } else {
    await ownerStep();
    await baitStep();
  }

  // builder reaction model. REACT=0 (default, worst case): the builder never checks.
  // REACT=1: the builder checks once within the 24h delay and cancels queued withdrawals
  // they did not make.
  if (REACT) {
    const n0 = Number(await vault.requestCount());
    for (let i = 0; i < n0; i++) {
      try {
        await (await vault.connect(recovery).cancelWithdraw(i)).wait();
        steps.push(`builder-cancel#${i}`);
      } catch {}
    }
  }
  await time.increase(DAY + 1);
  const n = Number(await vault.requestCount());
  for (let i = 0; i < n; i++) {
    try {
      await (await vault.connect(owner).executeWithdraw(i)).wait();
      steps.push(`execute#${i}:ok`);
    } catch {
      steps.push(`execute#${i}:blocked`);
    }
  }

  const locked = await vault.locked();
  // builder rescues to recovery once locked
  if (locked) await vault.connect(recovery).rescue(ethers.ZeroAddress);

  const atkEnd = await ethers.provider.getBalance(attacker.address);
  // attacker pays gas, so measure what reached the attacker from the vault: vault-out to attacker
  const vaultLeft = await ethers.provider.getBalance(vAddr);
  const recoveredToBuilder = locked ? FUNDS - (FUNDS - vaultLeft) : 0n; // informational
  const stolen = await stolenFromVault(vAddr, attacker.address);

  return {
    strategy: strategyName,
    baitFirst,
    detected: Number(await trap.tripCount()) > 0,
    vaultLocked: locked,
    attackerFlagged: await registry.isFlagged(attacker.address),
    innocentFlagged: await registry.isFlagged(innocent.address),
    stolenQIE: Number(ethers.formatEther(stolen)),
    plainWalletStolenQIE: Number(ethers.formatEther(st.hasOwnerKey ? FUNDS : 0n)),
    steps,
    _unused: [atkStart, atkEnd, recoveredToBuilder].length,
  };
}

// Sum of vault Withdrawn/WithdrawExecuted payouts that went to the attacker.
async function stolenFromVault(vAddr, attacker) {
  const vault = await ethers.getContractAt("TripwireVault", vAddr);
  let total = 0n;
  for (const ev of await vault.queryFilter(vault.filters.Withdrawn(null, attacker))) total += ev.args.amount;
  for (const ev of await vault.queryFilter(vault.filters.WithdrawExecuted())) {
    const r = await vault.requests(ev.args.id);
    if (r.to === attacker) total += r.amount;
  }
  return total;
}

async function main() {
  if (network.name !== "hardhat") throw new Error("eval runs on the local hardhat network only");
  const names = Object.keys(STRATEGIES);
  const results = [];
  for (let i = 0; i < RUNS; i++) {
    const name = i < names.length ? names[i] : pick(names); // every strategy at least once
    results.push(await runOne(name));
    process.stdout.write(".");
  }
  console.log();

  const by = {};
  for (const r of results) {
    const b = (by[r.strategy] ||= { runs: 0, detected: 0, locked: 0, attackerFlagged: 0, innocentFlagged: 0, stolenQIE: 0, plainWalletStolenQIE: 0 });
    b.runs++;
    b.detected += r.detected;
    b.locked += r.vaultLocked;
    b.attackerFlagged += r.attackerFlagged;
    b.innocentFlagged += r.innocentFlagged;
    b.stolenQIE += r.stolenQIE;
    b.plainWalletStolenQIE += r.plainWalletStolenQIE;
  }
  const tot = results.reduce(
    (a, r) => ({
      stolen: a.stolen + r.stolenQIE,
      plain: a.plain + r.plainWalletStolenQIE,
      innocent: a.innocent + r.innocentFlagged,
      baitRuns: a.baitRuns + (STRATEGIES[r.strategy].usesBait !== "none"),
      baitDetected: a.baitDetected + (STRATEGIES[r.strategy].usesBait !== "none" && r.detected),
    }),
    { stolen: 0, plain: 0, innocent: 0, baitRuns: 0, baitDetected: 0 }
  );

  const out = {
    ranAt: new Date().toISOString(),
    runs: RUNS,
    seed: SEED,
    fundsPerRunQIE: 10,
    dailyLimitQIE: 0.5,
    delayHours: 24,
    builderReaction: REACT ? "checks once within the 24h delay and cancels unknown withdrawals" : "none (worst case: builder never checks)",
    totals: {
      attacksTouchingBait: tot.baitRuns,
      detected: tot.baitDetected,
      innocentAddressesFlagged: tot.innocent,
      stolenWithTripwireQIE: +tot.stolen.toFixed(4),
      stolenFromPlainWalletQIE: +tot.plain.toFixed(4),
    },
    byStrategy: by,
    results,
  };
  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(__dirname, "..", "docs", "runs", `${day}-eval${REACT ? "-builder-reacts" : "-worst-case"}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify({ totals: out.totals, byStrategy: by }, null, 2));
  console.log(`saved ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
