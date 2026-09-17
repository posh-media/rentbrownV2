# RENT BROWN V2 — Financial Model (Conceptual)

**Status:** Planning document. Requires founder sign-off on flagged items before implementation.
**Cross-refs:** DECISIONS.md (RB-xxx), CONTRADICTIONS.md (C-xx)

---

## 1. Core principles

1. The **ledger is the only financial authority**. Wallet balances are cached projections, updated inside the same DB transaction as the ledger entries that cause them.
2. **All money is integer minor units** (kobo, cents). No floating point anywhere in the money path.
3. **Ledger entries are immutable.** Errors are fixed by reversal/compensating entries linked to the original transaction.
4. **Every ledger transaction balances to zero per currency.** `Σ(debits) = Σ(credits)` within each currency, enforced by a DB constraint + property tests.
5. **Idempotency everywhere.** Every money-moving operation carries a unique idempotency key; retries replay stored results.
6. **No client-initiated balance mutation.** Clients request intents; the server computes, validates, and posts.

---

## 2. Account model (chart of accounts — conceptual)

### 2.1 User-facing wallet accounts (per user × per currency)

| Account type    | Meaning                                                                        | Credits from                                                                                    | Debits to                                                            |
| --------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `AVAILABLE`     | Spendable + withdrawable cash                                                  | deposits, matured principal+profit, bonus transfers-in, released reserved funds, refund credits | wallet-funded investments, withdrawal reservations, bonus? no        |
| `RESERVED`      | Funds committed to a pending operation (withdrawal in flight)                  | available → reserved on withdrawal request                                                      | released back to available on failure, or paid out on success        |
| `BONUS`         | Credited referral/reward funds — usable for investing or transfer to AVAILABLE | referral rewards, promo credits                                                                 | transfer to AVAILABLE (to invest/withdraw), reversals                |
| `BONUS_PENDING` | Referral rewards awaiting qualification                                        | reward grants                                                                                   | promotion to BONUS on qualification, or reversal on disqualification |

Notes:

- "Available" and "withdrawable" are the same pool at launch (RB-031); the split exists in the model so policy can diverge them later without schema change.
- BONUS can fund investments and can be converted to AVAILABLE (which then withdraws). Whether BONUS→AVAILABLE is unrestricted or rate-limited is policy — recommend unrestricted at launch since rewards are confirmed withdrawable (RB-074).

### 2.2 Platform/internal accounts (per currency)

| Account                          | Role                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `PLATFORM_CLEARING:{provider}`   | In-flight provider money (deposits received not yet credited, payouts in flight) |
| `PROVIDER_RECEIVABLE:{provider}` | Money providers owe us                                                           |
| `INVESTMENT_LIABILITY`           | Obligation to investors: principal + accrued return of active investments        |
| `PAYOUT_PAYABLE`                 | Approved withdrawals awaiting provider settlement                                |
| `REVENUE_FEES`                   | RentBrown fee income (withdrawal fees etc.)                                      |
| `BONUS_EXPENSE`                  | Cost centre for referral/promo grants                                            |
| `REWARD_RECEIVABLE`              | Debt account for over-reversed rewards (see §7)                                  |
| `SUSPENSE`                       | Unreconciled/temporary holding; must trend to zero                               |

Exact accounting treatment (revenue recognition, liability vs escrow classification) needs a finance professional — flagged RB-118-adjacent.

---

## 3. Ledger structures

```text
ledger_transactions
  id (ULID) · type · status · currency
  idempotency_key (unique per scope) · actor_id · subject_id
  aggregate refs (investment_id, deposit_id, withdrawal_id, reward_id…)
  provider · provider_ref
  occurred_at / posted_at / reversed_at · reversal_of (nullable)
  metadata (redacted JSON, size-limited)

ledger_entries
  id · transaction_id · account_id
  direction (DEBIT|CREDIT) · amount (int minor, >0) · currency
  balance_after (cached snapshot, optional)
  created_at (immutable)

wallet_accounts
  user_id · currency · type · cached_balance · version · status
  UNIQUE(user, currency, type)

Constraints:
  - CHECK amount > 0
  - per-transaction Σ debits = Σ credits per currency (validated in code + invariant test; a deferred constraint is impractical — enforce via posting service + nightly reconciliation)
  - no UPDATE/DELETE on ledger_entries (revoke at DB role level)
```

