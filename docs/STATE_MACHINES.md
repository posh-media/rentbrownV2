# RENT BROWN V2 — State Machines

**Status:** Planning. States are normative for Phase 0 spec; names may be refined during implementation but transitions/guards may not.
**Global rules:** transitions only via backend services · every transition writes an audit/outbox event · failed/cancelled entities are never deleted · idempotency keys guard every transition into a money-moving state.

---

## 1. Investment Round

```text
DRAFT ──publish──► SCHEDULED ──opens_at reached──► OPEN
                                                   │
                        closes_at reached / admin close
                                                   ▼
                                              CLOSED_TO_NEW
                                                   │
                        all investments COMPLETED / resolved
                                                   ▼
                                                SETTLED   (immutable, terminal)
Admin branches: DRAFT→ARCHIVED; SCHEDULED→CANCELLED (only if zero investments)
Guards: OPEN requires opens_at ≤ now < closes_at AND status published AND property published.
Counters on round: total_slots · available_slots · allocated_slots · version
  CHECK available >= 0 · CHECK allocated >= 0 · CHECK available + allocated <= total
```

**Derived dates:** `effective_end = closes_at + plan.duration` (upper bound for last maturity). Slots do NOT recycle inside a round (RB-010).

---

## 2. Investment — wallet-funded

```text
(request)
   │  atomic txn: lock round → check capacity + per-user allowance →
   │  ledger DR available / CR liability → decrement counters
   ▼
ACTIVE ──matures_at reached──► MATURITY_DUE ──settlement txn──► COMPLETED
                                   │ settlement failure (retryable)
                                   ▼
                             SETTLEMENT_PENDING ──retry──► COMPLETED
                                   │ manual intervention
                                   ▼
                             REVIEW_REQUIRED ──admin resolution──► COMPLETED

Failures at creation: VALIDATION_FAILED (no investment row, or row in FAILED state
for audit — prefer no row + logged attempt). No RESERVED state needed for wallet path.
```

## 3. Investment — direct payment

```text
CHECKOUT_INITIATED          (intent created, NO capacity held)
   │ client completes provider UI
   ▼
PAYMENT_PENDING ──provider timeout──► PAYMENT_EXPIRED ──► (if paid late → LATE_PAYMENT_REFUND)
   │ verified webhook (signature + amount + ref match)
   ▼
PAYMENT_VERIFIED
   │ atomic txn: re-check capacity + allowance
   ├── capacity OK ──► ACTIVE ──► MATURITY_DUE ──► COMPLETED   (same as §2)
   └── capacity insufficient ──► REFUND_INITIATED ──provider──► REFUNDED
                                     │ refund fails
                                     ▼
                              REFUND_FAILED ──retry/manual──► REFUNDED | OPS_ESCALATED

Guards:
- PAYMENT_VERIFIED transition only from webhook service, never client.
- Capacity check happens inside the same DB txn that decrements counters.
- REFUNDED requires provider confirmation event, not just refund API success response.
```

## 4. Deposit

```text
INTENT_CREATED ──client abandons/expires──► EXPIRED
   │ verified webhook
   ▼
VERIFIED ──ledger credit txn──► CREDITED
   │ chargeback / provider reversal
   ▼
REVERSED  (funds clawed back; if user already spent → SUSPENSE + ops case)

Failed paths: PROVIDER_FAILED · CANCELLED_BY_USER
```

## 5. Withdrawal — manual admin payout (V1, RB-052)

```text
REQUESTED ──validate: auth, PIN, balance, min-withdrawal, KYC policy, limits──┐
   │ fail                                                                   │
   ▼                                                                        ▼
FUNDS_RESERVED (ledger: DR available → CR reserved)                    REJECTED (terminal)
   │
   ▼  outbox → Telegram admin alert (non-blocking; failure logged, never blocks)
PENDING_MANUAL_PAYOUT        ← admin queue is the source of truth, NOT Telegram
   │
   ├── admin executes external bank transfer, marks PAID
   │   (maker-checker above configurable threshold)
   │        ▼
   │   COMPLETED  (ledger: DR reserved → CR payout payable + CR fee revenue)
   │
   ├── admin rejects (reason required) ──► REJECTED_RELEASED
   │        (ledger: reserved → available reversal + user notification)
   │
   └── admin cancels / payment fails ──► FAILED_RELEASED (funds released)

Future branch (post-launch, provider payout): PENDING_MANUAL_PAYOUT →
  PAYOUT_PROCESSING → provider confirm → COMPLETED | FAILED_RELEASED
  (structure retained so automation slots in without redesign)

Policy gates (configurable): KYC tier · min/max amount · daily velocity ·
cooldown after payout-method change · maker-checker threshold.
Platforms: web + mobile both supported (RB-092).
```

## 6. Referral reward

```text
ATTRIBUTED (referee signup recorded)
   │
   ├── signup_reward: PENDING ──referee deposits ≥min AND invests──► CREDITED
   │                                  │ referee churns/refunds first
   │                                  ▼
   │                             DISQUALIFIED | REVERSED
   │
   └── deposit_reward: (per qualifying deposit) PENDING? → CREDITED
           └── referee deposit refunded ──► REVERSED (§7 debt mechanism if spent)

Caps enforced at credit time (per-referred-user lifetime cap, configurable).
```

## 7. KYC case

```text
DRAFT ──submit──► SUBMITTED ──provider sync──► IN_REVIEW
                     ├── APPROVED (tier granted, expiry optional)
                     ├── REJECTED (reason codes) ──► resubmit → new attempt (history kept)
                     ├── MORE_INFO_REQUIRED ──► resubmit
                     └── EXPIRED (document/provider expiry)
```

## 8. Notification (delivery)

```text
Outbox: PENDING ──worker──► DISPATCHING ──provider ack──► SENT/DELIVERED
                            │ transient fail            │ permanent fail
                            ▼                           ▼
                     RETRY_SCHEDULED (backoff)      FAILED (alert; never blocks domain txn)
```

## 9. Cross-machine consistency notes

- **MATURITY_DUE is not money.** Only the settlement txn credits; an investment showing "matured" with failed settlement stays `SETTLEMENT_PENDING` — UI must show "settling", not "paid".
- **REFUNDED ≠ investment cancelled.** The investment never became ACTIVE; the payment record shows the refund trail.
- **REJECTED_RELEASED** states are explicit (not "cancelled") so users see funds returned.
- **Every terminal financial state emits:** ledger txn (if money moved) + audit event + outbox notification.
- **Clock:** all `*_at` fields are server UTC; `matures_at` is set once at activation from the plan's `duration_value/unit` — never recomputed, never client-supplied.
