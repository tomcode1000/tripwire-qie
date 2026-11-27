const { ethers } = require("hardhat");

const DAY = 24 * 60 * 60;
const HOUR = 60 * 60;
const NATIVE = ethers.ZeroAddress;
const label = (s) => ethers.encodeBytes32String(s);

/**
 * Deploys the whole system and arms one builder with two bait wallets.
 * Roles:
 *  - owner:    the builder's everyday key (the one a thief may steal)
 *  - recovery: the builder's cold key; controls settings and receives rescues
 *  - keeper:   lock-only watcher for native-coin sweeps
 *  - thief:    takes the bait
 */
async function deployArmed({ delay = DAY, nativeLimit = ethers.parseEther("1") } = {}) {
  const [deployer, owner, recovery, keeper, thief, stranger, bait1, bait2, payee] = await ethers.getSigners();

  const registry = await ethers.deployContract("FlagRegistry");
  const factory = await ethers.deployContract("TripwireFactory", [await registry.getAddress()]);
  await registry.setFactory(await factory.getAddress());
  const bait = await ethers.getContractAt("BaitToken", await factory.baitToken());

  const vaultAddr = await factory.connect(owner).createVault.staticCall(recovery.address, delay);
  await factory.connect(owner).createVault(recovery.address, delay);
  const vault = await ethers.getContractAt("TripwireVault", vaultAddr);

  const baits = [bait1.address, bait2.address];
  const labels = [label("github:zelkaro/.env"), label("drive:notes.txt")];
  const trapAddr = await factory.connect(recovery).arm.staticCall(vaultAddr, keeper.address, baits, labels);
  await factory.connect(recovery).arm(vaultAddr, keeper.address, baits, labels);
  const trap = await ethers.getContractAt("Trap", trapAddr);

  await vault.connect(recovery).setGuardian(trapAddr, true);
  await vault.connect(recovery).setDailyLimit(NATIVE, nativeLimit);

  // fund the vault with 10 QIE
  await owner.sendTransaction({ to: vaultAddr, value: ethers.parseEther("10") });

  return { deployer, owner, recovery, keeper, thief, stranger, bait1, bait2, payee, registry, factory, bait, vault, trap, labels };
}

module.exports = { deployArmed, DAY, HOUR, NATIVE, label };
