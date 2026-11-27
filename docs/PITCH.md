# How we talk about Tripwire

Every page, the README, the video and every post use these words. Plain language first; the technical
term only where a builder needs it, and explained the first time.

## One line

**Tripwire hides fake keys next to your real ones. The moment someone uses one, your money locks, the
thief is blocklisted, and you know exactly which file leaked.**

## The hook

**Leave a key. Catch the thief.**

## The relatable moment (open with this)

Everyone who builds has had the stomach-drop moment: a `.env` pushed by mistake, a key pasted into the
wrong chat, a laptop that turned out to have malware. Bots search for private keys around the clock and
they are faster than you. By the time you notice, the wallet is empty, and you have no idea where it leaked.

## The twist (say it in one breath)

Scammers use fake "free money" wallets to trap greedy people. We flipped the trick: the bait is the alarm.
A bot grabs the fake key first, and that is your warning, while your real key is still safe.

## 30-second pitch

> Your private key will leak one day: a `.env` on GitHub, a screenshot, a bad laptop. Bots find leaked keys
> in under 100 seconds. Tripwire hides fake keys where your real ones live. They look like a wallet with
> $500 in it, but the money can't move. The moment a bot or thief tries, your real funds lock in the same
> second, their address goes on a public blocklist every app on QIE can check, and the fake key tells you
> exactly which file leaked. We robbed ourselves 50 times to test it: normal wallets lost 400 QIE, Tripwire
> lost 13.5. It only works on QIE, because planting bait costs about $0.000004.

## Proof lines (always with the number)

- "We robbed ourselves 50 times. Normal wallets lost 400 QIE. Tripwire lost 13.5."
- "39 out of 39 attacks that touched the bait were caught. 0 innocent addresses blocklisted."
- "A real catch on QIE testnet: the thief got 0, the vault locked in the same transaction."
- "A second bot was caught 7.7 seconds after it struck."

## Words we use, and the words we avoid

| Say | Not | Why |
|---|---|---|
| fake key, bait key | honeytoken, canary credential | everyone understands "fake key" |
| your funds lock | the vault enters a locked state | say what happens to them |
| blocklist | flag registry | people know what a blocklist does |
| backup key | recovery address | it is the key you keep offline |
| everyday key | owner key, hot key | the one you deploy with |
| a bot or a thief | adversary, attacker | concrete |
| set a trap | arm a trap, deploy a trap | natural English |
| proof | assurance | plain |
| catch | trip event | it's a catch |

Grammar rules: short sentences, active voice, one idea per sentence. Numbers as digits. No exclamation
marks. Never claim what isn't proven: testnet, not audited, and the honest limit (a thief who never touches
the bait) are always said plainly.

## Honest limits (same words everywhere)

- If a thief never touches the bait, no trap fires. The 24-hour wait on big withdrawals is what protects you then.
- Keep nothing real in a bait wallet. The fake balance can't move; anything real can.
- Live on QIE testnet. Not audited yet.
