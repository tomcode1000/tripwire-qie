// Deploys FlagRegistry + TripwireFactory (which deploys BaitToken) and links them.
// Usage:
//   npx hardhat run scripts/deploy.js                      (local, prints gas used)
//   DEPLOYER_KEY=0x... npx hardhat run scripts/deploy.js --network qieTestnet
//   DEPLOYER_KEY=0x... npx hardhat run scripts/deploy.js --network qieMainnet
// Writes deployments/<network>.json with addresses and tx hashes.
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const feeData = await ethers.provider.getFeeData();
  console.log(`network ${network.name} (chain ${network.config.chainId ?? "local"}) deployer ${deployer.address}`);

  let gasUsed = 0n;
  const track = async (tx) => {
    const r = await tx.wait();
    gasUsed += r.gasUsed;
    return r;
  };

  const registry = await ethers.deployContract("FlagRegistry");
  const rReg = await track(registry.deploymentTransaction());
  const factory = await ethers.deployContract("TripwireFactory", [await registry.getAddress()]);
  const rFac = await track(factory.deploymentTransaction());
  const rLink = await track(await registry.setFactory(await factory.getAddress()));

  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    FlagRegistry: { address: await registry.getAddress(), tx: rReg.hash },
    TripwireFactory: { address: await factory.getAddress(), tx: rFac.hash },
    BaitToken: { address: await factory.baitToken() },
    linkTx: rLink.hash,
    gasUsed: gasUsed.toString(),
  };
  const price = feeData.gasPrice ?? 0n;
  console.log(JSON.stringify(out, null, 2));
  console.log(`total gas ${gasUsed} x gasPrice ${price} = ${ethers.formatEther(gasUsed * price)} native`);

  if (network.name !== "hardhat") {
    const dir = path.join(__dirname, "..", "deployments");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${network.name}.json`), JSON.stringify(out, null, 2) + "\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
