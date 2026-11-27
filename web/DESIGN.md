# Tripwire design language

Tripwire is a security product for builders and the institutions that fund them. The site follows
the house style of Hypothec: a credit or security desk's register, calm and exact, with the
evidence one click away.

## Principles

1. **Evidence first.** Every number on the site comes from `web/data.json` (built from committed
   records by `scripts/build-site-data.js`) or from a live read of QIE testnet, and links to its record.
2. **One action colour.** Wire indigo (`--accent`) marks the primary action and progress. It never decorates.
3. **Red means one thing.** `--bad` is reserved for *flagged / tripped*. Green (`--good`) only for *safe / locked for you*.
4. **Hairlines, not boxes.** White panels on a quiet ground, 1px rules, no drop shadows on anything that sits on the page.
5. **Figures line up.** Tabular numerals everywhere; addresses and hashes in mono.
6. **Say plainly what is not done.** Limits and testnet status sit on the landing page, not in a footnote.

## Type

| Role | Face | Use |
|---|---|---|
| Text and headings | Inter 400/500/600 | Headlines at 600 with negative tracking (-0.03 to -0.038em) |
| Data | JetBrains Mono 500 | Addresses, hashes, labels like `github:repo/.env`, code |

Kickers: 11.5px, 600, 0.09em tracking, uppercase, `--ink-4`.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ground` | #F4F3EF | #0F0E12 | Page |
| `--surface` | #FFFFFF | #17161B | Panels |
| `--border` | #E2E0D9 | #2B2A31 | Hairlines |
| `--ink` | #1B1A1F | #EFEDF3 | Text |
| `--accent` | #3D36C9 | #8D87FF | Primary action, accent phrase, step numbers |
| `--bad` | #B3261E | #F07A6F | Flagged, tripped |
| `--good` | #17754A | #4CC488 | Safe, locked for the builder |

Light is the default; dark is a choice made with the theme control and remembered per browser.

## Components (all in `assets/tripwire.css`)

- **Receipt**: the record of a trip, with a red "wire" line that draws across its top once.
- **Stat band**: four figures in one hairline panel, each with its source link.
- **Steps**: numbered 01–04 in mono accent.
- **Key chips**: which keys a thief holds (Bait, Everyday, Recovery), the Hypothec "who can move it" pattern.
- **Compare**: plain wallet vs Tripwire, the Tripwire panel marked by an accent rule.
- **App steps**: a sticky numbered side nav and one card per step, with a status pill each.

## Pages

| Page | Job |
|---|---|
| `index.html` | Hero with the live trip receipt, the problem, how a trap fires, what a thief can do, the evaluation, the list, limits |
| `list.html` | Every flagged address, read live from FlagRegistry events; address check; integration snippet |
| `arm.html` | Connect, create vault, generate bait keys in the browser, arm, make the trap a guardian, watch |
| `evidence.html` | Tests, coverage, the evaluation table by strategy, both live testnet records |

## Motion

Header gains a hairline on scroll; sections fade up once; the receipt's wire draws once.
All of it is off under `prefers-reduced-motion`.
