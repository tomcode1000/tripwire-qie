# References

Every claim in the README, with where it comes from. Measurements we took ourselves are saved as dated files in [`docs/runs/`](runs/).

## The problem: leaked keys are drained in seconds

| Claim | Source |
|---|---|
| A seed phrase uploaded to GitHub was drained in under 100 seconds by bots watching commits | Decrypt, "Hacker steals $1,200 worth of Ethereum in under 100 seconds": https://decrypt.co/30222/hacker-steals-1200-worth-of-ethereum-in-under-100-seconds |
| Leaked access tokens were used within about 2 minutes; npm credentials within 60 seconds (Cybenari research, as reported) | ThreatDown, "Gone in 60 seconds": https://www.threatdown.com/blog/you-have-one-minute-to-save-your-leaked-aws-credentials/ |
| AWS credentials planted on GitHub were abused within 1 minute (honeypot experiment) | Comparitech: https://comparitech.com/blog/information-security/github-honeypot |
| Secret leakage in public GitHub repositories is systematic, not rare (academic study) | Meli, McNiece, Reaves, "How Bad Can It Git?", NDSS 2019: https://www.ndss-symposium.org/ndss-paper/how-bad-can-it-git/ |
| 474 of 4,802 exposed GitHub App private keys were still valid | GitGuardian via CSO Online: https://www.csoonline.com/article/4225633/github-app-keys-can-still-enable-takeovers-long-after-they-are-forgotten-2.html |

## The twist: the honeypot trick, reversed

| Claim | Source |
|---|---|
| Scammers share a funded wallet's seed phrase; a sweeper bot steals the gas victims send to it | MetaMask support, "Honeypot scams": https://support.metamask.io/stay-safe/protect-yourself/social-engineering/honeypot-scams/ |
| Bait credentials for cloud keys exist (canary tokens); we found no equivalent for crypto private keys | Search of the web and GitHub on 2026-11-27 (no defensive crypto bait-key project found) |

## QIE facts (measured on 2026-11-27)

| Claim | Evidence |
|---|---|
| Gas price 1.125 gwei; a plain transfer costs 0.0000236 QIE (about $0.000004 at $0.164) | [`runs/2026-11-27-qie-gas-price.json`](runs/2026-11-27-qie-gas-price.json), [`runs/2026-11-27-qie-activity-summary.json`](runs/2026-11-27-qie-activity-summary.json) |
| Deploying Tripwire's core contracts uses 3,746,110 gas, about 0.0042 QIE | `npx hardhat run scripts/deploy.js` output |
| 600 mainnet transactions over 7.5 hours came from only 32 senders; one bot sent 59% | [`runs/2026-11-27-qie-tx-sample-600.jsonl`](runs/2026-11-27-qie-tx-sample-600.jsonl), [`runs/2026-11-27-qie-activity-summary.json`](runs/2026-11-27-qie-activity-summary.json) |
| QIE oracle feeds (BTC/USDT, QIE/USDT, Gold/USD) are Chainlink-style aggregators with one owner address | [`runs/2026-11-27-qie-oracle-reads.jsonl`](runs/2026-11-27-qie-oracle-reads.jsonl) |
| Chain ID 1990, RPC, explorer | QIE docs: https://docs.qie.digital/getting-started-with-qie-blockchain/4.-access-mainnet-or-testnet |
| QIE Wallet MCP is read-only (six tools, no signing) | https://github.com/qieadmin/qie-wallet-mcp-listing |
| Hackathon rules, tracks, judging criteria | https://hackathon.qie.digital/ |

## Libraries

- OpenZeppelin Contracts 5.1.0 (ERC20, SafeERC20, ReentrancyGuard): https://github.com/OpenZeppelin/openzeppelin-contracts
- Hardhat 2.22: https://hardhat.org
