# RENT BROWN V2 — PHASE 0 BLUEPRINT

**Date:** 2026-09-17 · **Status:** FOR FOUNDER REVIEW — NOT APPROVED · **Gate:** Implementation begins only after explicit `APPROVED — BEGIN PHASE 1`.

**Companion documents (authoritative detail):**

- `docs/DECISIONS.md` — full decision register (RB-xxx IDs)
- `docs/CONTRADICTIONS.md` — unresolved tensions (C-xx IDs)
- `docs/FINANCIAL_MODEL.md` — wallet/ledger/fees/referrals/currency
- `docs/STATE_MACHINES.md` — all lifecycle state machines
- `docs/UX_IA_SPEC.md` — IA + screen-by-screen spec
- `docs/DESIGN_DIRECTION.md` — Warm Institutional Fintech design system direction
- `docs/ARCHITECTURE_ASSESSMENT.md` — backend options + KYC comparison

---

## 1. Product specification (summary)

RentBrown is a Nigerian-first platform where users buy **slots** in configurable investment rounds tied to properties/property-businesses, earning a **fixed full-term return** (`profit = principal × ROI`) paid once at server-defined maturity. Domain: `Property → InvestmentPlan → InvestmentRound → Investment` with immutable economic snapshots. Per-investment duration countdowns (RB-004). No early exit (RB-008). Funding via wallet or direct Paystack/Korapay payment — direct payments verify _before_ capacity is allocated, with automatic refund on insufficient capacity (RB-022/023). NGN + USD wallets, no cross-currency investing at launch, display-currency conversion for UI only. KYC gated on withdrawals via configurable policy. Referral bonuses (₦1,500 signup + 5%-of-deposits capped ₦10,000/$10) are ledger-backed with debt-based reversal handling. Learn & Tutorials hub included.

## 2. Domain & financial architecture

Per `FINANCIAL_MODEL.md`: double-entry ledger as sole authority; per-user/per-currency accounts (AVAILABLE · RESERVED · BONUS · BONUS_PENDING); platform accounts (liability, clearing, receivable, revenue, bonus expense, reward receivable, suspense); integer minor units; basis-point ROI; deterministic half-up rounding; immutable entries with reversal-only corrections; versioned fee/tax policy tables; nightly reconciliation + invariant monitors.

## 3. State machines

Per `STATE_MACHINES.md`: Round (DRAFT→SCHEDULED→OPEN→CLOSED_TO_NEW→SETTLED) · Investment wallet-path (→ACTIVE→MATURITY_DUE→COMPLETED) · Investment direct-path (CHECKOUT_INITIATED→PAYMENT_PENDING→PAYMENT_VERIFIED→ACTIVE|REFUND_INITIATED→REFUNDED) · Deposit · Withdrawal (with REVIEW/maker-checker branches) · Referral reward (PENDING→CREDITED|REVERSED|DISQUALIFIED) · KYC · Notification.

## 4. UX / IA

Per `UX_IA_SPEC.md`: 4 primary sections — **Home · Explore · Portfolio & Wallet · Account** (starting point, revisable). Notification center via header. Referrals under Account + Home card. Learn hub under Account + contextual education. Full screen inventory + empty/loading/error/offline specs included. Capability model: server-driven `capabilities` map per action×platform (RB-094).

## 5. Design system direction

