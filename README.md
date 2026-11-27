# Tripwire

**A crypto wallet with a burglar alarm.**

Tripwire gives you fake keys to hide where real keys get stolen: your code, your notes, your laptop. If anyone uses one, your wallet locks itself before they can reach your money, the thief is blocklisted across QIE, and you see exactly where you leaked.

1. **Hide fake keys** where real keys leak.
2. **A thief uses one**: a bot scanning GitHub, or a hacker on your laptop.
3. **Your wallet locks**: in the same second, your money is frozen, the thief is blocklisted, you're told which file leaked.

*Leave a key. Catch the thief.*

[![CI](https://github.com/tomcode1000/tripwire-qie/actions/workflows/ci.yml/badge.svg)](https://github.com/tomcode1000/tripwire-qie/actions/workflows/ci.yml)
[![CodeQL](https://github.com/tomcode1000/tripwire-qie/actions/workflows/codeql.yml/badge.svg)](https://github.com/tomcode1000/tripwire-qie/actions/workflows/codeql.yml)
[![Tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/tomcode1000/tripwire-qie/main/docs/assets/test-summary.json)](docs/assets/test-summary.json)
![Coverage](https://img.shields.io/badge/coverage-100%25%20lines%20%C2%B7%2094%25%20branches-brightgreen)
![QIE](https://img.shields.io/badge/QIE-Hackathon%203.0-8b5cf6)
![Track](https://img.shields.io/badge/track-Developer%20Infrastructure%20%26%20Tooling-0a7)

QIE Blockchain Hackathon 3.0 · Track: Developer Infrastructure & Tooling

> **Status (2026-11-27):** contracts and tests done; deployed on QIE testnet with a recorded live trip. Mainnet deployment, the CLI, the live dashboard and the demo video are in progress. This README says plainly what is live and what is not.

## For judges

**Full claim-by-claim proof: [`docs/EVIDENCE.md`](docs/EVIDENCE.md)** · attack evaluation: [`docs/EVAL.md`](docs/EVAL.md) · sources: [`docs/REFERENCES.md`](docs/REFERENCES.md)

| Claim | Evidence |
|---|---|
| **50 randomised thefts: 400 QIE stolen from plain wallets, 13.5 QIE with Tripwire** (118 if the builder never checks). Every bait attack caught (39/39), 0 innocent addresses flagged | [`docs/EVAL.md`](docs/EVAL.md) |
| Moving or approving bait never moves it and always trips the trap, including the real drainer pattern (approve a sweeper, then pull) | [`test/BaitToken.test.js`](test/BaitToken.test.js), [`test/SweeperBot.test.js`](test/SweeperBot.test.js) |
| A trip locks the vault, flags the taker and names the leaked file | [`test/Trap.test.js`](test/Trap.test.js) |
| Bots that sweep native QIE are caught by the keeper | [`test/Keeper.test.js`](test/Keeper.test.js); **live on testnet:** [sweep](https://testnet.qie.digital/tx/0x52c580772aebdab1ba5f951fdf298fb5fa689f08c0ff78038f6494c448f2124e) → [keeper report](https://testnet.qie.digital/tx/0xba110156b50b8eac76b8b3839920ee35eb5a47b79f26c2f02dc67e978d6dacaa) about 7.7 s later ([record](docs/runs/2026-11-27-qieTestnet-keeper-sweep.json)) |
| A thief holding the owner key cannot drain the vault or weaken its settings | [`test/TripwireVault.test.js`](test/TripwireVault.test.js) ("the thief scenario") |
| 65 tests, 100% line / 94% branch coverage | [`docs/assets/test-summary.json`](docs/assets/test-summary.json), [`docs/assets/test-report.txt`](docs/assets/test-report.txt), CI badge above |
| Leaked keys are drained in seconds; bait keys exist for cloud, not crypto | [`docs/REFERENCES.md`](docs/REFERENCES.md) |
| QIE costs about $0.000004 per transfer, so planting bait is free | [`docs/runs/`](docs/runs/) (dated measurements) |
| **Live trip on QIE testnet:** a stolen bait key moved bait, the vault locked with reason `github:demo-repo/.env`, the thief was flagged, and the bait never moved | [thief's tx](https://testnet.qie.digital/tx/0xb26388ac68e178d19b447b7496fffb1e9d7204be99520f9dc1af7f8235cd7a04), full record [`docs/runs/2026-11-27-qieTestnet-live-trip.json`](docs/runs/2026-11-27-qieTestnet-live-trip.json) |
| Testnet contracts (chain 1983) | FlagRegistry [`0xbFC0…6F94`](https://testnet.qie.digital/address/0xbFC006A0Becf8Dc567C09AA1f5A86fadeDA36F94), TripwireFactory [`0x1188…54A6`](https://testnet.qie.digital/address/0x11888A9E56aeea05D3A1546942B477D6365554A6), BaitToken [`0xdC73…e0BB`](https://testnet.qie.digital/address/0xdC73612Bc7a958C934495b2Ba2D5f5F6Ec22e0BB) ([`deployments/qieTestnet.json`](deployments/qieTestnet.json)) |
| Mainnet contracts | _pending deployment_ |
| Live dashboard and demo video | _pending_ |

## The problem

Every builder in this hackathon deploys to QIE mainnet with a private key, usually kept in a `.env` file. Bots scan GitHub around the clock for leaked keys; a seed phrase pushed to GitHub has been drained in under 100 seconds. You usually learn about a leak only when the wallet is empty, and you never learn *where* it leaked. ([sources](docs/REFERENCES.md))

## How Tripwire works

1. **Plant bait.** Tripwire gives you bait private keys that look exactly like a real deploy key. Each bait wallet shows a 500 rUSD balance. You plant them where a real key could leak: a repo's `.env`, a notes file, a CI secret. Each bait is labelled with where it was planted.
2. **Bait cannot move.** `rUSD` is a token that never leaves a bait wallet. Any `transfer`, `transferFrom` or `approve` from a bait wallet does not move anything; instead it calls the trap. The call does not revert, so the trip is recorded on-chain.
3. **The trap fires** in the same transaction:
   - your **TripwireVault locks**, with the leaked location as the lock reason;
   - the taker is **flagged in the public FlagRegistry**, which any wallet, app or AI agent can query with `isFlagged(address)`;
   - a `Tripped` event names the bait and the place it was planted.
4. **Your real funds are safe.** The vault releases only a small daily amount instantly; anything larger waits (24 hours by default) and can be cancelled. Once locked, funds can only be rescued to your recovery address, even if the thief also holds your everyday key. All security settings are controlled by the recovery key only.

Bots that sweep native QIE instead of tokens are handled by an optional **keeper**, a watcher that can only lock and flag, never move funds.

## Contracts

| Contract | Role |
|---|---|
| [`FlagRegistry`](contracts/FlagRegistry.sol) | Public list of bait takers. Only traps made by the factory can add flags. |
| [`TripwireVault`](contracts/TripwireVault.sol) | Holds real QIE and ERC-20s (e.g. QUSDC): daily limit, delayed withdrawals, lock, rescue to recovery. |
| [`Trap`](contracts/Trap.sol) | One builder's bait set and labels. A trip locks the vault and flags the taker. |
| [`BaitToken`](contracts/BaitToken.sol) | `rUSD`, the balance that never leaves a bait wallet. |
| [`TripwireFactory`](contracts/TripwireFactory.sol) | Creates vaults and arms traps in one transaction. |

## Run it

```bash
npm ci --legacy-peer-deps
npx hardhat test            # 65 tests
npx hardhat coverage        # coverage report
npm run test:summary        # writes docs/assets/test-summary.json
npx hardhat run scripts/deploy.js   # local deploy, prints gas used
```

Deploying to QIE (chain 1990) uses about 3.75M gas, roughly 0.0042 QIE.

## Honest limits

- If a thief steals your **real** key and never touches the bait, the bait does not fire. The vault's withdrawal delay is what protects you then, so keep real funds in the vault.
- Bait wallets are tools, not users. We do not count them as traction.
- Flags only come from on-chain trips, so an innocent address cannot be flagged by someone else's claim.

## License

MIT
