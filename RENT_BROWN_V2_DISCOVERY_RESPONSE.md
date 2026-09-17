# RENT BROWN V2 — Discovery Response

> **⚠️ SUPERSEDED IN PART — 2026-09-17.** This document is the original discovery output. Founder decisions have since resolved or revised several items — including: Firebase removed (Supabase-only backend), pay-then-check-capacity direct-pay model, per-transaction referral caps, manual admin withdrawal payouts, withdrawals/PIN on web+mobile, and the Supabase+NestJS+Cloud Run hosting recommendation. **Current truth lives in `RENT_BROWN_V2_PHASE0_BLUEPRINT.md` + `docs/`.** This file is retained for history.

**Date:** 2026-09-17
**Status:** Discovery/planning — NOT for implementation. No code, scaffolding, or infrastructure is to be created from this document until explicitly approved.
**Source of truth:** `RENT_BROWN_MASTER_CONTEXT_AND_MEGA_AUDIT.md` + founder clarifications.

---

## A. Updated Understanding

RentBrown is a Nigerian-first platform where users invest in **slots** — participation units in configurable investment offers tied to real-estate properties or property-associated businesses. The commercial model is a **fixed full-term return**: `profit = principal × ROI`, paid once at maturity (`principal + profit`). No compounding, no per-period payout, no dynamic recalculation based on business performance — the investment's economics are snapshotted at purchase and the platform's obligation is contractual, not revenue-derived.

The domain is a 4-level hierarchy: **Property → Investment Plan → Investment Round → Investment**. Rounds carry capacity, economics, timing windows, and lifecycle; investments carry immutable snapshots. Rounds close permanently — history is never mutated; new rounds open fresh capacity.

Money moves through a **double-entry ledger** (the only financial authority) feeding **per-currency wallet accounts** (available / reserved / bonus). Users fund investments via **wallet balance or direct payment** (Paystack/Korapay initially). **No early exit** — investments are illiquid until maturity, then settle automatically. **KYC is gated primarily on withdrawals** under a configurable policy (provisional ₦10,000 threshold / first withdrawal / tiers). **Referral bonuses are a launch feature** implemented as a real ledger-backed subsystem, not a UI counter.

V1 is dead as a product — no real money or KYC data exists — so there is no migration, only selective reuse of the Firebase project where it earns its place. V2 is four surfaces: **Expo mobile app** (primary), **investor web** (with a configurable app-required capability model for sensitive actions), **Next.js admin** (RBAC, maker-checker), and **Next.js marketing site** — all over a **modular monolith API + worker + PostgreSQL**.

---

## B. Decisions Now Confirmed

### Product/business

- Fixed full-term return model; investment engine is plan-configurable, not hardcoded
- Durations configurable in hours/days/weeks/months/years; the 8-hour plan is just a plan config (also the intended "intro" experience for new users)
- Two distinct limits: **round capacity** and **per-user maximum** — both enforced server-side
- Round model: Property → Plan → Round → Investment; closed rounds are immutable history
- No early withdrawal from active investments, enforced in backend + UX + terms
- Referral bonuses in launch scope (as a governed financial subsystem)
- Admin = separate Next.js app with real RBAC; Marketing site = separate Next.js app
- Investors get real web access; sensitive actions gated by a _configurable_ capability model (e.g., withdrawal may require the app)
- Payments: Paystack + Korapay behind provider adapters; crypto later, not now
- Currencies: NGN primary, USD supported at launch; architecture must not be NGN-hardcoded
- KYC gating is policy-driven, not hardcoded; tiered KYC expected
- Legal instrument classification is pending counsel — terminology stays configurable

### Technical

- React Native + Expo + TypeScript; client is never the financial authority
- PostgreSQL + double-entry ledger + integer minor units + idempotency + transactional outbox + atomic reservation
- Modular monolith + background worker; no microservices
- Existing Firebase project may be reused where appropriate (after inspection); V1 data model is _not_ preserved
- Dev/staging/prod environment separation

---

## C. Provisional / Configurable Decisions

Not yet final — must be runtime/admin-configurable, never hardcoded:

- ₦10,000 KYC withdrawal threshold and the first-withdrawal/tier combination
- Investment catalogue, ROI ranges, slot prices, capacities, per-user maxes
- Referral bonus amount/type/qualification/withdrawability
- KYC provider (needs shortlist + approval)
- Exact web-vs-app restricted actions list
- Withdrawal review policy (automatic vs threshold vs always-manual)
- Fee/tax/rounding policies
- Currency UX details (display vs wallet vs investment currency)

