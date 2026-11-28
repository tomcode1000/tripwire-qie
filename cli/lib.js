// Pure helpers for the Tripwire CLI (no network), so they can be unit-tested.
const fs = require("fs");
const path = require("path");

const NETWORKS = {
  testnet: {
    name: "QIE testnet",
    chainId: 1983,
    rpc: ["https://rpc5testnet.qie.digital", "https://rpc4testnet.qie.digital"],
    explorer: "https://testnet.qie.digital",
    deployment: "qieTestnet.json",
  },
  mainnet: {
    name: "QIE mainnet",
    chainId: 1990,
    rpc: ["https://rpc1mainnet.qie.digital", "https://rpc2mainnet.qie.digital"],
    explorer: "https://mainnet.qie.digital",
    deployment: "qieMainnet.json",
  },
};

/** Contract addresses for a network, from deployments/<file>. Throws a clear error if not deployed. */
function loadNetwork(name = "testnet") {
  const net = NETWORKS[name];
  if (!net) throw new Error(`unknown network "${name}" (use testnet or mainnet)`);
  const file = path.join(__dirname, "..", "deployments", net.deployment);
  if (!fs.existsSync(file)) throw new Error(`Tripwire is not deployed on ${net.name} yet`);
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    ...net,
    key: name,
    FlagRegistry: d.FlagRegistry.address,
    TripwireFactory: d.TripwireFactory.address,
    BaitToken: d.BaitToken.address,
    deployBlock: Number(process.env.TRIPWIRE_FROM_BLOCK || 0) || null,
  };
}

/** "24h" | "12h" | "2d" | "3600" (seconds) -> seconds. Vault limits: 1 hour to 30 days. */
function parseDelay(v) {
  const m = String(v).trim().match(/^(\d+)\s*([smhd]?)$/i);
  if (!m) throw new Error(`can't read delay "${v}" (try 24h, 12h, 2d)`);
  const mult = { "": 1, s: 1, m: 60, h: 3600, d: 86400 }[m[2].toLowerCase()];
  const secs = Number(m[1]) * mult;
  if (secs < 3600 || secs > 30 * 86400) throw new Error("delay must be between 1 hour and 30 days");
  return secs;
}

/** Labels are stored on-chain as bytes32, so at most 31 bytes of UTF-8. */
function checkLabel(label) {
  const l = String(label || "").trim();
  if (!l) throw new Error("every fake key needs a label saying where you will hide it, e.g. github:my-repo/.env");
  if (Buffer.byteLength(l, "utf8") > 31) throw new Error(`label "${l}" is longer than 31 bytes`);
  return l;
}

/** The text of a bait file: it must look exactly like a real deploy config. */
function baitFileContent(privateKey, network = "mainnet") {
  const net = NETWORKS[network] || NETWORKS.mainnet;
  return `# deploy config\nPRIVATE_KEY=${privateKey}\nRPC_URL=${net.rpc[0]}\nCHAIN_ID=${net.chainId}\n`;
}

/** A safe file name for a bait file from its label. */
function baitFileName(i, label) {
  return `bait-${i + 1}-${String(label).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "env"}.env`;
}

/** Split [from, to] into windows no wider than `step + 1` blocks (QIE RPC limit is 10,000). */
function blockWindows(from, to, step = 9999) {
  const out = [];
  for (let a = from; a <= to; a += step + 1) out.push([a, Math.min(a + step, to)]);
  return out;
}

/** Minimal argv parser: positional args plus --flag value (repeatable) and --bool. */
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const next = argv[i + 1];
      const v = next === undefined || next.startsWith("--") ? true : (i++, next);
      if (out[k] === undefined) out[k] = v;
      else out[k] = [].concat(out[k], v);
    } else out._.push(a);
  }
  return out;
}

const isAddress = (a) => /^0x[0-9a-fA-F]{40}$/.test(String(a || ""));

module.exports = { NETWORKS, loadNetwork, parseDelay, checkLabel, baitFileContent, baitFileName, blockWindows, parseArgs, isAddress };
