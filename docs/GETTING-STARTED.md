# Getting started with Tripwire

Tripwire is the theft-alarm layer for QIE. There are four ways to use it, from "no code" to "build from source".
Everything below runs on **QIE testnet** (chain 1983) today; mainnet is next. You need test QIE from the
[faucet](https://www.qie.digital/faucet) for anything that writes to the chain.

| I want to… | Use |
|---|---|
| Protect my own wallet, no code | [1. The website](#1-the-website-no-code) |
| Protect my wallet or my AI agent's wallet from a terminal or a script | [2. The command-line tool](#2-the-command-line-tool) |
| Refuse to pay thieves in my contract, app or agent | [3. Check the blocklist](#3-check-the-blocklist-in-your-contract-app-or-agent) |
| Catch bots that sweep a fake key's native QIE | [4. Run the watcher](#4-run-the-watcher) |
| Read, test or deploy the code myself | [5. Build from source](#5-build-from-source) |

## The two keys you need

- **Everyday key**: the wallet you deploy with, the one that could leak. It owns your vault.
- **Backup key**: a different wallet you keep offline. It controls the vault's rules, receives anything
  rescued, and sets the trap. A thief with your everyday key cannot change anything.

## 1. The website (no code)

Open **[Set your alarm](https://tripwire.54-255-109-186.sslip.io/arm.html)** and follow the five steps with
QIE Wallet or MetaMask: connect, create your vault, make fake keys (they never leave your browser), set the
trap from your backup key, watch.

## 2. The command-line tool

No install needed; Node 18 or newer:

```bash
npx github:tomcode1000/tripwire-qie --help
```

Keys are read from environment variables, never from the command line.

```bash
# 1. Create your vault. Big withdrawals will wait 24 hours.
export TRIPWIRE_KEY=0x...            # your everyday key
npx github:tomcode1000/tripwire-qie vault --backup 0xYourBackupAddress --delay 24h

# 2. Make fake keys, offline. Each gets a label: where you will hide it.
npx github:tomcode1000/tripwire-qie bait --count 2 --label "github:my-repo/.env" --label "notes:keys.txt"
#    -> ./tripwire-bait/bait-1-....env, bait-2-....env  (look like real deploy configs)
#    -> ./tripwire-bait/baits.json                      (addresses and labels only, no keys)

# 3. Set the trap and let it lock your vault. Signed by your backup key.
export TRIPWIRE_BACKUP_KEY=0x...
npx github:tomcode1000/tripwire-qie arm --vault 0xYourVault

# 4. Hide each .env file where its label says. Then check on it any time:
npx github:tomcode1000/tripwire-qie status --trap 0xYourTrap
```

Other commands:

```bash
npx github:tomcode1000/tripwire-qie check 0xSomeAddress   # exit code 2 if blocklisted, 0 if not
npx github:tomcode1000/tripwire-qie addresses             # contract addresses
npx github:tomcode1000/tripwire-qie watch --trap 0x...    # the watcher (see 4)
```

**For AI agents:** an agent's private key usually lives in a `.env` on a server, exactly where bots look.
Plant a fake key next to it with `bait`, keep the agent's funds in a vault, and have the agent run
`check <payee>` (or call `isFlagged`) before every payment; a non-zero exit code means don't pay.

A full run of these commands on QIE testnet is recorded in [`runs/2026-11-28-qieTestnet-cli-run.json`](runs/2026-11-28-qieTestnet-cli-run.json).

## 3. Check the blocklist in your contract, app or agent

Blocklist (FlagRegistry) on QIE testnet: `0xbFC006A0Becf8Dc567C09AA1f5A86fadeDA36F94`

```solidity
interface IFlagRegistry {
    function isFlagged(address who) external view returns (bool);
}

// refuse to pay a caught thief
require(!IFlagRegistry(BLOCKLIST).isFlagged(to), "blocklisted by Tripwire");
```

```js
// ethers v6, in an app or an AI agent
const list = new ethers.Contract(
  "0xbFC006A0Becf8Dc567C09AA1f5A86fadeDA36F94",
  ["function isFlagged(address) view returns (bool)"],
  provider // QIE testnet: https://rpc5testnet.qie.digital
);
if (await list.isFlagged(payee)) throw new Error("payee is on the Tripwire blocklist");
```

Reading the history of catches: QIE's RPC rejects log queries wider than 10,000 blocks, so read
`Flagged` events in windows (see `blockWindows` in [`cli/lib.js`](../cli/lib.js)).

## 4. Run the watcher

A bot that sweeps a fake key's native QIE (instead of touching the bait token) makes a plain transfer that
no contract sees. The watcher scans each block for transactions from your fake keys and reports them; it can
only lock and flag, never move funds.

```bash
export TRIPWIRE_KEEPER_KEY=0x...     # a small wallet with a little QIE for gas
npx github:tomcode1000/tripwire-qie watch --trap 0xYourTrap
```

The watcher must be your trap's keeper: pass `--keeper <its address>` to `arm`, or set it later from your
backup key with `Trap.setKeeper`.

## 5. Build from source

```bash
git clone https://github.com/tomcode1000/tripwire-qie && cd tripwire-qie
npm ci --legacy-peer-deps
npx hardhat test                       # 72 tests
npx hardhat coverage
npx hardhat run scripts/eval.js        # the 50-theft attack evaluation
npx hardhat run scripts/deploy.js      # local deploy; add --network qieTestnet with DEPLOYER_KEY set
npm run site:serve                     # the website on http://localhost:5177
```

Deploying the whole system to QIE uses about 3.75M gas (about 0.0042 QIE on mainnet).
