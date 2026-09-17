# RENT BROWN V2 — Contradictions & Ambiguities

**Updated:** 2026-09-17 (second pass — founder decisions incorporated)
**Purpose:** surfaces where instructions, the audit, or product rules conflict or are under-specified. Each lists resolution status; **RESOLVED** items are kept for the record.

**Status key:** ✅ RESOLVED · ⚠️ PARTIALLY RESOLVED · 🔴 OPEN

---

## C-01 — Fixed return vs "expected return" language — 🔴 OPEN (awaits counsel)

**Tension:** The commercial model is a _fixed_ full-term return (RB-001). The audit warns that "expected" should be used in copy unless a fixed return is legally supportable. If the return is contractually fixed, calling it "expected" undersells the product; if it isn't legally established as fixed, calling it "fixed/guaranteed" creates legal exposure.

**Why it matters:** affects checkout copy, investment detail, receipts, marketing site, terms.

**Recommendation:** keep all return-language strings in a copy/config layer (`return_label`, `return_disclaimer`) so counsel's final wording ships without code changes. Default to "Expected return" + explicit disclaimer until counsel approves stronger language. → RB-111 (LEGAL)

---

## C-02 — Per-investment maturity vs round lifecycle — ✅ RESOLVED (RB-109)

Per-investment duration confirmed (RB-004). A round has three lifecycle dates: `opens_at`, `closes_at` (stops accepting NEW checkouts), and effective end = `closes_at + duration`. Status derived: `OPEN → CLOSED_TO_NEW → SETTLING → SETTLED`.

**Late-payment rule (selected by Devin per founder delegation):** `closes_at` blocks new checkout _initiations_ only. A payment initiated before close and verified after close may still activate **if and only if** capacity remains — capacity is the sole activation gate; if insufficient → auto-refund. Rationale: the user paid in good faith against displayed availability; refunding on a technicality when capacity exists harms the user without protecting any invariant. All financial invariants preserved: no capacity created, no exceeding capacity, no lost payments, no silent money.

---

## C-03 — Display currency requires an FX rate source — ⚠️ PARTIALLY RESOLVED (mechanism confirmed; rate provider TBD, RB-036)

**Tension:** display-currency switching is confirmed (RB-035), but "no FX at launch" was stated for the _investment flow_. Display conversion still needs real exchange rates from somewhere — that _is_ an FX dependency, just read-only.

**Why it matters:** needs a rates table + provider (e.g., exchangerate.host, Open Exchange Rates, Paystack rates) with snapshot timestamps and "converted at ₦X/$" disclosure. Stale rates must show a staleness indicator; if no valid rate exists, UI must not show a fabricated conversion.

**Recommendation:** `fx_rates` table fed by a scheduled job; display layer reads latest rate with timestamp; conversion is always clearly labeled. → RB-036 (TECH EVAL)

---

## C-04 — Pay-before-capacity-check creates a refund-first flow — ✅ RESOLVED (refund costs absorbed by RentBrown, RB-027; honest checkout copy per UX spec)

**Tension:** direct payment verifies _before_ capacity is checked (RB-022/023). This is safe for users but means: (a) users can pay for slots that no longer exist; (b) every such case triggers a refund; (c) Paystack/Korapay charge transaction fees on the original payment — refunds may not return those fees.

**Why it matters:** UX must re-check availability at checkout time and warn "availability not guaranteed until payment confirmed". Finance must decide who absorbs provider txn fees on refunded payments (recommend: RentBrown absorbs — charging a user a fee for a failed purchase is a trust killer).

**Recommendation:** accept the model; add availability re-check + warning in checkout; log refund events for ops. → RB-027 (OPEN — fee absorption)

---

## C-05 — Fee schedule internal inconsistencies — ✅ RESOLVED (RB-040/042/043: withdrawal 5% capped ₦10k/$10 user-paid; deposit processing + refund costs platform-absorbed; all configurable)

_Founder decision supersedes the market-rate concern below — recorded for the record._

**Tensions:**

1. "Withdrawal fee 5% capped ₦10,000/$10" — 5% is far above market (Paystack transfers cost ~₦10–50 flat). A ₦2,000 withdrawal paying ₦100 is fine; but the *cap* semantics need precision: `fee = min(amount × 5%, cap)`. Also, does 5% apply to USD withdrawals at $10 cap?
2. "Payment processing fee 3% where applicable" — Paystack's actual local card fee is ~1.5% + ₦100 (capped ₦2,000); Korapay similar. Is the 3% a RentBrown markup on deposits? If so it contradicts "0% deposit fee" unless 3% is specifically labeled _provider_ fee passed through.
3. Absorb vs pass-through is undecided for every fee.

**Recommendation:** model every fee as `{type, actor(RENTBROWN|PROVIDER), bearer(USER|PLATFORM), formula, cap, currency, policy_version}`. Formalize the fee table in the product spec and get founder sign-off before launch. → RB-040–043 (PROVISIONAL/OPEN)

---

## C-06 — Minimum withdrawal rule is undefined math — ✅ RESOLVED (RB-045: one-slot maturity value of cheapest published plan, dynamic per currency)

**Statement:** "minimum withdrawal should be based on the ROI/slot economics of the smallest investment plan." Interpretations:

