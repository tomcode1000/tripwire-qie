// Tripwire keeper: watches bait wallets for native-coin sweeps and reports them to the trap.
// A sweep of native QIE is a plain transfer, so no contract sees it; the keeper does.
// The keeper can only call Trap.tripByKeeper, which locks the vault and flags the taker.
// It can never move funds.
//
//   KEEPER_KEY=0x... TRAP=0x... node keeper/keeper.js --rpc https://rpc4testnet.qie.digital
const { ethers } = require("ethers");

const TRAP_ABI = [
  "function baitCount() view returns (uint256)",
  "function baits(uint256) view returns (address)",
  "function keeper() view returns (address)",
  "function tripByKeeper(address bait, address taker)",
];

/**
 * Pure detection step: given a block's transactions and the bait set, return every
 * transaction sent FROM a bait wallet (any outgoing tx from bait is someone using a leaked key).
 * @param {Array<{from:string,to:string|null,hash:string,value:bigint}>} txs
 * @param {Set<string>} baitSet lower-cased bait addresses
 */
function findBaitUse(txs, baitSet) {
  const hits = [];
  for (const tx of txs) {
    if (!tx.from) continue;
    if (baitSet.has(tx.from.toLowerCase())) {
      hits.push({ bait: tx.from, taker: tx.to, hash: tx.hash, value: tx.value });
    }
  }
  return hits;
}

class Keeper {
  constructor({ provider, signer, trapAddress, log = console.log }) {
    this.provider = provider;
    this.trap = new ethers.Contract(trapAddress, TRAP_ABI, signer);
    this.log = log;
    this.reported = new Set();
  }

  async loadBaits() {
    const n = Number(await this.trap.baitCount());
    const baits = [];
    for (let i = 0; i < n; i++) baits.push((await this.trap.baits(i)).toLowerCase());
    this.baitSet = new Set(baits);
    return baits;
  }

  /** Scan one block; report each new bait use. Returns the reports made. */
  async scanBlock(blockNumber) {
    const block = await this.provider.getBlock(blockNumber, true);
    const txs = block.prefetchedTransactions.map((t) => ({ from: t.from, to: t.to, hash: t.hash, value: t.value }));
    const reports = [];
    for (const hit of findBaitUse(txs, this.baitSet)) {
      if (this.reported.has(hit.hash)) continue;
      // Calls to the bait token are already tripped on-chain; still flagging the
      // destination is harmless, but contract calls have the token/bot as `to`.
      // For native sweeps `to` is the thief's address.
      if (!hit.taker) continue;
      const tx = await this.trap.tripByKeeper(hit.bait, hit.taker);
      const r = await tx.wait();
      this.reported.add(hit.hash);
      const report = { bait: hit.bait, taker: hit.taker, sweepTx: hit.hash, reportTx: r.hash, block: blockNumber };
      reports.push(report);
      this.log(`TRIP bait=${hit.bait} taker=${hit.taker} sweep=${hit.hash} report=${r.hash}`);
    }
    return reports;
  }

  async run({ fromBlock, pollMs = 3000 } = {}) {
    await this.loadBaits();
    let next = fromBlock ?? (await this.provider.getBlockNumber());
    this.log(`watching ${this.baitSet.size} bait wallets from block ${next}`);
    for (;;) {
      const head = await this.provider.getBlockNumber();
      while (next <= head) await this.scanBlock(next++);
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }
}

module.exports = { findBaitUse, Keeper, TRAP_ABI };

if (require.main === module) {
  const arg = (k, d) => {
    const i = process.argv.indexOf(k);
    return i > 0 ? process.argv[i + 1] : d;
  };
  const provider = new ethers.JsonRpcProvider(arg("--rpc", process.env.RPC || "https://rpc4testnet.qie.digital"));
  const signer = new ethers.Wallet(process.env.KEEPER_KEY, provider);
  const k = new Keeper({ provider, signer, trapAddress: process.env.TRAP });
  k.run({ fromBlock: process.env.FROM_BLOCK ? Number(process.env.FROM_BLOCK) : undefined }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
