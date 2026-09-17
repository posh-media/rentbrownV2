# RENT BROWN V2 — Decision Register

**Updated:** 2026-09-17 (after founder clarifications)
**Legend:** CONFIRMED · PROVISIONAL · CONFIGURABLE · OPEN · REQUIRES FOUNDER DECISION · REQUIRES LEGAL/COMPLIANCE INPUT · REQUIRES TECHNICAL EVALUATION

Every item has an ID (`RB-###`) for cross-referencing in other docs.

---

## 1. Product & Investment Model

| ID     | Decision                                                                        | Status                              | Notes                                                                                                                                |
| ------ | ------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| RB-001 | Fixed full-term return model: `profit = principal × ROI`, paid once at maturity | **CONFIRMED**                       | Return is snapshotted at activation; not recalculated from business performance                                                      |
| RB-002 | Legal instrument classification (slot = ?)                                      | **REQUIRES LEGAL/COMPLIANCE INPUT** | Architecture stays terminology-neutral: "slot", "investment", "plan", "round". No "shares/equity/ownership/guaranteed" in code or UI |
| RB-003 | Investment durations configurable: value + unit (HOURS/DAYS/WEEKS/MONTHS/YEARS) | **CONFIRMED**                       | 8h/50% plan is a config row, not code                                                                                                |
| RB-004 | Duration runs **per-investment** from server-side activation time               | **CONFIRMED**                       | Round-level fixed maturity may be supported later via optional flag; NOT launch behavior                                             |
| RB-005 | All authoritative timestamps are server UTC; clients localize for display       | **CONFIRMED**                       |                                                                                                                                      |
| RB-006 | Two distinct limits: round capacity + per-user max                              | **CONFIRMED**                       | Both enforced server-side, atomically                                                                                                |
| RB-007 | Domain hierarchy: Property → Plan → Round → Investment                          | **CONFIRMED**                       | Rounds immutable after close; new round = fresh capacity                                                                             |
| RB-008 | No early withdrawal / exit from active investments                              | **CONFIRMED**                       | Enforced in state machine, API, UX, terms, admin, notifications                                                                      |
| RB-009 | Underlying business performance does not feed back into investment returns      | **CONFIRMED**                       | Platform's obligation is contractual per snapshot; shortfall handling is a separate business mechanism                               |
| RB-010 | Slots do not recycle within a round when an investment matures                  | **PROVISIONAL**                     | Recommended: round capacity is consumed once; freeing happens by opening a new round. Confirm at spec time                           |

## 2. Funding & Payments

| ID     | Decision                                                                           | Status                                | Notes                                                                                                       |
| ------ | ---------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| RB-020 | Wallet funding path: atomic debit + capacity check → ACTIVE                        | **CONFIRMED**                         |                                                                                                             |
| RB-021 | Direct payment path via Paystack + Korapay provider adapters                       | **CONFIRMED**                         |                                                                                                             |
| RB-022 | **Direct payment: NO slot reservation before payment**                             | **CONFIRMED (changed)**               | Payment verified → atomic capacity check → activate OR refund. Supersedes earlier reserve-then-pay proposal |
| RB-023 | Verified payment + insufficient capacity → automatic refund/reversal               | **CONFIRMED**                         | Never silent loss, never force-activate, never create capacity                                              |
| RB-024 | Webhooks are the only payment confirmation authority                               | **CONFIRMED**                         | Signature-verified, deduplicated, stored in webhook inbox                                                   |
| RB-025 | Crypto payments                                                                    | **PROVISIONAL (post-launch)**         | Provider abstraction must allow it later                                                                    |
| RB-026 | Coupons/promo codes                                                                | **CONFIGURABLE (post-launch design)** | Architecture accommodates; not a launch dependency                                                          |
| RB-027 | Refund/return transaction costs absorbed by RentBrown                              | **CONFIRMED**                         | Represented in ledger as platform expense, never charged to user                                            |
| RB-028 | Withdrawal payout = **manual admin process for V1** (no payout provider at launch) | **CONFIRMED**                         | Provider payout integration deferred; see STATE_MACHINES §5                                                 |

## 3. Wallet, Ledger & Currency