- (a) `min_withdrawal = smallest_plan.slot_price` (e.g., ₦1,000)
- (b) `min_withdrawal = smallest_plan.slot_price × ROI` = smallest possible _profit_ (e.g., ₦500)
- (c) `min_withdrawal = smallest_plan.slot_price × (1 + ROI)` = smallest maturity value (e.g., ₦1,500)
- (d) a fixed configurable floor unrelated to plans

**Why it matters:** (b) means a user could withdraw less than one slot's principal — economically odd but legal; (a)/(c) tie the floor to real product units; all must be dynamic since "smallest plan" changes as plans are added/removed.

**Recommendation:** (a) — min withdrawal = slot price of the cheapest _currently published_ plan, computed server-side, cached in policy, shown in withdrawal UI with explanation. Needs founder confirmation. → RB-045 (OPEN)

---

## C-07 — Referral reward definitions — ⚠️ MOSTLY RESOLVED (one residual flag)

**Resolved by founder:** qualifying deposit = successful deposit ≥ ₦1,000 (₦5,000 threshold removed); 5% reward per qualifying deposit; cap ₦10,000/$10 **per transaction** (not lifetime); rewards post only on confirmed deposits; reversals use ledger-backed debt mechanism (RB-073/075/076).

**Residual flag:** the ₦5,000 threshold previously served double duty — it was also part of the _signup reward_ qualification ("deposit ≥₦5,000 AND invest"). The founder's removal was stated in the context of the 5% deposit reward. **Interpretation adopted:** signup reward (₦1,500) now qualifies when referee deposits ≥₦1,000 AND completes a first investment. Flagged for confirmation — if the intent was different (e.g., signup reward still needs a larger deposit), correct at blueprint review. → RB-072

---

## C-08 — Web "first withdrawal" vs mobile "withdrawal" — ✅ RESOLVED (RB-092)

Founder clarified: **both platforms support withdrawals at all times** — web can do first and subsequent withdrawals; mobile always can. The earlier wording was not a restriction. Capability model still applies for future per-action gating (RB-094).

---

## C-09 — PIN semantics — ✅ RESOLVED (RB-093)

Founder confirmed: PIN set/change/reset/authorize on **both** web and mobile. Controls: hashed storage (never plaintext), attempt limits, lockout/cooldown, audited changes and authorizations, step-up where needed. Biometric remains mobile-only.

---

## C-10 — Firebase reuse vs financial-authority requirements — ✅ RESOLVED (RB-101/102)

Firebase removed entirely; Supabase (Postgres+Auth+Storage) replaces it with no meaningful loss — Auth equivalent, Storage equivalent, DB strictly better, Realtime unused. Sole caveat: FCM credential persists as Expo Push plumbing (no Firebase services/SDK). Full analysis in ARCHITECTURE_ASSESSMENT.

---

## C-11 — Vercel vs long-running workers — ✅ RESOLVED (RB-103/107)

Vercel = web apps only. API + worker on Cloud Run (Frankfurt, co-located with Supabase Postgres). pg-boss provides Postgres-native job claiming; Cloud Scheduler triggers sweeps.

---

## C-12 — Wallet-funded vs direct-payment capacity semantics are now asymmetric

Wallet path reserves capacity _inside_ the funding transaction (atomic debit+decrement → ACTIVE instantly). Direct path pays first, then checks capacity. So wallet users get guaranteed activation; direct-pay users get a probabilistic one. This asymmetry is inherent to the founder's model and must be surfaced honestly in UX: wallet funding is "instant activation", direct payment is "subject to availability at confirmation". Consider whether checkout should _offer_ "fund wallet first" as the recommended path for high-demand rounds. → noted for UX spec.

---

## C-13 — "Increment available/total slot" request

Founder asked whether capacity counters ever need adjustment for a verified payment initiated against previously displayed availability. **Answer (analysis):** No — under the pay-first model there is no legitimate "counter adjustment" case. Capacity is only decremented at activation, inside the atomic check. A verified payment that fails the capacity check refunds; it never inflates `total_slots` or reopens `available_slots`. The only counter mutation paths are: `available → allocated` (activation) and `allocated → allocated` (maturity, no counter change — capacity stays consumed per RB-010). Admin capacity changes to a _live_ round are a separate controlled operation (increase only, with audit) — never triggered by payments. → resolved by design, no decision needed unless founder disagrees.

---

## Open questions needing founder answers (consolidated — after 2026-09-17 decisions)

1. **C-07 residual** — confirm signup reward (₦1,500) qualification now = referee deposits ≥₦1,000 AND invests (since the ₦5,000 threshold was removed).
2. **C-01** — legal: final return language ("expected" vs "fixed") — counsel; does not block build.
3. **RB-036** — FX rate provider selection (Phase 1 task; candidates: exchangerate.host, Open Exchange Rates, provider-linked rates).
4. **RB-082** — email provider pick (Resend/Postmark/SES) — can defer to Phase 1.
5. **RB-099** — email verification required before first investment? (recommend yes).

**Resolved this round:** C-02 (late-payment rule), C-04, C-05, C-06, C-08, C-09, C-10, C-11. C-13 resolved by design previously.
