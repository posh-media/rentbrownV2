# RENT BROWN V2 — Design Direction: "Warm Institutional Fintech"

**Status:** Exploration direction confirmed (RB-097); not final until moodboard → tokens → key screens are validated.
**Goal:** credible + premium + understandable + transparent + modern. Institutional seriousness with Nigerian warmth. Never: casino, crypto-bro, generic neobank clone, get-rich-quick.

---

## 1. Design principles

1. **Numbers are the hero.** Balances, ROI, maturity dates get typographic priority — tabular numerals, generous size, no abbreviations.
2. **Warmth through restraint.** Brown is structural (headers, key actions, brand moments), not painted everywhere. Cream/ivory surfaces do the warm work.
3. **Every screen answers "is my money safe and what's it doing."** Status, timestamps, and explanations always visible.
4. **Premium = space + precision**, not ornament. Generous whitespace, disciplined accent use, exact alignment.
5. **Honest urgency only.** Real closing dates, real availability. No pressure patterns.

## 2. Moodboard direction (verbal — to be built as actual board)

Reference feelings: private-banking stationery · Nigerian terracotta/earth tones · modern investment dashboards (Wealthfront, Cowrywise at their most restrained) · editorial property photography · matte paper texture (subtle, if at all).
Avoid: neon gradients, glassmorphism gimmicks, crypto-purple, gamified confetti, stock-photo handshakes.

## 3. Color system (draft tokens — evolve from V1 palette)

```text
Brand
  brand.900  #3E2A23   espresso — primary text on light, dark surfaces
  brand.700  #5D4037   PRIMARY brown (from V1 — keep as anchor)
  brand.500  #8D6E63   secondary brown (from V1)
  brand.300  #C4A99B   muted warm
  brand.100  #EFE4DC   subtle tint fills

Neutrals (warm-tinted, not gray)
  bg.canvas      #FFFDF8  cream canvas (from V1)
  bg.surface     #FFFFFF  card surface
  bg.subtle      #F7F1EA  recessed sections
  border.default #E8DDD4
  text.primary   #2D2624  (from V1)
  text.secondary #6B5D55
  text.tertiary  #9A8A7F
  text.inverse   #FFFDF8

Semantic (one accent family, warm-leaning)
  success   #2E7D32→#388E3C range  (returns, credited, active-good)
  warning   #B26A00  (pending, closing soon, review)
  error     #B3261E  (failed, reversed)
  info      #5D4037=brand (neutral info uses brand, not blue — keeps warmth)
  pending   #8D6E63  (in-progress, reserved)

Accent (sparingly — Modern African character)
  accent.gold  #C9A227   premium highlights, featured badges, charts
  accent.leaf  #4C7A45   secondary data series only
```

Rules: brand brown ≥700 only for primary actions/headers/brand marks; gold never for body text (contrast); success reserved for money-positive semantics only. **Dark mode** — tokens are semantic (`bg.canvas`→`#1A1411` espresso-black family) so dark ships later by remapping, not redesigning (RB-098).

## 4. Typography

```text
Display/Marketing (site only):  Fraunces or Source Serif 4 — premium editorial serif
Product UI (app + web):         Plus Jakarta Sans (continuity from V1) — 400/500/600/700
Financial/numeric:              Plus Jakarta Sans w/ tabular-nums + proportional off
                                (fallback: Inter tabular if Jakarta numerals test poorly)
```

Type scale (mobile base): `display 32 · h1 26 · h2 22 · h3 18 · body 16 · body-sm 14 · caption 12 · figure-lg 34/40 (balances) · figure-md 22 (card amounts)`.
Rules: financial figures ≥ figure-md on all primary surfaces; letter-spacing 0 on numbers; line-height 1.2 figures, 1.5 body.

## 5. Shape, spacing, elevation

```text
Spacing: 4pt scale — 4, 8, 12, 16, 20, 24, 32, 40, 48
Radius:  sm 8 · md 12 (cards) · lg 16 (sheets/featured) · xl 24 (hero) · pill (chips/status)
         — controlled roundness: friendly but not playful
Elevation: near-flat system — 1px warm borders do the work;
           shadow only for modals/sheets (soft, warm-tinted, low opacity)
Borders: 1px border.default on all cards — precision over shadow
```

## 6. Component direction

| Component         | Direction                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buttons           | Primary: brand.700 fill, radius md, 48px h. Secondary: outline warm. Destructive: error. No gradients                                                         |
| Cards             | White surface, 1px warm border, radius 12, 16px padding; property cards: image top + spec row                                                                 |
| Financial figures | `MoneyFigure` component: currency symbol small-cap, tabular amount, secondary-color decimals; `BalanceCard` with expandable account breakdown                 |
| Status badges     | Pill, semantic bg tint + darker text + dot; vocabulary locked: Active · Maturing · Settling · Completed · Pending · Processing · Failed · Refunded · Reserved |
| Progress          | Availability bar (sold/total), investment timeline (activated→maturity→settled nodes)                                                                         |
| Charts            | Minimal line/bar, brand+gold series, no 3D/glow; portfolio value + earnings only — no fake volatility charts                                                  |
| Inputs            | Filled subtle bg, 1px border, radius 12, clear labels above; money inputs: currency-prefixed, tabular                                                         |
| Sheets/modals     | Bottom sheet mobile (radius 24 top), centered modal web; confirmations always bottom-sheet style with full financial summary                                  |
| Navigation        | Mobile: 4-tab bar (Home · Explore · Portfolio & Wallet · Account) + bell. Web: left sidebar admin-style or top nav — decide in screen review                  |
| Icons             | Thin-line set (Lucide/Feather family), 1.5px stroke, no emoji-as-icon                                                                                         |
| Imagery           | Real property photography, warm grade, dark-brown scrim for text overlay; illustration minimal/abstract if used at all                                        |
| Motion            | 150–250ms ease-out; count-up on balances allowed once per view; reduced-motion respected; no celebratory animations on money events                           |

## 7. Trust-by-design patterns

- Confirmation screens = itemized spec sheet (slots × price, ROI, dates, fees) — receipt-like, never splashy
- "Why" affordances: every fee/threshold/KYC gate has a one-line explanation link
- Proof cards carry provenance: reviewer, date, doc type, version
- Return language per counsel (C-01); disclaimer block always in visual hierarchy, never footer-only
- Timestamps everywhere ("updated 2 min ago", maturity with timezone)

## 8. Light/Dark/System token architecture

```text
Layer 1 primitive:  brand.700=#5D4037 (fixed values)
Layer 2 semantic:   bg.canvas, text.primary, action.primary, status.success.bg
Layer 3 component:  card.bg → bg.surface, button.primary.bg → action.primary
Theme = semantic remap only. Components never reference primitives directly.
Launch: light theme map only; dark map defined in tokens, QA'd later (RB-098).
```

## 9. First validation screens (proposed order)

1. **Home** — tests: balance hero, financial figure hierarchy, card system, warm/institutional balance
2. **Explore / Opportunity card** — tests: property card spec density, ROI/duration chips, availability treatment
3. **Property/Investment detail** — tests: trust sections, spec-sheet module, disclosure hierarchy
4. **Checkout/Review** — tests: money clarity, confirmation sheet, honest-availability copy

Validation gate: founder reviews these four before tokens/components are locked.

## 10. Explicitly rejected

Dark-mode-first · glassmorphism · gradient primaries · casino-confetti on financial events · fake scarcity · serif inside the product UI (serif is marketing-site only) · cool-blue fintech palette (loses the brown identity).