| ID     | Decision                                                                                         | Status                            | Notes                                                                          |
| ------ | ------------------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------ |
| RB-030 | Double-entry ledger is the sole financial authority                                              | **CONFIRMED**                     | Append-only; corrections via reversal entries                                  |
| RB-031 | Wallet = per-user, per-currency accounts (available / reserved / bonus / bonus-pending)          | **CONFIRMED**                     | Cached balances updated in same txn as ledger entries                          |
| RB-032 | Integer minor units for money; no floating point                                                 | **CONFIRMED**                     |                                                                                |
| RB-033 | NGN default; NGN + USD at launch; multi-currency architecture                                    | **CONFIRMED**                     |                                                                                |
| RB-034 | **No cross-currency investing at launch** — funding currency must equal plan currency            | **CONFIRMED**                     | FX designed-for but not built into launch investment flow                      |
| RB-035 | Display currency switcher (NGN/USD) for wallets, prices, portfolio, earnings, txns               | **CONFIRMED**                     | Display-only conversion via stored FX rates + "converted at rate X" disclosure |
| RB-036 | FX rate source — **required at launch** (display conversion + NGN→USD referral credit)           | **REQUIRES TECHNICAL EVALUATION** | `fx_rates` snapshot table + scheduled fetch; provider selection in Phase 1     |
| RB-037 | Rounding policy: deterministic, half-up, documented per operation type                           | **PROVISIONAL**                   | Spec in FINANCIAL_MODEL §9; confirm                                            |
| RB-038 | Wallet accounts created at signup per currency (NGN + USD empty accounts) vs lazily on first use | **PROVISIONAL**                   | Recommend lazy creation on first relevant event                                |

## 4. Fees & Limits

| ID     | Decision                                                                                                                     | Status                    | Notes                                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| RB-040 | Deposit fee: 0% RentBrown fee; deposit processing fees absorbed by RentBrown                                                 | **CONFIRMED**             | User never charged deposit processing; provider cost logged as platform expense |
| RB-041 | Investment fee: 0%                                                                                                           | **CONFIRMED**             |                                                                                 |
| RB-042 | Withdrawal fee: 5% of amount, capped ₦10,000 / $10 — paid by user                                                            | **CONFIRMED**             | `fee = min(amount × 5%, cap)`                                                   |
| RB-043 | Provider payment-processing costs: absorbed by RentBrown on deposits and refunds                                             | **CONFIRMED**             | Ledger models as platform expense; configurable                                 |
| RB-044 | Taxes: 0 at launch; architecture must support configurable tax rules later                                                   | **CONFIRMED (mechanism)** |                                                                                 |
| RB-045 | Minimum withdrawal = **one-slot maturity value of cheapest published plan** (`slot_price × (1 + ROI)`), computed dynamically | **CONFIRMED**             | Per-currency equivalent; e.g. ₦1,000 slot @50% → ₦1,500 min withdrawal          |
| RB-046 | All fees/limits/taxes live in versioned system policy, never in client code                                                  | **CONFIRMED**             |                                                                                 |

## 5. Withdrawals

| ID      | Decision                                                                                                                     | Status          | Notes                                                                             |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------- |
| RB-050  | Withdrawal only from withdrawable balance; never from active investments                                                     | **CONFIRMED**   |                                                                                   |
| RB-051  | State machine: REQUESTED → FUNDS_RESERVED → REVIEW → APPROVED → PROCESSING → COMPLETED (+ REJECTED/FAILED/RELEASED branches) | **PROVISIONAL** | See STATE_MACHINES                                                                |
| RB-052  | Withdrawal processing: **manual admin payout for V1** — REQUESTED→FUNDS_RESERVED→PENDING_MANUAL_PAYOUT→PAID                  | **CONFIRMED**   | Admin executes external transfer, marks paid; Telegram alert is notification-only |
| RB-053  | Maker-checker for high-value withdrawals                                                                                     | **PROVISIONAL** | Threshold configurable; applies to admin manual payout approvals                  |
| RB-054a | Telegram admin withdrawal alerts: event-driven, non-blocking, never source of truth                                          | **CONFIRMED**   | Failure → recorded, admin panel still authoritative                               |
| RB-054  | Verified payout method ownership required before withdrawal                                                                  | **CONFIRMED**   | Bank account verified via provider name-lookup                                    |

## 6. KYC

