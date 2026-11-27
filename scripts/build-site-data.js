// Builds web/data.json from committed evidence only (deployments/, docs/runs/, docs/assets/).
// Every number on the website comes from this file or from a live chain read, and each one
// carries a link to its source record. Usage: node scripts/build-site-data.js
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const REPO = "https://github.com/tomcode1000/tripwire-qie";
const blob = (p) => `${REPO}/blob/main/${p}`;
const runs = fs.readdirSync(path.join(root, "docs", "runs"));
const latest = (re) => runs.filter((f) => re.test(f)).sort().pop();

const dep = read("deployments/qieTestnet.json");
const tripFile = latest(/qieTestnet-live-trip\.json$/);
const keeperFile = latest(/qieTestnet-keeper-sweep\.json$/);
const worstFile = latest(/eval-worst-case\.json$/);
const reactFile = latest(/eval-builder-reacts\.json$/);
const activityFile = latest(/qie-activity-summary\.json$/);
const trip = read(`docs/runs/${tripFile}`);
const keeper = read(`docs/runs/${keeperFile}`);
const worst = read(`docs/runs/${worstFile}`);
const react = read(`docs/runs/${reactFile}`);
const activity = read(`docs/runs/${activityFile}`);
const tests = read("docs/assets/test-summary.json");

const explorer = "https://testnet.qie.digital";
const data = {
  builtAt: new Date().toISOString(),
  repo: REPO,
  network: {
    name: "QIE testnet",
    chainId: dep.chainId,
    rpc: ["https://rpc4testnet.qie.digital", "https://rpc5testnet.qie.digital"],
    explorer,
  },
  contracts: {
    FlagRegistry: dep.FlagRegistry.address,
    TripwireFactory: dep.TripwireFactory.address,
    BaitToken: dep.BaitToken.address,
    deployBlockHint: Math.min(trip.thiefAttempt.block, keeper.reports[0].block) - 400,
    source: blob("deployments/qieTestnet.json"),
  },
  liveTrip: {
    tx: trip.thiefAttempt.tx,
    block: trip.thiefAttempt.block,
    time: trip.thiefAttempt.blockTime,
    bait: trip.actors.bait1,
    thief: trip.actors.thief,
    vault: trip.contracts.vault,
    trap: trip.contracts.trap,
    lockReason: trip.after.lockReason,
    vaultLocked: trip.after.vaultLocked,
    thiefFlagged: trip.after.thiefFlagged,
    baitBefore: Number(trip.before.bait1Balance) / 1e6,
    baitAfter: Number(trip.after.bait1Balance) / 1e6,
    thiefReceived: Number(trip.after.thiefBaitBalance) / 1e6,
    source: blob(`docs/runs/${tripFile}`),
  },
  keeper: {
    sweepTx: keeper.sweepTx,
    reportTx: keeper.reports[0].reportTx,
    thief: keeper.thief,
    reportSeconds: +(keeper.keeperReportMs / 1000).toFixed(1),
    source: blob(`docs/runs/${keeperFile}`),
  },
  eval: {
    runs: worst.runs,
    seed: worst.seed,
    baitAttacks: worst.totals.attacksTouchingBait,
    caught: worst.totals.detected,
    innocentFlagged: worst.totals.innocentAddressesFlagged + react.totals.innocentAddressesFlagged,
    plainStolen: worst.totals.stolenFromPlainWalletQIE,
    tripwireStolenWorst: worst.totals.stolenWithTripwireQIE,
    tripwireStolenReact: react.totals.stolenWithTripwireQIE,
    byStrategy: Object.entries(worst.byStrategy).map(([name, w]) => ({
      name,
      runs: w.runs,
      caught: w.detected,
      plain: w.plainWalletStolenQIE,
      worst: w.stolenQIE,
      react: react.byStrategy[name].stolenQIE,
    })),
    source: blob("docs/EVAL.md"),
    rawWorst: blob(`docs/runs/${worstFile}`),
    rawReact: blob(`docs/runs/${reactFile}`),
  },
  tests: {
    passing: tests.passing,
    failing: tests.failing,
    coverage: tests.coverage,
    source: blob("docs/assets/test-report.txt"),
    evidence: blob("docs/EVIDENCE.md"),
  },
  qie: {
    gasPriceGwei: activity.gas_price_wei / 1e9,
    transferCostQie: activity.simple_transfer_cost_qie,
    deployGas: Number(dep.gasUsed),
    sample: { tx: activity.transactions, senders: activity.unique_senders, topShare: activity.top_sender.share },
    source: blob(`docs/runs/${activityFile}`),
  },
};

const out = path.join(root, "web", "data.json");
fs.writeFileSync(out, JSON.stringify(data, null, 2) + "\n");
console.log(`wrote ${out}`);