---

## D. Remaining Critical Decisions

### P0 — blocks architecture or data model

1. **Does duration run per-investment or per-round?**
   Option A: each investment's clock starts at activation (user buys → their 8 hours begins). Option B: the round has a fixed maturity date (everyone who invests in the round matures together). These produce different schemas, UX, and admin semantics.
   _Recommendation:_ support both via a round-level flag (`fixed_maturity_at` optional); per-investment duration as the default and launch behavior — but the default needs founder sign-off.

2. **Cross-currency investing at launch?**
   Can a user with an NGN wallet invest in a USD-denominated round?
   Option A: per-currency wallet accounts; investment must be funded in plan currency; no FX at launch. Option B: FX conversion at funding time via provider rates (adds rate snapshots, fees, rounding, disclosure).
   _Recommendation:_ Option A — multi-currency accounts exist, conversion deferred. Keeps the ledger simple without blocking it later.

3. **Investor web implementation path.**
   Option A: Expo Web from the same codebase (max sharing, weaker web UX/SEO). Option B: separate Next.js investor app sharing contracts + design tokens (better web UX, consistent with admin/marketing apps, more code).
   _Recommendation:_ Option B — shared `packages/contracts` + `packages/ui-tokens` keep surfaces aligned.

4. **Backend framework + hosting direction.**
   NestJS (structured, strong for modular monolith + RBAC/queues) vs Fastify (lighter). Hosting: Render/Railway/Fly vs AWS vs Supabase-managed Postgres + separate API host.
   _Recommendation:_ NestJS + managed Postgres; hosting chosen on ops comfort/budget — needs founder input.

5. **Late-payment edge case for direct-pay investments.**
   User reserves slots → pays via Paystack → reservation expires (~15 min) → webhook arrives late. Options: auto-refund, or accept-with-flag.
   _Recommendation:_ auto-refund/reversal via provider; never silent loss, never force-activate an expired reservation. Confirm.

### P1 — needed before UI design