---

## 4. Money flows — ledger postings

### 4.1 Deposit (external funding)

```text
Intent:      client → POST /deposits {amount, currency, method, idempotency_key}
             → deposit_intent CREATED → provider checkout
Verify:      signed webhook → webhook_events dedupe → verify amount/currency/ref
Credit txn:  DR  PROVIDER_RECEIVABLE:{provider}        amount
             CR  user.AVAILABLE                         amount
             (deposit fee = 0 at launch; if provider fee passed through later:
              CR split: user.AVAILABLE net, REVENUE_FEES/PROVIDER fee portion)
Reversal:    chargeback → reversal txn of the credit, balance goes to SUSPENSE if user already spent (ops case)
```

### 4.2 Wallet-funded investment

```text
Single atomic DB transaction:
  1. Lock round row; CHECK available_slots >= qty AND user remaining allowance >= qty
  2. Ledger txn:
     DR  user.AVAILABLE                    principal
     CR  user→INVESTMENT_LIABILITY         principal   (platform owes investor)
  3. round.available -= qty; round.allocated += qty
  4. investments row: ACTIVE, starts_at=now(), matures_at=now()+duration (server UTC)
     snapshots: slot_price, qty, principal, roi_bps, duration, expected_profit, expected_total
```

### 4.3 Direct-payment investment

```text
Intent:      POST /investments/direct {round_id, qty, idempotency_key}
             → server validates round open + displayed availability (advisory) + per-user allowance
             → creates payment_intent (provider ref) → client pays
Webhook:     verified → DB transaction:
               1. Re-lock round; CHECK available_slots >= qty AND allowance
               2. If OK → same postings as 4.2 + DR PROVIDER_RECEIVABLE/CR CLEARING bridge
                  → ACTIVE
               3. If NOT OK → initiate provider refund:
                  DR PROVIDER_RECEIVABLE reversal → REFUNDING → webhook confirm → REFUNDED
Timeout:     no webhook within N hours → intent EXPIRED; if provider shows paid later → auto-refund path
Late close:  payment verified after round closes_at → activate IF capacity remains
             (closes_at gates new checkouts, not verified settlements — RB-109);
             insufficient capacity → auto-refund
```

### 4.4 Maturity settlement

```text
Worker enqueues matured ACTIVE investments (FOR UPDATE SKIP LOCKED).
Settlement txn (idempotent settlement_key = investment_id):
  DR  INVESTMENT_LIABILITY            principal + profit
  CR  user.AVAILABLE                  principal + profit
  → investment COMPLETED, completed_at set
  → outbox event → notification + statement
Principal and profit are recorded as separate ledger entries (auditability) inside one transaction.
```

### 4.5 Withdrawal — MANUAL admin payout (V1, RB-052)

```text
1. REQUEST:    client → POST /withdrawals {amount, payout_method_id, idempotency_key}
               server validates: auth, PIN auth, balance, min-withdrawal rule,
               KYC policy, limits/velocity, fee computation
2. RESERVE txn: DR user.AVAILABLE → CR user.RESERVED   (gross amount; fee recorded on withdrawal)
               state: FUNDS_RESERVED → PENDING_MANUAL_PAYOUT
3. NOTIFY:     outbox → Telegram admin alert (fire-and-forget w/ retry logging;
               Telegram failure NEVER blocks the withdrawal — admin panel is authoritative)
4. ADMIN:      admin reviews queue (user, amount, fee, net, bank, KYC status, audit)
               → executes external bank transfer manually
               → marks PAID in admin (maker-checker above threshold)
5. SETTLE txn:  DR user.RESERVED   gross
                CR PAYOUT_PAYABLE → CASH_OUT   net payout
                CR REVENUE_FEES                fee
               state: COMPLETED + notification
REJECT path:   reversal txn DR user.RESERVED → CR user.AVAILABLE + reason + notification
               state: REJECTED_RELEASED
```

