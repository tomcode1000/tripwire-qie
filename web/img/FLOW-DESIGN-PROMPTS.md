# Tripwire: Flow page-design prompts

**Workflow:** Flow designs each page as a flat Figma-style frame. We mirror the frame exactly in code
and correct what an image model gets wrong (text, numbers, alignment, contrast). So the frames must be
precise layout and art direction, not mood boards.

**How to run:** paste the shared design-system block first, then one page prompt. Generate 4 variations,
pick the best, regenerate if any rejection rule is broken. Save as `web/img/design/<name>.png` and send them
to me. Generate at the largest size Flow allows; 16:9 for desktop hero frames, tall (9:16 or the
tallest available) for full-page frames.

---

## Shared design-system block (paste before every page prompt)

> You are a senior product designer at a top institutional design studio (the calibre of the teams behind
> Stripe, Linear, Anchorage Digital, Fireblocks and BlackRock's Aladdin). Design a flat, pixel-precise
> website frame exactly as it would appear exported from Figma: straight-on, full-bleed, no device mockup, no
> browser chrome, no perspective, no laptop, no hands, no desk, no shadows around the frame.
>
> Brand: Tripwire, a security product for blockchain builders. Register: an institution's security desk and
> its published reports. Calm, exact, expensive, quiet confidence. Every element earns its place.
>
> Design system, follow exactly:
> - Background: warm paper white #F4F3EF. Panels: pure white #FFFFFF with 1px hairline borders #E2E0D9, corner
>   radius 12px, no drop shadows anywhere. Section dividers are 1px hairlines; key tables and figure rows sit
>   under a 1px near-black rule #1B1A1F.
> - Ink: near-black #1B1A1F for headlines and body; greys #5F5C66 and #8A8791 for secondary text.
> - One action colour only, deep wire indigo #3D36C9, used for at most one button and small accent numbers.
>   Signal red #B3261E appears only next to the words "Flagged" or "Tripped". Green #17754A only for "Locked"
>   or "Safe". No other colours, no gradients except the hero photograph.
> - Type: headlines in an elegant editorial serif (like Newsreader or Tiempos), regular weight, very tight
>   letter-spacing, very large; the second line of the hero headline in serif italic. Interface text in a
>   clean neo-grotesk (like Inter), 15px body. All addresses, hashes, file names and code in a monospace
>   (like JetBrains Mono). Small uppercase labels with wide letter-spacing.
> - Grid: 1440px frame, 1280px content width, 12 columns, generous margins. Inner sections use a report
>   layout: a narrow left rail (3 columns) with a section number like "§ 01" in mono and an uppercase label,
>   and the content in the right 9 columns.
> - Imagery: only real photographs of physical objects (a taut steel wire with a brass pin on stone, a
>   bank-vault time lock, an evidence envelope with a red thread, an archival ledger), shown as captioned
>   plates like a museum catalogue ("Plate II · ...").
> - Header: 60px tall, logo left (a small black rounded square with a thin white line and dot, then the
>   word "Tripwire"), text navigation "Overview  Incidents  Registry  Assurance  Arm a trap", right side a
>   small theme toggle, a ghost button "Source" and a black button "Arm a trap". Directly under the header a
>   36px live status band on white, monospaced, separated by hairlines: "● QIE testnet chain 1983 | Registry
>   0xbFC0…6F94 | Flagged 2 | Last trip block 10,007,764 | Tests 65 passing | Coverage 100% lines | Audit not yet".
>
> Strictly reject: generic SaaS templates, Dribbble-style shots, AI-looking art, glassmorphism, neon,
> glowing effects, purple-blue gradients, 3D renders, blobs, abstract waves, isometric illustrations,
> padlock or shield icons, chains, circuit boards, hooded hackers, stock photos of people, emoji, rounded
> cartoon icons, card grids of identical feature boxes with icons, fake dashboards with random charts,
> lorem ipsum, crowded layouts, more than one accent colour, drop shadows. If any of these appear, the design
> is wrong. It must look like a real shipped website from a serious financial-security company.

---

## Frame 1: Home, first screen (16:9) → `home-hero.png`

> Design the first screen of the Tripwire home page (1440×900).
> Top: the header and the live status band exactly as specified.
> Below: a full-width hero photograph filling the rest of the screen: a single hair-thin steel tripwire
> stretched taut across pale limestone, held by a small aged-brass pin in the right third, soft daylight
> from the upper right, long thin shadow. The left half of the photo fades to paper white so text is
> readable. Tiny mono caption top-right on the photo: "Plate I · A tripwire, steel and brass".
> On the left, over the faded area: small uppercase label "SECURITY FOR BUILDERS ON QIE"; a huge serif
> headline on two lines, "Leave a key." and in italic "Catch the thief."; a grey paragraph (3 lines) "Plant
> bait private keys where a real one could leak. The moment a thief or a sweeper bot uses one, your vault
> locks, the thief is flagged for every app on QIE, and you learn exactly which file leaked."; then a black
> button "Arm a trap" and a text link "Read incident TW-0001 →".
> On the right, overlapping the photograph near the bottom, a white case-file panel (about 440px wide)
> with a thin red line across its top edge: a grey top bar with mono text "INCIDENT TW-0001 · QIE TESTNET"
> and a small red "TRIPPED" tag; a serif title "A stolen bait key was used. Nothing was taken."; then a
> vertical timeline with four rows, each with a mono time on the left ("T+0 s", "T+0 s", "T+0 s",
> "T+7.7 s"), a small dot on a thin vertical line (red, green, red, grey) and a short sentence:
> "Key planted at github:demo-repo/.env is used to move 500 rUSD", "Bait does not move; the builder's
> vault locks in the same transaction", "Taker 0xEA5C…8aC7 is flagged on the public registry", "A
> native-coin sweep is caught by the keeper"; bottom grey bar with three small links "Transaction ↗",
> "Record ↗", "Full case file →".

## Frame 2: Home, full page (tall) → `home-full.png`

> Design the full Tripwire home page as one tall frame (1440 wide). Start with the hero from Frame 1,
> then these sections, each separated by a hairline, each with the left rail (mono "§ 0X" and an
> uppercase label) and content on the right:
> § 01 THE EXPOSURE: serif headline "A leaked key is emptied in seconds. You never learn where it leaked."
> (italic on "where"), a grey lede, then a row of four large serif figures under a black hairline, divided
> by vertical hairlines: "<100 sec" (red), "~2 min" (red), "1 min" (red), "0", each with a short grey caption
> and a tiny indigo footnote number.
> § 02 THE MECHANISM: left a serif headline "The bot's speed is what catches it." with a lede; right a
> captioned photograph plate (an evidence envelope with a red thread on grey board, caption "Plate II ·
> Every bait key carries the place it was planted."); below, a four-column numbered procedure under a black
> hairline: "01 Plant", "02 Wait", "03 Trip", "04 Respond", each with two lines of grey text, numbers in indigo mono.
> § 03 THE VAULT: serif headline "A thief with your keys meets a 24-hour clock." with a tall photograph plate of
> an antique three-dial bank-vault time lock ("Plate III"); below, an access matrix table: columns "Bait",
> "Everyday", "Recovery", "What the holder can do", "Outcome"; key columns show small circles, filled black
> when the key is held; outcomes "Flagged · vault locked" in red, "Delay protects" in grey, "Builder in
> control" in green.
> § 04 MEASURED: serif headline "50 simulated thefts. Same keys, two wallets." and four big serif figures:
> "400" red "QIE stolen from plain wallets", "13.5" green "QIE stolen with Tripwire", "39/39" "attacks that
> touched bait, caught", "0" "innocent addresses flagged".
> § 05 THE REGISTRY: left a serif headline "Every catch protects every app on QIE." with a wide
> photograph plate of an archival ledger's page edges with an indigo ribbon ("Plate IV"); right a white
> panel "CHECK AN ADDRESS AGAINST THE REGISTRY" with a mono input, an indigo "Check" button, a red result
> line "● Flagged · took bait 1 time", and a small grey code block.
> § 06 DISCLOSURES: serif headline "What Tripwire does not do." then a statement list: serif statement on the
> left, grey explanation on the right, four rows separated by hairlines.
> Closing: very large serif line "Plant the first key before the bots find the real one." (italic on "real
> one."), black button "Arm a trap".
> Footnotes in small grey text numbered 1–5, then a footer under a black hairline with the logo, a short
> description and three link columns "PRODUCT", "ASSURANCE", "SOURCE".

## Frame 3: Incident case file → `incident.png`

> Design the Tripwire "Incidents" page (1440 wide, tall). Header and status band as specified. A page head:
> uppercase label "INCIDENTS", serif headline "Two incidents on record. Nothing taken.", grey lede. Then a full
> case file for "INCIDENT TW-0001" styled like an official incident report: a white panel with a thin red line
> on top, a grey bar with the mono case number, classification tag "TRIPPED", and "Recorded 27 Nov 2026 15:33:58
> UTC · block 10,007,538"; a two-column field grid with uppercase labels and values ("BAIT PLANTED AT"
> github:demo-repo/.env, "TAKER" 0xEA5C…8aC7 in red "Flagged", "BAIT MOVED" 0 rUSD, "VAULT" Locked in green,
> "TRAP" 0x16bD…3765, "NETWORK" QIE testnet); a vertical timeline in mono with dots; and a footer bar with
> "Transaction ↗  Vault ↗  Raw record ↗". Beside it on the right, a narrow column "How to read a case file"
> with three short numbered notes. Below, a second case file "INCIDENT TW-0002 · KEEPER CATCH" in the same
> style, more compact. Strictly the shared design system.

## Frame 4: Registry → `registry.png`

> Design the Tripwire "Registry" page (1440 wide). Header and status band as specified. Page head: label
> "REGISTRY", serif headline "Addresses caught taking bait", grey lede about the registry being written only
> by traps. On the right of the head, a white panel with a mono address input and an indigo "Check" button.
> Below, a row of four big serif figures under a black hairline: "2" red "Addresses flagged", "2" "Trips
> recorded", "10,007,764" "Latest trip, block", "0xbFC0…6F94" mono "Registry contract". Then a ledger table
> under a black hairline: columns "FLAGGED ADDRESS", "TIMES", "BAIT USED", "TRAP", "BLOCK", "TRANSACTION";
> two rows with full mono addresses, small red "FLAGGED" tags, right-aligned tabular numbers, underlined mono
> links. Then a section "Refuse a flagged address in one line" with a grey code block showing a Solidity
> require line and an ethers line. Exactly the shared design system; dense but calm, like a public ledger
> at a central bank.

## Frame 5: Arm a trap (console) → `arm.png`

> Design the Tripwire "Arm a trap" console page (1440 wide). Header and status band as specified. Left a
> sticky step list under a black hairline: "01 Connect", "02 Vault", "03 Bait keys", "04 Arm", "05 Watch",
> numbers in mono, the current step in indigo, completed steps in green. Right, a stack of white step panels,
> each with a serif title ("1 · Connect your everyday wallet", "2 · Create your vault", "3 · Generate bait
> keys", "4 · Arm the trap", "5 · Watch"), a short grey explanation, a small status tag at top right, and
> form fields with uppercase labels and mono inputs; step 3 shows two generated mono addresses each with a
> label field ("github:my-repo/.env", "notes:keys.txt") and a "Download bait files" ghost button; step 5 shows
> a status list with rows "Trap", "Bait keys armed 2", "Trap can lock vault Yes" (green), "Trips 0", "Vault
> Open, nothing tripped" (green). Only one indigo primary button visible at a time. Calm, exact, like an
> institutional custody console.

## Frame 6: Home on mobile → `home-mobile.png`

> Design the Tripwire home page first screen for a phone (390×844), same design system: compact header
> with logo, theme toggle and a menu icon; status band scrolls horizontally; hero photograph on top half
> with the serif headline "Leave a key." / italic "Catch the thief." below it on paper white; lede; black
> full-width "Arm a trap" button; then the TW-0001 case-file panel at full width. 16px side margins.

---

Once the frames are back, I mirror them in `web/` with real data (every number comes from the evidence
files) and correct whatever the model got wrong: text, numbers, alignment, contrast, dark mode.
