#!/usr/bin/env node
// Tripwire command-line tool. Run without installing:
//   npx github:tomcode1000/tripwire-qie <command> [options]
//
// Keys are read from environment variables, never from the command line:
//   TRIPWIRE_KEY         your everyday key (owns the vault)       used by: vault
//   TRIPWIRE_BACKUP_KEY  your offline backup key                  used by: arm
//   TRIPWIRE_KEEPER_KEY  a key for the watcher (lock and flag only) used by: watch
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const L = require("../cli/lib");

const HELP = `Tripwire: the theft-alarm layer for QIE

Usage: npx github:tomcode1000/tripwire-qie <command> [options]

  check <address>                 Is this address on the blocklist?
  bait [--count 2] [--label L]... [--out ./tripwire-bait]
                                  Make fake keys and their .env files, here, offline
  vault --backup <address> [--delay 24h]
                                  Create your vault (needs TRIPWIRE_KEY)
  arm --vault <address> [--baits ./tripwire-bait/baits.json] [--keeper <address>]
                                  Set the trap and let it lock your vault (needs TRIPWIRE_BACKUP_KEY)
  status --trap <address>         Fake keys, catches, and whether your vault is locked
  watch --trap <address>          Run the watcher for native-coin sweeps (needs TRIPWIRE_KEEPER_KEY)
  addresses                       Print the contract addresses

Options: --network testnet|mainnet (default testnet)
Docs: https://github.com/tomcode1000/tripwire-qie/blob/main/docs/GETTING-STARTED.md`;

const REGISTRY_ABI = [
  "function isFlagged(address) view returns (bool)",
  "function flagOf(address) view returns (tuple(uint64 firstSeen,uint64 lastSeen,uint32 count,address lastTrap,address lastBait))",
];
const FACTORY_ABI = [
  "function createVault(address recovery, uint64 delay) returns (address)",
  "function arm(address vault, address keeper, address[] baits, bytes32[] labels) returns (address)",
  "event VaultCreated(address indexed owner, address indexed vault, address recovery, uint64 delay)",
  "event Armed(address indexed owner, address indexed trap, address indexed vault, uint256 baits)",
];
const VAULT_ABI = [
  "function recovery() view returns (address)",
  "function locked() view returns (bool)",
  "function lockReason() view returns (bytes32)",
  "function isGuardian(address) view returns (bool)",
  "function setGuardian(address guardian, bool enabled)",
];
const TRAP_ABI = [
  "function vault() view returns (address)",
  "function baitCount() view returns (uint256)",
  "function baits(uint256) view returns (address)",
  "function labelOf(address) view returns (bytes32)",
  "function tripCount() view returns (uint256)",
];

async function provider(net) {
  for (const url of net.rpc) {
    try {
      const p = new ethers.JsonRpcProvider(url, net.chainId, { staticNetwork: true, batchMaxCount: 1 });
      await p.getBlockNumber();
      return p;
    } catch {}
  }
  throw new Error(`can't reach ${net.name}; try again in a moment`);
}

function signer(envName, p) {
  const k = process.env[envName];
  if (!k) throw new Error(`set ${envName} in your environment (never pass keys on the command line)`);
  return new ethers.Wallet(k.trim(), p);
}

const need = (v, msg) => {
  if (!v || v === true) throw new Error(msg);
  return v;
};