| ID     | Decision                                                                  | Status          | Notes                                                               |
| ------ | ------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------- |
| RB-060 | KYC gated primarily on withdrawals; configurable policy                   | **CONFIRMED**   | ₦10,000 threshold / first-withdrawal / tiered — policy-driven       |
| RB-061 | ₦10,000 withdrawal threshold                                              | **PROVISIONAL** | Config value, not code                                              |
| RB-062 | Tiered KYC levels                                                         | **PROVISIONAL** | Tier structure TBD with provider capabilities + counsel             |
| RB-063 | KYC provider: **Smile Identity**, behind `KycProvider` port               | **CONFIRMED**   | Alternates (Youverify/VerifyMe) = adapter swap only; sandbox in dev |
| RB-064 | KYC documents: encrypted private storage, signed URLs, retention policy   | **CONFIRMED**   |                                                                     |
| RB-065 | KYC capture flow is mobile-only; web users see status + "continue in app" | **PROVISIONAL** | Per founder capability list; confirm                                |

## 7. Referrals & Rewards

| ID     | Decision                                                                                                                                                  | Status                      | Notes                                                                                                                               |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| RB-070 | Referrals are launch scope, ledger-backed                                                                                                                 | **CONFIRMED**               |                                                                                                                                     |
| RB-071 | Referral code derived from username; unique + stable even if username changes                                                                             | **CONFIRMED (mechanism)**   | Code is generated once, stored immutably; username change doesn't break it                                                          |
| RB-072 | Signup reward: ₦1,500 fixed, PENDING until referee qualifies (deposit + invest)                                                                           | **PROVISIONAL**             | ₦5,000 deposit threshold removed — residual ambiguity flagged (C-07): does signup-reward deposit minimum now = ₦1,000?              |
| RB-073 | Deposit reward: 5% of each qualifying deposit ≥₦1,000, capped **₦10,000/$10 per transaction** (NOT lifetime)                                              | **CONFIRMED**               | Each qualifying deposit evaluated independently; reward posted on confirmed success only                                            |
| RB-074 | Rewards withdrawable AND investable (bonus → main wallet via ledger transfer)                                                                             | **CONFIRMED**               | Movement only through ledger                                                                                                        |
| RB-075 | Reversal of used rewards → debt/recovery mechanism, not silent negative                                                                                   | **CONFIRMED (mechanism)**   | Treatment proposed in FINANCIAL_MODEL §7 — needs sign-off                                                                           |
| RB-076 | Referral rewards are **NGN-valued**; USD-currency users receive FX-converted credit with full audit trail (source amount, rate, timestamp, target wallet) | **CONFIRMED**               | Reward credits the BONUS account in the user's account/settlement currency; conversion via rate snapshot — see FINANCIAL_MODEL §5.1 |
| RB-077 | Anti-fraud controls: self-referral, device/payment linkage, velocity, clawback                                                                            | **CONFIRMED (requirement)** | Design detail in Phase 1                                                                                                            |

## 8. Notifications

| ID     | Decision                                                                                         | Status        | Notes                                                                               |
| ------ | ------------------------------------------------------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------- |
| RB-080 | Launch channels: push, in-app, email                                                             | **CONFIRMED** | No SMS at launch                                                                    |
| RB-081 | Event-driven via transactional outbox                                                            | **CONFIRMED** |                                                                                     |
| RB-082 | Email provider                                                                                   | **OPEN**      | Architecturally prepared; provider selection later (Resend/Postmark/SES candidates) |
| RB-083 | Event catalogue (signup, KYC, deposits, investments, maturity, withdrawals, referrals, security) | **CONFIRMED** | See STATE_MACHINES notifications column                                             |

## 9. Platforms & UX

| ID     | Decision                                                                               | Status                        | Notes                                                                       |
| ------ | -------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------- |
| RB-090 | Surfaces: Expo mobile · Next.js investor web · Next.js admin · Next.js marketing site  | **CONFIRMED**                 |                                                                             |
| RB-091 | Investor web is a real launch surface, not an afterthought                             | **CONFIRMED**                 | Architecture allows restructuring later                                     |
| RB-092 | Withdrawals available on BOTH web and mobile (first + subsequent)                      | **CONFIRMED**                 | C-08 resolved: no mobile-only withdrawal rule                               |
| RB-093 | PIN set/change/authorize on BOTH web and mobile; KYC capture + biometric = mobile-only | **CONFIRMED**                 | PIN: hashed, attempt-limited, lockout, audited                              |
| RB-094 | Capability/policy system instead of hardcoded platform checks                          | **CONFIRMED**                 | Server-side capability flags per action × platform                          |
| RB-095 | IA: Home · Explore · Portfolio+Wallet (combined) · Account — 4 tabs                    | **PROVISIONAL**               | Approved as starting point; revisable after screen review                   |
| RB-096 | Dedicated Learn & Tutorials area                                                       | **CONFIRMED**                 | Content scope listed in UX_IA_SPEC                                          |
| RB-097 | Visual direction: **Warm Institutional Fintech** (Institutional + Modern African)      | **CONFIRMED for exploration** | Validate via moodboard → tokens → key screens before final lock             |
| RB-098 | Light mode only at launch; tokens architected for dark/system                          | **CONFIRMED**                 |                                                                             |
| RB-099 | Email/phone verification requirements at signup                                        | **OPEN**                      | Recommend email verify required before investing; phone optional tier input |

