# Attack evaluation

**Question:** when a thief gets a builder's keys, how much do they steal with Tripwire compared with a plain wallet?

**Setup** ([`scripts/eval.js`](../scripts/eval.js), reproducible with seed `20261127`):
- 50 runs on a local Hardhat chain. Each run deploys a fresh Tripwire system and puts **10 QIE** in the builder's vault (daily instant limit 0.5 QIE, 24-hour delay on bigger withdrawals).
- Each run replays one attacker strategy, chosen at random (every strategy at least once). The order of the attacker's steps is also random.
- A thief holding the everyday (owner) key tries everything: withdraw all, withdraw the daily limit, raise the limit, remove the trap as guardian, queue a full drain, then wait 24 hours and execute it.
- The plain-wallet baseline is the same keys with no Tripwire: whoever holds the owner key takes all 10 QIE.

## Results

Two models of the builder:
- **Worst case:** the builder never checks anything.
- **Builder reacts:** the builder checks once within the 24-hour delay and cancels withdrawals they did not make.

| Attacker strategy | Runs | Caught | Stolen, plain wallet | Stolen, Tripwire (worst case) | Stolen, Tripwire (builder reacts) |
|---|---|---|---|---|---|
| Bait key moves bait + owner-key drain | 16 | 16/16 | 160 QIE | **4 QIE** | **4 QIE** |
| Bait key approves a sweeper bot + owner-key drain | 6 | 6/6 | 60 QIE | **2 QIE** | **2 QIE** |
| Bot sweeps the bait's native QIE (keeper) + owner-key drain | 7 | 7/7 | 70 QIE | **2 QIE** | **2 QIE** |
| Bait key only | 10 | 10/10 | 0 QIE | 0 QIE | 0 QIE |
| Owner key only, bait never touched | 11 | n/a | 110 QIE | 110 QIE | **5.5 QIE** |
| **Total** | **50** | **39/39 bait attacks** | **400 QIE** | **118 QIE** | **13.5 QIE** |

- **Every attack that touched bait was caught: 39 of 39.** The vault locked, the attacker was flagged, and the attacker got at most the daily limit (0.5 QIE) in the runs where they used the owner key *before* touching the bait.
- **0 innocent addresses were flagged** across all 50 runs.
- **Honest limit:** if the thief never touches the bait, Tripwire cannot fire. Then only the vault's 24-hour delay protects you: a builder who checks once within the delay loses at most the daily limit (5.5 QIE over 11 runs = 0.5 per run). A builder who never checks loses everything, same as a plain wallet.

Raw results, one record per run with every step tried and whether it went through or was blocked:
[`runs/2026-11-27-eval-worst-case.json`](runs/2026-11-27-eval-worst-case.json),
[`runs/2026-11-27-eval-builder-reacts.json`](runs/2026-11-27-eval-builder-reacts.json).

## Reproduce

```bash
npx hardhat run scripts/eval.js                 # worst case
REACT=1 npx hardhat run scripts/eval.js         # builder reacts within the delay
EVAL_RUNS=200 EVAL_SEED=7 npx hardhat run scripts/eval.js
```