Fee model: `fee = min(amount × 5%, ₦10,000 / $10)` — user-paid (RB-042). Minimum withdrawal = one-slot maturity value of cheapest published plan (RB-045). Provider payout automation deferred post-launch — state machine retains a `PAYOUT_PROVIDER` branch stub so it can be introduced without redesign.

### 4.6 Bonus → investable cash

```text
User moves bonus to main wallet (explicit action):
  DR user.BONUS → CR user.AVAILABLE   (ledger txn, type=BONUS_TRANSFER)
Direct bonus investment (optional): DR user.BONUS → CR INVESTMENT_LIABILITY
```

### 4.7 Referral reward lifecycle (updated rules — RB-072/073/076)

```text
Attribution:     signup with code → referral_attribution row (immutable)

Signup reward:   referee deposits ≥ ₦1,000 (see C-07 residual flag) AND completes
                 first investment → referrer reward PENDING → CREDITED:
                 DR BONUS_EXPENSE    ₦150,000 (₦1,500, kobo)
                 CR referrer.BONUS   ₦150,000

Deposit reward:  each CONFIRMED referee deposit ≥ ₦1,000 qualifies independently:
                 reward = min(5% × deposit, ₦10,000 / $10)   ← PER TRANSACTION cap
                 DR BONUS_EXPENSE    reward
                 CR referrer.BONUS   reward
                 posted only on deposit success; failed/reversed deposits = no reward

Reversal:        referee deposit refunded post-credit →
                 DR referrer.BONUS   reward_amount
                 CR BONUS_EXPENSE    reward_amount
                 (if BONUS insufficient → REWARD_RECEIVABLE debt path, §7)

USD referral credit (RB-076): rewards are NGN-valued. If referrer's account
currency is USD, the credit converts via rate snapshot — full audit trail:
  reward_grants: source_amount_minor (NGN) · source_currency=NGN
                 fx_rate · fx_rate_at · target_currency · credited_amount_minor
                 referral_id · triggering_deposit_id
  Ledger (two balanced legs via FX_CLEARING):
    DR BONUS_EXPENSE.NGN   1500      CR FX_CLEARING.NGN   1500
    DR FX_CLEARING.USD     X         CR user.BONUS.USD    X
```

**Which wallet receives the reward (proposed rule — confirm):** rewards credit the BONUS account matching the user's declared **account/settlement currency** (chosen at onboarding, changeable in preferences). NGN reward + USD account currency → convert at latest `fx_rates` snapshot. If the user has no account currency set → default NGN.

---

## 5. Currency model

Four distinct concepts — do not conflate:

| Concept                     | Definition                         | Launch behavior                                                                          |
| --------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Wallet currency             | Currency of each wallet account    | NGN + USD accounts; balance held per currency                                            |
| Investment/plan currency    | Currency a round is denominated in | Set per plan; funding must match exactly                                                 |
| Display currency            | User's UI preference               | NGN/USD toggle; converts via `fx_rates` snapshots, clearly labeled, never affects ledger |
| Settlement/payment currency | What the provider actually moves   | = wallet or plan currency                                                                |

Rules:

- Funding currency MUST equal plan currency at launch (RB-034). An NGN wallet cannot fund a USD plan; the plan UI shows the funding requirement and offers deposit in the right currency.
- **One sanctioned conversion path at launch:** NGN-valued referral rewards credited to USD-account users (RB-076) — executed as a two-legged balanced txn through `FX_CLEARING` with a rate snapshot and full audit fields. All other FX remains deferred.
- `fx_rates`: `{base, quote, rate, source, fetched_at}` — display layer uses latest ≤ N hours old; referral conversion uses latest rate with `fx_rate_at` recorded on the grant; older → show "rate unavailable"/queue conversion, never fabricate.

