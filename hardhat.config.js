require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("solidity-coverage");

// Load KEY=value lines from a local, git-ignored .env (no extra dependency).
const fs = require("fs");
if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const accounts = process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  mocha: { reporter: process.env.MOCHA_REPORTER || "spec" },
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // QIE V3 is EVM-compatible; paris avoids PUSH0/MCOPY so bytecode runs on any EVM version.
      evmVersion: "paris",
    },
  },
  networks: {
    // rpc1-3testnet were timing out on 2026-11-27; rpc4/rpc5 answered.
    qieTestnet: { url: process.env.QIE_TESTNET_RPC || "https://rpc4testnet.qie.digital", chainId: 1983, accounts },
    qieMainnet: { url: process.env.QIE_MAINNET_RPC || "https://rpc1mainnet.qie.digital", chainId: 1990, accounts },
  },
};