- **Referral rules**: qualification event (recommend: referee's first _activated_ investment), reward form (recommend: fixed bonus to a bonus account, investable but not withdrawable until a vesting/usage rule), caps, clawback on refund.
- **Notification channels at launch**: push + in-app certain; email for transactional/security events — confirm scope.
- **Dark mode**: launch with light only (recommend) or both.
- **Education**: dedicated surface vs contextual help woven into flows — affects IA.
- **KYC provider shortlist**: Dojah, Smile Identity, Prembly (IdentityPass), Youverify, VerifyMe are realistic Nigerian-market candidates with sandbox access; Sumsub/Onfido heavier. Recommend evaluating Dojah and Smile Identity first.

### P2 — can wait

- Coupon/promo engine design · crypto rails · payout provider choice (Paystack Transfers vs Korapay payouts) · analytics provider · biometric/PIN step-up auth design · search beyond Postgres trigram.

---

## E. Proposed Domain Model

```text
Property ──< InvestmentPlan ──< InvestmentRound ──< Investment
   │              (terms template)    (capacity, window,        (user position,
   │                                 lifecycle, counters)      immutable snapshots)
   └──< PropertyDocument (proof, versioning, review status)

User ──< WalletAccount (per currency × type: available/reserved/bonus/…)
User ──< PayoutMethod (tokenized, verified)
User ──< KycCase ──< KycCheck / KycDocument / KycDecision
User ──< Deposit (provider intent + webhook-verified credit)
User ──< Withdrawal ──< PayoutAttempt
User ──< ReferralAttribution / RewardGrant
User ──< Notification / Consent / Session

LedgerTransaction ──< LedgerEntry (append-only, balanced per currency)
   ▲ referenced by every money-moving aggregate

OutboxEvent (domain → workers → push/email/SMS adapters)
WebhookEvent (provider inbox, unique provider event ID)
AuditEvent (append-only, actor + reason + redacted diff)
SystemConfig (KYC thresholds, referral policy, capability flags — versioned)
```

Key relationships:

- An **Investment** snapshots slot price, quantity, ROI, duration, currency, and plan/round version — it never reads live plan economics.
- **Wallet balances are cached projections of the ledger**, updated in the same transaction as ledger entries.
- Every deposit credit, investment debit, maturity settlement, withdrawal reserve/payout, and referral reward is a `LedgerTransaction`.
- **Rounds own the counters** (`total / available / reserved` with check constraints); plans own the terms template; properties own trust/content.

---

## F. Investment Lifecycle

```text
Admin: Property draft → Plan draft → Round scheduled/opened (capacity, window, per-user max)

User: Explore → Property detail (+ proof) → Plan/Round card → "Invest"
  → Server quote (price, per-user remaining allowance, fees, expected return, maturity)
  → Select quantity → Review (explicit terms, no-guarantee language)
  → Funding choice:
      WALLET  → atomic tx: check limits → reserve slots → debit available→reserved → ACTIVE
      DIRECT  → create reservation (slots held, expiry ~15min) → provider intent
                  → webhook VERIFIED → ACTIVE (+ ledger)
                  → webhook late/failed → release slots / auto-refund
  → ACTIVE: countdown to matures_at (server-set UTC)
  → MATURITY_DUE (worker enqueues)
  → SETTLING → ledger posts principal + profit → COMPLETED (+ notification, statement)
  → Round ends: closing window reached → CLOSED; all investments settled → SETTLED (immutable)
  → Admin opens next Round on the same Plan
```

Failure branches: reservation `EXPIRED` / `CANCELLED` / `FAILED` (capacity released); payment `FAILED` / `REVERSED` (investment voided, ledger reversed); settlement `SETTLEMENT_PENDING` → retry or `REVIEW_REQUIRED` — never deleted, never double-credited (idempotent settlement key).

---

## G. Mobile Information Architecture — Proposal

Do not inherit V1's page sprawl. Proposed 5-tab shell:

| Tab           | Contents                                                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home**      | Total balance · invested amount · earnings · next maturity · featured opportunity · pending actions (KYC prompt, failed withdrawal) · optional education strip |
| **Explore**   | Opportunity cards (property + plan + round availability) · search · filters (duration, ROI, amount, status)                                                    |
| **Portfolio** | Active investments · matured/completed history · earnings summary · per-investment timeline                                                                    |
| **Wallet**    | Available/reserved/bonus balances · deposit · withdraw · transaction history (filterable)                                                                      |
| **Account**   | Profile · KYC status · payout methods · security · notification prefs · referrals · help/education · legal · logout                                            |

- Notifications: header icon → notification center (not a tab).
- Referrals: a card on Home + full section under Account — visible but not dominant, so the app reads as an investment platform, not a referral scheme.
- Education: contextual ("how slots work" on first checkout) + a Learn/Help section under Account.
- Property detail → checkout → confirmation → success is a stacked modal flow, not tabs.

Open question: some teams prefer a dedicated **Wallet + Activity** split or a **Rewards** tab. Recommendation stands as above; alternatives noted.

---

## H. Visual Design Directions

Brown stays the primary brand color. Direction is open — pick, eliminate, or combine.

### Direction 1 — "Heritage Premium" (warm luxury)

Deep espresso + cream + terracotta/gold accents; serif display (e.g., Fraunces) over sans body; editorial property photography; generous whitespace; subtle motion.

- **Feel:** established private-wealth house.
- **Pros:** distinctive, warm, high-trust, owns the "Brown" name.
- **Cons:** serif + luxury can skew "exclusive/expensive"; data density harder; risks looking like a lifestyle brand if overdone.

### Direction 2 — "Institutional Fintech"

Dark brown as structural color, neutral grays, restrained gold/green semantic accents; Inter/Jakarta Sans with tabular numerals; dense, precise data presentation; minimal illustration.

- **Feel:** bank-grade seriousness.
- **Pros:** maximum trust, best for financial tables/ledger clarity.
- **Cons:** cold/generic — looks like every neobank; least differentiated.

### Direction 3 — "Modern African Fintech"

Brown + cream base with confident secondary accents (warm green, ochre); Jakarta Sans throughout; rounded-but-controlled cards; local texture/pattern accents used sparingly; friendly microcopy.

- **Feel:** accessible, contemporary, trustworthy, distinctly Nigerian.
- **Pros:** approachable to retail users, strong identity, modern.
- **Cons:** accent palette must be disciplined or it drifts playful; must not feel "startup-y" for large sums.

### Direction 4 — "Property-First Marketplace"

Photography-led cards, dark-brown scrims over imagery, location/maps emphasis, investment terms as a clean spec-sheet module.

- **Feel:** Airbnb-meets-investment.
- **Pros:** sells the property story, aspirational.
- **Cons:** depends on consistently strong property imagery; financial layer can get visually demoted — a trust risk if returns look "marketing-led."

### Current lean (not decided)

Hybrid of 2 + 3 — _"warm institutional"_: cream/ivory surfaces, espresso brown structure, Jakarta Sans with tabular numerals for money, one accent green for success/returns, serif reserved for the marketing site only. Accessible + serious, still unmistakably RentBrown.

---

## I. Platform Strategy

```text
Monorepo (pnpm + Turborepo)
├── apps/mobile        Expo RN app (iOS/Android)
├── apps/web           Next.js investor app  ← pending decision D-3
├── apps/admin         Next.js admin console
├── apps/site          Next.js marketing site
├── apps/api           Modular monolith (recommend NestJS)
├── apps/worker        Maturity scheduler, outbox, webhooks, reconciliation
└── packages/
    ├── domain         Money, ROI math, duration math, state machines (pure TS)
    ├── contracts      Zod/OpenAPI schemas → typed clients for all apps
    ├── ui-tokens      Colors, type scale, spacing, radii (consumed by RN + web)
    ├── providers      Paystack/Korapay/KYC/storage/notification adapters
    └── config / observability / test-utils

PostgreSQL = source of truth · Firebase project reused selectively
(Auth? FCM/Expo Push? — pending inspection)
```

Firebase reuse recommendation pending inspection: strongest candidates are **Auth** (exists, email/phone support, reduces build) and **FCM via Expo Push**. Firestore/Storage for domain data: no — Postgres + S3-compatible object storage. Inspect first (security rules, secrets, config) before committing.

---

## J. Architecture Decisions — ADR Proposals (not locked)

| ADR | Decision          | Proposal                                                                            | Alternatives                              |
| --- | ----------------- | ----------------------------------------------------------------------------------- | ----------------------------------------- |
| 001 | Backend framework | **NestJS** — module discipline fits RBAC/financial boundaries                       | Fastify, Hono                             |
| 002 | Data layer        | Postgres + **Drizzle** (SQL fidelity for ledger queries)                            | Prisma, Kysely                            |
| 003 | Job queue         | **pg-boss** (jobs inside Postgres — no Redis dependency yet)                        | BullMQ+Redis, Cloud Tasks                 |
| 004 | Auth              | **Firebase Auth behind IdentityProvider port** (reuse existing project after audit) | Clerk, Cognito, self-built                |
| 005 | API contract      | REST + OpenAPI → generated typed clients                                            | tRPC (limits web/mobile sharing), GraphQL |
| 006 | Investor web      | Separate Next.js (pending D-3)                                                      | Expo Web                                  |
| 007 | Money/rounding    | Integer minor units + explicit rounding policy; basis points for ROI                | NUMERIC via domain package only           |
| 008 | Maturity timing   | Worker + `FOR UPDATE SKIP LOCKED` claiming `status + matures_at` index              | per-investment timers (rejected)          |

Each ADR gets a one-page doc in Phase 0 with tradeoffs before sign-off.

---

## K. Phase 0 Plan (proposal — not executing)

1. **Decision resolution** — founder answers P0s; every decision logged in `docs/DECISIONS.md`
2. **Product spec** — final domain model, all state machines (investment/deposit/withdrawal/KYC/round), policy tables
3. **UX pack** — IA sign-off, user journeys, wireframe-level flow specs, empty/error/offline state inventory
4. **Design discovery** — pick visual direction → moodboard → token draft → 3 key screens (Home, Property detail, Checkout) for direction validation
5. **Architecture pack** — ADRs, ERD, API contract conventions, ledger chart of accounts, security model, web/app capability model
6. **V1 Firebase inspection** — read-only audit of live rules/config before any reuse decision
7. **Blueprint assembly** — consolidate into the Phase 0 Blueprint → founder approval → only then Phase 1

---

## Outstanding Asks

1. Answers to the **5 P0 questions** in section D (D1 — duration timing — is the most consequential).
2. Reaction to the **4 visual directions** in section H — which to explore, eliminate, or combine.
3. Confirmation of the **IA proposal** in section G, or adjustments.