---

## 6. Fee & tax engine

```text
fee_policies (versioned):
  scope: DEPOSIT | INVESTMENT | WITHDRAWAL | PROCESSING | REFERRAL
  actor: RENTBROWN | PROVIDER
  bearer: USER | PLATFORM
  formula: {type: PERCENT|FLAT|TIERED, bps|amount, min, max, currency}
  effective_from/to · policy_version

tax_policies: same shape, 0% at launch — structure exists so counsel can add rules without schema change.
```

All quote/checkout responses itemize: principal, RentBrown fees, provider fees, tax, net. Client never computes.

**Confirmed launch defaults (RB-040–043):**

| Fee              | Value                                                                  | Bearer                                        |
| ---------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| Deposit fee      | 0%                                                                     | — (provider processing absorbed by RentBrown) |
| Investment fee   | 0%                                                                     | —                                             |
| Withdrawal fee   | `min(amount × 5%, ₦10,000 / $10)`                                      | **User**                                      |
| Refund txn costs | provider fees on refunds                                               | **Platform** (expense, logged)                |
| Min withdrawal   | `cheapest_published_plan.slot_price × (1 + ROI)` per currency, dynamic | —                                             |
| Tax              | 0% (structure exists for later rules)                                  | —                                             |

## 7. Referral over-reversal — proposed accounting treatment (needs sign-off)

Problem: a referee's deposit is refunded _after_ the referrer already spent/withdrew the reward. Blindly debiting BONUS would drive it negative or fail.

Recommended treatment:

```text
1. Attempt: DR user.BONUS up to available balance → CR BONUS_EXPENSE
2. Shortfall remainder:
   DR  REWARD_RECEIVABLE:{user}     remainder
   CR  BONUS_EXPENSE                remainder
3. REWARD_RECEIVABLE is a per-user debt account:
   - future BONUS credits auto-offset against it first
   - admin sees it as "reward debt" on the user record
   - optional: auto-offset against future AVAILABLE credits ONLY if policy permits
     (recommend: bonus-only offset at launch; cash offsets need legal/UX sign-off)
   - never silently drives AVAILABLE negative
4. Every step is a ledger txn + audit event; user sees "reward adjustment" in history.
```

Alternative rejected: negative BONUS balance (breaks non-negative invariant, confusing UX).

## 8. Reconciliation & invariants

- **Nightly job:** Σ ledger entries per account == cached balance; ledger balances to zero per currency; provider settlement reports vs `PROVIDER_RECEIVABLE`; active investment liability == Σ active snapshots.
- **Invariant monitors (alerting, not just nightly):** negative balances, unbalanced transactions, capacity counters out of bounds (`0 ≤ available ≤ total`, `allocated + available ≤ total`), orphan intents, stuck SETTLING > threshold.
- Property-based tests in `packages/domain` for: ROI math, rounding, fee formulas, ledger balancing, capacity race.

## 9. Rounding policy (proposed — confirm)

- Store money as int minor units; ROI as basis points (`5000` = 50.00%).
- `profit = floor(principal × roi_bps / 10000 + 0.5)` — half-up to nearest minor unit, computed once at activation and snapshotted.
- Percentage fees: same half-up rule; fee cap applied after rounding.
- Display conversion: `floor(amount × rate)` for display only, never persisted as authoritative.
- All rounding functions live in `packages/domain/money` with property tests vs. reference implementations.

## 10. What this model deliberately does NOT do

- No interest accrual over time (return is a maturity lump sum).
- No dynamic performance-based repricing.
- No early exit / secondary market.
- No negative wallet balances (REWARD_RECEIVABLE holds debt instead).
- No client-computed quotes — server quotes only.