## 10. Technical Architecture

| ID     | Decision                                                                                                                          | Status                                 | Notes                                                                                                                      |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| RB-100 | Backend: modular monolith, no microservices                                                                                       | **CONFIRMED**                          |                                                                                                                            |
| RB-101 | Datastore: **Supabase Postgres (Frankfurt)** — sole financial authority                                                           | **CONFIRMED (pending final approval)** | Option A in revised assessment                                                                                             |
| RB-102 | Firebase: **removed from V2 architecture** — Supabase Auth/Storage/Postgres replace it                                            | **CONFIRMED**                          | FCM credential remains only as Expo Push plumbing; V1 project gets read-only security inspection then decommission/dormant |
| RB-103 | Vercel hosts all 3 Next.js apps only; API+worker on Cloud Run (Frankfurt, co-located w/ DB)                                       | **CONFIRMED (pending final approval)** | Workers can't live on Vercel                                                                                               |
| RB-104 | Backend framework: **NestJS**                                                                                                     | **CONFIRMED (pending final approval)** |                                                                                                                            |
| RB-105 | Client never financial authority; idempotency everywhere; atomic capacity                                                         | **CONFIRMED**                          | Core principle                                                                                                             |
| RB-106 | Dev/staging/prod separation                                                                                                       | **CONFIRMED**                          |                                                                                                                            |
| RB-107 | Jobs: **pg-boss** (Postgres-native queue, SKIP LOCKED) + Cloud Scheduler triggers                                                 | **CONFIRMED (pending final approval)** | No Redis needed                                                                                                            |
| RB-108 | Monorepo (pnpm + Turborepo)                                                                                                       | **CONFIRMED (pending final approval)** |                                                                                                                            |
| RB-109 | Late-payment-after-close rule: **activate if capacity exists** (capacity is the only gate); `closes_at` blocks new checkouts only | **CONFIRMED**                          | Founder delegated selection; rationale in CONTRADICTIONS C-02                                                              |

## 11. Legal & Compliance (all REQUIRE LEGAL/COMPLIANCE INPUT)

| ID     | Item                                                               | Status                                            |
| ------ | ------------------------------------------------------------------ | ------------------------------------------------- |
| RB-110 | Instrument classification of slots/investments                     | **REQUIRES LEGAL**                                |
| RB-111 | Return language: "expected" vs "fixed" vs "guaranteed" in UI/terms | **REQUIRES LEGAL** — UI copy strings configurable |
| RB-112 | Investor eligibility (age, residency, accreditation)               | **REQUIRES LEGAL**                                |
| RB-113 | AML/sanctions/PEP obligations                                      | **REQUIRES LEGAL**                                |
| RB-114 | Custody/money-transmission licensing implications                  | **REQUIRES LEGAL**                                |
| RB-115 | Terms/privacy/consent versioning                                   | **REQUIRES LEGAL**                                |
| RB-116 | Data retention (KYC, ledger, audit)                                | **REQUIRES LEGAL**                                |
| RB-117 | Cooling-off/cancellation/insolvency/wind-down treatment            | **REQUIRES LEGAL**                                |
| RB-118 | Tax statements/withholding                                         | **REQUIRES LEGAL**                                |

---

## Resolution summary (post founder decisions — 2026-09-17)

- **CONFIRMED:** 51 (incl. 8 pending final approval gate)
- **PROVISIONAL:** 8
- **CONFIGURABLE:** 1
- **OPEN (needs founder):** 2 — RB-082 (email provider), RB-099 (email-verify-before-invest)
- **REQUIRES FOUNDER DECISION:** 0 remaining for architecture; visual-direction lock after screen validation
- **REQUIRES TECHNICAL EVALUATION:** 1 — RB-036 (FX rate provider)
- **REQUIRES LEGAL:** 9 — RB-110–118
- **New this round:** RB-054a (Telegram admin alerts), RB-109 (late-payment rule)