Per `DESIGN_DIRECTION.md`: **Warm Institutional Fintech**. Espresso/brown structural palette on cream surfaces, V1 brown (#5D4037) retained as anchor; Plus Jakarta Sans product UI with tabular numerals (serif reserved for marketing site); controlled radii (8–24), border-first elevation; locked status vocabulary; trust-by-design patterns (itemized confirmations, provenance on proof docs, honest urgency). Semantic token architecture supports dark/system later; light-only at launch. Validation via 4 screens: Home → Explore → Property detail → Checkout.

## 6. Platform & backend architecture (REVISED — Supabase-only, pending approval)

```text
apps/mobile   Expo + RN + TS (Expo Router, TanStack Query, RHF+Zod, SecureStore)
apps/web      Next.js investor app — Vercel          (SEO/SSR/native web UX)
apps/admin    Next.js admin console (RBAC, MFA, maker-checker) — Vercel
apps/site     Next.js marketing — Vercel
apps/api      NestJS modular monolith — Cloud Run (europe-west3, co-located w/ DB)
apps/worker   pg-boss jobs: maturity, outbox, webhooks, recon — Cloud Run + Scheduler
packages/     domain · contracts · ui-tokens · providers · config · test-utils

Supabase (Frankfurt):  Postgres = SOLE financial authority · Auth · Storage
Push:                  Expo Push (FCM credential = plumbing only, no Firebase services)
Admin alerts:          Telegram Bot API (withdrawal queue — notification-only)
KYC:                   Smile Identity behind KycProvider port (sandbox in dev)
Email:                 provider TBD (Resend/Postmark) — architecturally prepared
```

**Firebase is fully removed** — Supabase replaces Auth, DB, Storage; realtime unused (polling+push suffices). See ARCHITECTURE_ASSESSMENT for the full evaluation and cost model (~$5/mo dev, ~$50–95/mo launch, ~$150–285/mo at 10k users).

Provider ports: Identity (Supabase Auth) · Payment (Paystack, Korapay) · Payout (manual V1 → provider adapter post-launch) · KYC (Smile) · Storage · Notification (push/email/Telegram) · Clock · IdGen. REST+OpenAPI contracts → generated clients. Monorepo pnpm+Turborepo. Shared client packages for types/contracts/tokens/formatting — UI components NOT shared across platforms (RB-091 revised split confirmed).

## 7. Security model

Client never financial authority · server-enforced capability map (web/mobile) · RBAC with composable permissions + MFA for staff · maker-checker on high-value ops · idempotency keys on all mutations · signed webhook verification + dedupe inbox · immutable audit log · KYC docs encrypted/private/signed-URL · rate limiting + velocity controls · secrets in managed storage · PII-scrubbed observability · session/device management.

## 8. Testing strategy

Domain property tests (money/ROI/rounding/capacity/state guards) · integration vs real Postgres (deposit→credit, wallet-invest, direct-pay+refund, maturity settle, withdrawal lifecycle, referral grant/reversal) · concurrency suite (last-slot race both paths, duplicate webhooks, worker retries) · security suite (IDOR, forged amounts, webhook replay, privilege escalation) · RNTL component tests · Maestro E2E critical journeys.

## 9. Environments & observability

dev / staging / prod separation (RB-106) · typed config validated at boot · CI: lint→typecheck→unit→integration→migration→security gates · alerts on ledger imbalance, stuck settlements, webhook failures, capacity violations · correlation IDs · PII redaction · backups/PITR on Postgres.

## 10. V1 Firebase disposition (updated)

Firebase is **out of the V2 architecture** (RB-102). Remaining actions: read-only security inspection of the live V1 project (rules, secrets, test data, exposed config — never audited live) → then decommission or leave dormant. The only Google artifact retained is an FCM service-account credential as Expo Push plumbing for Android. No data migration — no real user money/KYC exists. Discard: Firestore model, generated rules, all prototype records, unused SDKs.

## 11. Development phases (post-approval — updated)

```text
P1  Repo+CI+envs · Supabase Postgres schema · Supabase Auth adapter · API shell · design tokens
P2  Identity/profile/RBAC · Smile Identity sandbox KYC
P3  Property/plan/round catalogue + admin editors (no investing)
P4  Ledger+wallet core + reconciliation + invariant tests
P5  Deposits (Paystack+Korapay webhooks; platform-absorbed fees)
P6  Investment engine (wallet + direct-pay paths) + concurrency gates
P7  Maturity worker + earnings
P8  Withdrawals — manual admin payout queue + Telegram alerts (no payout provider)
P9  Referrals (NGN rewards + USD conversion) + notifications + Learn content
P10 Investor web parity · capability model · PIN on both platforms
P11 Hardening: pen-test, load, DR, runbooks → staged launch
```

## 12. Acceptance criteria (definition of done)

Ledger balances provably; last-slot race deterministic on both funding paths; duplicate/replayed webhooks safe; no client path to money state; KYC/privacy controls verified; admin RBAC+maker-checker functional; all screens have designed empty/error/offline states; reconciliation green; security review clean; founder + counsel sign-off.

---

# APPROVAL GATE — READ THIS SECTION

## ✅ What is confirmed (no action needed)

Fixed full-term return · per-investment duration · no early exit · Property→Plan→Round→Investment hierarchy · dual funding paths with pay-then-check-capacity + auto-refund · late-payment rule = activate-if-capacity · NGN+USD, no FX investing at launch, display-currency toggle · referral rules (₦1,500 signup pending→qualified, 5% of deposits ≥₦1,000 capped ₦10k/$10 per transaction, USD conversion w/ audit) · withdrawal fee 5% capped ₦10k/$10 user-paid · deposit processing + refund costs platform-absorbed · min withdrawal = cheapest plan's 1-slot maturity value · manual admin withdrawal payout + Telegram alerts · withdrawals + PIN on web AND mobile · push+in-app+email notifications · 4-surface split (Expo / 3× Next.js) with shared packages · Smile Identity behind KycProvider port · Warm Institutional direction · light-only launch · Learn hub · 4-tab IA · all founder principles (server authority, immutability, idempotency, concurrency, transparency).

## ⚠️ What remains open — needs YOUR answers (much shorter now)

1. **Final architecture sign-off** — Supabase-only + NestJS on Cloud Run (Frankfurt) + Vercel webs + Expo Push. Approve or amend.
2. **C-07 residual:** signup reward qualification — is it now "referee deposits ≥₦1,000 AND invests"? (I interpreted yes.)
3. **RB-099:** require email verification before first investment? (rec: yes)
4. **RB-082:** email provider — Resend (rec) / Postmark / SES — or defer to Phase 1.
5. Minor: guest browsing allowed? (rec: yes, read-only) · bonus→investable via explicit transfer (rec: yes) · watchlist feature (rec: yes).

## ⚖️ What requires legal/compliance input (does not block build, blocks launch copy/terms)

RB-110–118: instrument classification · return language ("expected" vs "fixed") · investor eligibility · AML obligations · custody/licensing · terms/privacy versioning · retention · cooling-off/wind-down · tax. UI strings kept configurable meanwhile (C-01).

## 🔬 What requires technical validation (Phase 1 verification tasks)

V1 Firebase project read-only security inspection then decommission decision (RB-102) · FX rate provider selection (RB-036 — now needed at launch for USD referral credits) · Supabase Pro/PITR configuration verification · Cloud Run Frankfurt deploy + Scheduler wiring · Paystack/Korapay + Smile Identity sandbox contract tests.

## ⛔ Explicitly out of scope for launch

Crypto payments · SMS channel · cross-currency investing/FX execution · early exit mechanism · dark mode UI (tokens ready) · coupons engine (design-ready) · microservices.

---

**Next step:** founder answers the open items above (or delegates with "use your recommendation"), then issues `APPROVED — BEGIN PHASE 1`.
