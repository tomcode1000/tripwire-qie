# Evidence

Every claim Tripwire makes, and where to check it yourself. Three kinds of proof:

- **Test**: an automated test in this repo (run `npx hardhat test`; full output in [`assets/test-report.txt`](assets/test-report.txt)).
- **Live**: a real transaction on QIE, with the full record saved in [`runs/`](runs/).
- **Eval**: the attack evaluation in [`EVAL.md`](EVAL.md).

Summary: **65 tests passing, 100% line / 94% branch coverage** ([`assets/test-summary.json`](assets/test-summary.json), [`assets/coverage-summary.json`](assets/coverage-summary.json)), run on every push by [CI](../.github/workflows/ci.yml).

## 1. Bait cannot be taken

| Claim | Proof |
|---|---|
| Moving bait with `transfer` does not move it, does not revert, and trips the trap | Test: [`BaitToken.test.js`](../test/BaitToken.test.js) "transfer() does not revert, does not move the balance, and trips the trap" |
| `approve` from a bait wallet trips the trap and flags the spender | Test: [`BaitToken.test.js`](../test/BaitToken.test.js) "approve() from a bait wallet trips the trap and flags the spender" |
| A spender's `transferFrom` trips the trap and flags the destination | Test: [`BaitToken.test.js`](../test/BaitToken.test.js) "transferFrom() by a sweeper contract/spender…" |
| The real drainer pattern (approve a sweeper contract, then pull every token) trips at both steps | Test: [`SweeperBot.test.js`](../test/SweeperBot.test.js) "step 1…" and "step 2…" |
| A stolen bait key was used on QIE testnet: bait unmoved, thief received 0 | Live: [tx `0xb263…7a04`](https://testnet.qie.digital/tx/0xb26388ac68e178d19b447b7496fffb1e9d7204be99520f9dc1af7f8235cd7a04), record [`runs/2026-11-27-qieTestnet-live-trip.json`](runs/2026-11-27-qieTestnet-live-trip.json) (`bait1Balance` 500000000 before and after, `thiefBaitBalance` 0) |

## 2. A trip locks the vault and names the leak

| Claim | Proof |
|---|---|
| A trip locks the vault with the leaked location as the reason | Test: [`Trap.test.js`](../test/Trap.test.js) "records the trip and locks the vault with the leak label as reason" |
| On QIE testnet the vault locked with reason `github:demo-repo/.env` in the thief's own transaction | Live: same tx as above; record shows `vaultLocked: true`, `lockReason: "github:demo-repo/.env"` |
| If the trap was never made a guardian, the thief is still flagged (the lock failure is logged, not fatal) | Test: [`Trap.test.js`](../test/Trap.test.js) "a trip still flags the taker when the trap is not a guardian" |
| Each builder's traps are independent | Test: [`TripwireFactory.test.js`](../test/TripwireFactory.test.js) "two builders' traps are independent" |

## 3. Native-coin sweeps are caught by the keeper

| Claim | Proof |
|---|---|
| The keeper reports a native sweep from a bait wallet: vault locks, thief flagged | Test: [`Keeper.test.js`](../test/Keeper.test.js) "a native sweep from bait is reported…" |
| The keeper ignores money sent *to* bait, and never reports a sweep twice | Test: [`Keeper.test.js`](../test/Keeper.test.js) "ignores incoming transfers…", "does not report the same sweep twice" |
| A key that is not the trap's keeper cannot report | Test: [`Keeper.test.js`](../test/Keeper.test.js) "a keeper key that is not the trap's keeper cannot report" |
| On QIE testnet a bot swept bait2's native QIE; the keeper reported it about 7.7 s later and the thief was flagged | Live: [sweep `0x52c5…124e`](https://testnet.qie.digital/tx/0x52c580772aebdab1ba5f951fdf298fb5fa689f08c0ff78038f6494c448f2124e), [report `0xba11…acaa`](https://testnet.qie.digital/tx/0xba110156b50b8eac76b8b3839920ee35eb5a47b79f26c2f02dc67e978d6dacaa), record [`runs/2026-11-27-qieTestnet-keeper-sweep.json`](runs/2026-11-27-qieTestnet-keeper-sweep.json) |

## 4. Real funds stay safe, even from a thief with the owner key

| Claim | Proof |
|---|---|
| After a trip, a thief holding the owner key cannot withdraw, queue or execute anything | Test: [`TripwireVault.test.js`](../test/TripwireVault.test.js) "bait taken -> vault locked -> thief's queued drain can never execute" |
| Rescue sends everything to the recovery address, even when the owner key calls it | Test: [`TripwireVault.test.js`](../test/TripwireVault.test.js) "rescue sends everything to recovery, even when the owner key calls it" |
| A stolen owner key cannot weaken any setting (guardian, limit, delay, recovery, unlock) | Test: [`TripwireVault.test.js`](../test/TripwireVault.test.js) "a stolen owner key cannot weaken settings" |
| Big withdrawals wait 24 h and can be cancelled | Test: [`TripwireVault.test.js`](../test/TripwireVault.test.js) "a big withdrawal waits for the delay…", "owner or recovery can cancel…" |
| Across 50 randomised thefts: 400 QIE stolen from plain wallets vs 118 QIE with Tripwire (worst case) or 13.5 QIE (builder checks once within 24 h) | Eval: [`EVAL.md`](EVAL.md), raw [`runs/2026-11-27-eval-worst-case.json`](runs/2026-11-27-eval-worst-case.json), [`runs/2026-11-27-eval-builder-reacts.json`](runs/2026-11-27-eval-builder-reacts.json) |

## 5. Flags are trustworthy

| Claim | Proof |
|---|---|
| Only traps made by the factory can flag; nobody can flag an address by claim alone | Test: [`FlagRegistry.test.js`](../test/FlagRegistry.test.js) "only registered traps can flag", "only the factory can register traps" |
| An unknown bait cannot be tripped, so innocent addresses cannot be framed | Test: [`Trap.test.js`](../test/Trap.test.js) "unknown bait cannot be tripped" |
| 0 innocent addresses flagged across 50 randomised attacks | Eval: [`EVAL.md`](EVAL.md) |

## 6. QIE facts used in the pitch

| Claim | Proof |
|---|---|
| A transfer costs about $0.000004; deploying Tripwire costs about 0.0042 QIE | [`runs/2026-11-27-qie-gas-price.json`](runs/2026-11-27-qie-gas-price.json), [`runs/2026-11-27-qie-activity-summary.json`](runs/2026-11-27-qie-activity-summary.json), [`../deployments/qieTestnet.json`](../deployments/qieTestnet.json) (`gasUsed`) |
| Leaked keys are drained in seconds; bait keys exist for cloud credentials but not for crypto keys | [`REFERENCES.md`](REFERENCES.md) |

## What is not proven yet

- Mainnet deployment (pending).
- That real sweeper bots hunt keys on QIE: the GitHub bait test has not run yet.
- The `npx tripwire` command-line tool and the dashboard.
