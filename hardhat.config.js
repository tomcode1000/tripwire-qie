require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("solidity-coverage");

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
    qieTestnet: { url: "https://rpc1testnet.qie.digital/", chainId: 1983, accounts },
    qieMainnet: { url: "https://rpc1mainnet.qie.digital", chainId: 1990, accounts },
  },
};