const commands = {
  async addresses(a, net) {
    console.log(`${net.name} (chain ${net.chainId})`);
    console.log(`  Blocklist (FlagRegistry)  ${net.FlagRegistry}`);
    console.log(`  TripwireFactory           ${net.TripwireFactory}`);
    console.log(`  BaitToken (rUSD)          ${net.BaitToken}`);
    console.log(`  Explorer                  ${net.explorer}`);
  },

  async check(a, net) {
    const addr = need(a._[1], "usage: check <address>");
    if (!L.isAddress(addr)) throw new Error(`"${addr}" is not an address`);
    const r = new ethers.Contract(net.FlagRegistry, REGISTRY_ABI, await provider(net));
    if (await r.isFlagged(addr)) {
      const f = await r.flagOf(addr);
      console.log(`BLOCKLISTED  ${addr}`);
      console.log(`  took bait ${f.count} time(s), first ${new Date(Number(f.firstSeen) * 1000).toISOString()}`);
      console.log(`  ${net.explorer}/address/${addr}`);
      process.exitCode = 2; // so scripts can refuse to pay
    } else {
      console.log(`not blocklisted  ${addr}`);
    }
  },

  async bait(a, net) {
    const count = Number(a.count || [].concat(a.label || []).length || 2);
    if (!(count >= 1 && count <= 20)) throw new Error("--count must be between 1 and 20");
    const given = [].concat(a.label || []);
    const defaults = ["github:my-repo/.env", "notes:keys.txt", "ci:deploy-secret", "laptop:backup.env"];
    const labels = Array.from({ length: count }, (_, i) => L.checkLabel(given[i] || defaults[i] || `spot-${i + 1}`));
    const out = path.resolve(a.out && a.out !== true ? a.out : "tripwire-bait");
    fs.mkdirSync(out, { recursive: true });
    const baits = labels.map((label, i) => {
      const w = ethers.Wallet.createRandom();
      const file = L.baitFileName(i, label);
      fs.writeFileSync(path.join(out, file), L.baitFileContent(w.privateKey, "mainnet"), { mode: 0o600 });
      return { address: w.address, label, file };
    });
    fs.writeFileSync(path.join(out, "baits.json"), JSON.stringify({ network: net.key, baits }, null, 2) + "\n");
    console.log(`Made ${baits.length} fake key(s) in ${out}`);
    for (const b of baits) console.log(`  ${b.address}  ${b.label.padEnd(24)}  ${b.file}`);
    console.log(`\nNext: hide each .env file where its label says, then run "arm".`);
    console.log(`baits.json holds addresses and labels only; the keys are only in the .env files.`);
    console.log(`Never put real money in a bait wallet.`);
  },

  async vault(a, net) {
    const backup = need(a.backup, "usage: vault --backup <your offline backup key's address> [--delay 24h]");
    if (!L.isAddress(backup)) throw new Error("--backup must be an address");
    const delay = L.parseDelay(a.delay && a.delay !== true ? a.delay : "24h");
    const s = signer("TRIPWIRE_KEY", await provider(net));
    if (s.address.toLowerCase() === backup.toLowerCase()) throw new Error("your backup key must be a different wallet from TRIPWIRE_KEY");
    const f = new ethers.Contract(net.TripwireFactory, FACTORY_ABI, s);
    const tx = await f.createVault(backup, delay);
    console.log(`creating vault… ${net.explorer}/tx/${tx.hash}`);
    const r = await tx.wait();
    const ev = r.logs.map((l) => { try { return f.interface.parseLog(l); } catch { return null; } }).find((x) => x && x.name === "VaultCreated");
    console.log(`Vault ${ev.args.vault}`);
    console.log(`  owner ${s.address}, backup ${backup}, big withdrawals wait ${delay / 3600} h`);
    console.log(`\nNext: "bait", then "arm --vault ${ev.args.vault}" with TRIPWIRE_BACKUP_KEY set.`);
  },

  async arm(a, net) {
    const vaultAddr = need(a.vault, "usage: arm --vault <address> [--baits ./tripwire-bait/baits.json]");
    if (!L.isAddress(vaultAddr)) throw new Error("--vault must be an address");
    const file = path.resolve(a.baits && a.baits !== true ? a.baits : "tripwire-bait/baits.json");
    if (!fs.existsSync(file)) throw new Error(`can't find ${file}; run "bait" first`);
    const { baits } = JSON.parse(fs.readFileSync(file, "utf8"));
    const keeper = a.keeper && a.keeper !== true ? a.keeper : ethers.ZeroAddress;
    if (!L.isAddress(keeper)) throw new Error("--keeper must be an address");
    const s = signer("TRIPWIRE_BACKUP_KEY", await provider(net));
    const vault = new ethers.Contract(vaultAddr, VAULT_ABI, s);
    if ((await vault.recovery()).toLowerCase() !== s.address.toLowerCase()) throw new Error("TRIPWIRE_BACKUP_KEY is not this vault's backup key");
    const f = new ethers.Contract(net.TripwireFactory, FACTORY_ABI, s);
    const tx = await f.arm(vaultAddr, keeper, baits.map((b) => b.address), baits.map((b) => ethers.encodeBytes32String(L.checkLabel(b.label))));
    console.log(`setting the trap… ${net.explorer}/tx/${tx.hash}`);
    const r = await tx.wait();
    const ev = r.logs.map((l) => { try { return f.interface.parseLog(l); } catch { return null; } }).find((x) => x && x.name === "Armed");
    const trap = ev.args.trap;
    const g = await vault.setGuardian(trap, true);
    console.log(`letting the trap lock your vault… ${net.explorer}/tx/${g.hash}`);
    await g.wait();
    console.log(`Trap ${trap} is set with ${baits.length} fake key(s). Check it any time: status --trap ${trap}`);
  },

  async status(a, net) {
    const trapAddr = need(a.trap, "usage: status --trap <address>");
    const p = await provider(net);
    const t = new ethers.Contract(trapAddr, TRAP_ABI, p);
    const v = new ethers.Contract(await t.vault(), VAULT_ABI, p);
    const n = Number(await t.baitCount());
    console.log(`Trap ${trapAddr}`);
    for (let i = 0; i < n; i++) {
      const b = await t.baits(i);
      console.log(`  fake key ${b}  ${ethers.decodeBytes32String(await t.labelOf(b))}`);
    }
    const [locked, reason, guardian, trips] = await Promise.all([v.locked(), v.lockReason(), v.isGuardian(trapAddr), t.tripCount()]);
    console.log(`  trap can lock vault: ${guardian ? "yes" : "NO, run arm again or setGuardian from your backup key"}`);
    console.log(`  catches: ${trips}`);
    console.log(locked ? `  VAULT LOCKED. You leaked at: ${ethers.decodeBytes32String(reason)}` : "  vault open, nothing caught");
    if (locked) process.exitCode = 3;
  },

  async watch(a, net) {
    const trapAddr = need(a.trap, "usage: watch --trap <address>");
    const { Keeper } = require("../keeper/keeper");
    const p = await provider(net);
    const k = new Keeper({ provider: p, signer: signer("TRIPWIRE_KEEPER_KEY", p), trapAddress: trapAddr });
    await k.run({ pollMs: 3000 });
  },
};

async function main(argv) {
  const a = L.parseArgs(argv);
  const cmd = a._[0];
  if (!cmd || cmd === "help" || a.help) return console.log(HELP);
  if (!commands[cmd]) throw new Error(`unknown command "${cmd}". Run with --help.`);
  const net = L.loadNetwork(a.network && a.network !== true ? a.network : "testnet");
  await commands[cmd](a, net);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`tripwire: ${e.shortMessage || e.message}`);
    process.exit(1);
  });
}

module.exports = { main, HELP };
