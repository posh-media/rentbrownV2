# RENT BROWN V2 — UX & Information Architecture Spec

**Status:** Planning draft — IA approved as _starting point_ (RB-095); all navigation revisable after screen review.
**Design direction:** Warm Institutional Fintech (see DESIGN_DIRECTION.md).
**Principles:** financial clarity over flash · every number traceable · no deceptive urgency · explicit empty/error/offline/stale states · platform capabilities via server-side policy, never hardcoded (RB-094).

---

## 1. Information architecture

```text
Bottom tabs (mobile) / Sidebar-nav (web):
┌─────────────────────────────────────────────────────────┐
│ Home        Explore       Portfolio & Wallet      Account│
└─────────────────────────────────────────────────────────┘

Home
 ├─ Notification center (bell icon, all surfaces)
 ├─ Quick actions: Deposit · Invest · Withdraw
 └─ Learn strip → Learn & Tutorials

Explore
 ├─ Opportunity list (round cards grouped by property)
 ├─ Search + filters
 └─ Property detail → Plan/Round detail → Checkout flow (modal stack)

Portfolio & Wallet
 ├─ Overview (balances + invested + earnings summary)
 ├─ Investments: Active | Matured | All
 ├─ Wallet: Deposit | Withdraw | Balances detail
 └─ Transactions: unified filterable ledger view

Account
 ├─ Profile & verification (KYC status)
 ├─ Payout methods (bank accounts)
 ├─ Referrals
 ├─ Learn & Tutorials
 ├─ Security (PIN, biometrics, sessions, password)
 ├─ Preferences (display currency, notifications)
 ├─ Help & support
 ├─ Legal (terms, privacy, risk disclosures)
 └─ Logout
```

**Navigation rationale:** Portfolio+Wallet merged per founder direction — the "my money" section. Referrals under Account (not a tab) so the product reads as investment-first. Learn exists both as contextual education and a dedicated hub.

**Deep links:** `/property/:slug`, `/round/:id`, `/investment/:id`, `/referral/:code`, `/notifications/:id`, `/kyc`, `/learn/:slug`. Same path scheme on web + mobile.

---

## 2. Screen specifications

Format: **Purpose → Primary data → Actions → States** (L=loading, E=empty, Err=error, O=offline/stale). Capability flags noted where platform-restricted.

### 2.1 Onboarding & auth

**Welcome/onboarding (3 screens max)**

- Purpose: explain RentBrown in 3 beats — invest in property-backed opportunities → fixed-term returns → withdraw at maturity.
- Data: brand, 3 value props, "How it works" link.
- Actions: Sign up · Log in · Browse as guest (if allowed — flag: browsing before signup recommended, open question).
- States: E n/a · Err n/a.

**Sign up**

- Data: name, username (→ referral code seed), email, phone, password, display currency (NGN default), referral code field (prefilled from deep link).
- Actions: create account → email verification sent. Terms acceptance with version recorded.
- States: L: creating; Err: validation/duplicate-email/network.

**Email verification** — required before first investment (recommend; RB-099 open). Resend with cooldown. Skip → browse-only mode.

**Login** — email + password; generic errors; rate-limited. Post-login → Home (or deep-link resume).

**PIN setup** — mobile, post-first-deposit or at first sensitive action; also usable on web for transaction authorization (C-09 pending).

### 2.2 Home

- Purpose: "How much do I have, what's happening, what should I do next."
- Data (server projection, not client-computed):
  - Total balance card: available + reserved + bonus (expandable breakdown)
  - Total invested + active count
  - Earnings to date
  - Next maturity (investment + countdown + amount)
  - Featured/ending-soon opportunities (honest availability, no fake urgency)
  - Pending actions: verify email, complete KYC (when withdrawal-gated), failed withdrawal retry, pending referral reward
  - Learn strip (1 card)
- Actions: Deposit · Explore · Withdraw · card taps → detail.
- States: L: skeleton cards; E: "no investments yet → explore" + "make your first deposit"; Err: retry banner; O: stale-data badge + cached read.

### 2.3 Explore

- Purpose: discovery of open rounds.
- Card content (minimal — detail lives on the next screen): property image + name · location · plan terms chip (ROI · duration) · slot price · availability bar (sold/total) · round status badge.
- Controls: search · filters (duration range, ROI, min slot price, status: open/closing soon) · sort (newest, closing soon, ROI, price).
- States: L: skeleton; E: "no open rounds — notify me" (notification opt-in); Err: retry; O: cached list + staleness indicator.

### 2.4 Property detail

- Purpose: everything needed to trust + decide. Scroll sections:
  1. Hero: image carousel, name, location (public-level), status badge
  2. Open rounds strip: each round card → terms (slot price, ROI, duration, availability, per-user limit, closes_at)
  3. About the property/business: what it is, how it generates revenue, operator info
  4. Proof & documents: verified-doc cards (type, reviewer, date, hash/version) — see RB trust model
  5. Terms & risk disclosure block (always visible, not buried)
  6. Historical performance (clearly labeled, never implied guaranteed)
- Actions: select round → invest CTA · share · save/watchlist (nice-to-have).
- States: L skeleton; Err; sold-out state on all rounds → "This round is fully subscribed — get notified for the next round."

### 2.5 Checkout — wallet-funded

Steps (single screen, progressive):

1. Quantity selector (+ per-user remaining allowance shown; min 1; max = min(remaining allowance, available))
2. Server quote panel: slots × price = principal · ROI · expected profit · expected total · duration · maturity date/time · fees (0 at launch)
3. Funding source: Wallet (balance shown, insufficient → "top up" path) or Pay directly
4. Review + terms acknowledgment (scrollable terms, explicit checkbox)
5. Confirm → PIN/biometric (mobile) / PIN (web)
6. Result: success receipt or error

- States: quote refresh on stale data; capacity changed mid-checkout → re-quote + message; wallet insufficient → inline "deposit & return" path.

### 2.6 Checkout — direct payment

Same as 2.5 but funding = provider checkout. Critical UX differences:

- Honest copy: "Slots are confirmed when your payment is verified. If slots sell out before confirmation, your payment is automatically refunded in full." (C-04/C-12)
- After provider redirect → "confirming payment" screen → success (ACTIVE) or refund notice.
- Failure: payment failed → retry; sold out → refund explanation + timeline.

### 2.7 Investment confirmation / receipt

- Data: investment ref · property + plan · slots · principal · ROI · expected profit · expected total · activated_at · matures_at · status ACTIVE · "no early withdrawal" notice.
- Actions: view investment · back to Home · share (optional).

### 2.8 Portfolio & Wallet — overview

- Data: available / reserved / bonus balances · total invested · active count · lifetime earnings · next maturity.
- Sub-tabs: Investments · Wallet · Transactions.

### 2.9 Investments list

- Filters: Active | Maturing soon | Completed | All.
- Row: property · slots · principal · expected total · progress bar (elapsed/duration) · maturity date · status badge.
- States: E: "no investments — browse opportunities"; Err; L.

### 2.10 Investment detail

- Purpose: complete transparency on one position.
- Data: all §2.7 fields + timeline visualization (activated → midpoint → matured → settled) · ledger-backed events (funding txn, settlement txn refs) · property link · plan/round refs.
- Prominent: "Active until {date} — funds cannot be withdrawn early" (RB-008).
- States: ACTIVE (countdown) · MATURITY_DUE ("maturing") · SETTLEMENT_PENDING ("settling — typically minutes") · COMPLETED (receipt) · REVIEW_REQUIRED ("under review — support will contact you").

### 2.11 Wallet detail

- Balances breakdown: Available (withdrawable) · Reserved (in-flight withdrawals, explained) · Bonus (with "transfer to balance" action) · Bonus pending (with qualification progress).
- Actions: Deposit · Withdraw · Transfer bonus.
- Display currency toggle affects all figures (with rate + timestamp disclosure).

### 2.12 Deposit flow

- Amount (per currency) → method (Paystack/Korapay) → provider UI → confirming → credited receipt.
- Shows: fee (0) · processing fee note (C-05) · expected credit time.
- States: pending (webhook wait — poll/subscribe, "safe to leave, we'll notify") · failed · expired · credited.

### 2.13 Withdrawal flow

- Data: withdrawable balance · min withdrawal (dynamic = cheapest plan's 1-slot maturity value, shown with explanation) · fee itemized before confirm (5%, capped ₦10,000/$10 — user-paid) · destination (verified bank accounts only; add new → name-enquiry verify) · estimated arrival ("manual processing — typically X business hours").
- Steps: amount → destination → review (amount/fee/net) → PIN confirm (web) / PIN or biometric (mobile) → requested.
- Status screens: requested → under review (manual payout queue) → processing → completed | rejected (reason + funds returned) | failed (funds released).
- KYC gate: if policy requires → inline prompt → mobile KYC capture (RB-065); web shows "complete verification in the app". Explain _why_.
- Platform: **both web and mobile** (RB-092) — no platform restriction at launch; capability model can gate later.

### 2.14 Transactions

- Unified ledger-backed history: deposit · investment debit · maturity credit · withdrawal · refund · bonus grant/transfer/reversal · fee.
- Row: type icon · description · amount (signed) · status · date · running balance (optional).
- Filters: type, status, currency, date range. Detail sheet: full refs, provider ref, related entity links.
- States: E ("no transactions yet") · Err · pagination.

### 2.15 Referrals

- Data: referral code + share link · stats (referred count, qualified, pending) · pending rewards (with "credits when {referee} deposits ₦5,000+ and invests") · credited rewards → bonus balance · history · reward rules explainer.
- Actions: copy/share link · transfer bonus · view referred list (privacy-limited: masked identity + status).
- Anti-abuse messaging: rewards credited only on genuine qualifying activity.

### 2.16 KYC

- Entry points: withdrawal gate · Account → Verification.
- Tiers explained (what unlocks what). Flow: personal details → document type → capture (camera, mobile-only) → selfie/liveness → submitted → status (pending/approved/rejected+reason/more-info → resubmit).
- Trust cues: why we ask · encryption note · data-use summary · provider privacy link.
- Web: status view + "complete on the RentBrown app" (RB-065).

### 2.17 Learn & Tutorials

- Hub: categorized articles/videos — What is RentBrown · How slots work · ROI & maturity · Wallet & deposits · Withdrawals · Referrals · KYC · Risks & disclosures · FAQ.
- Contextual: "how it works" links inside checkout, wallet, referral screens; first-time coach marks on Home/Explore.
- States: E (content loading) · search within Learn.

### 2.18 Notifications

- Center: grouped (Today/Earlier), unread badges, categories (Investments · Money · KYC · Referrals · Security · Announcements), tap → deep link.
- Preferences per category × channel (push/email/in-app); security notifications non-disableable.
- E: "You're all caught up."

### 2.19 Account screens

- Profile (name/username/photo; username edit → referral code stays stable, note shown)
- Payout methods (verified bank list; add → name enquiry; delete with cooldown warning)
- Security: password change · PIN set/change/reset (web + mobile, RB-093) · biometric toggle (mobile) · active sessions/devices · logout-all
- Preferences: display currency · notification prefs · language (future)
- Legal: terms (versioned, re-accept on material change) · privacy · risk disclosure
- Support: contact, FAQ link, ticket status

---

## 3. Global state & component requirements

| Concern       | Requirement                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Loading       | Skeletons mirroring layout — no spinners on financial data                                                                 |
| Empty         | Every list/detail has designed empty state with next action                                                                |
| Error         | Retry-first, human language, support link on financial errors                                                              |
| Offline/stale | Read-cache with "last updated" badge; mutations disabled with clear message (never queue money commands silently — RB-105) |
| Numbers       | Tabular numerals, consistent ₦/$ formatting, minor-unit precision, no abbreviations on balances                            |
| Urgency       | Honest availability only; "closing soon" derived from real closes_at; never countdown-pressure tactics                     |
| Disclosure    | Every money screen: fees itemized · return language per counsel (C-01) · risk link                                         |
| Accessibility | WCAG 2.1 AA targets; dynamic type; screen-reader labels on all financial figures                                           |
| Capability    | Server-driven `capabilities` map (e.g., `withdrawal: mobile-only`); UI explains, never just hides                          |

## 4. Open UX decisions (founder)

1. Guest browsing before signup — recommend allow Explore read-only.
2. Bonus → investable: one-tap "invest with bonus" vs explicit transfer — recommend explicit transfer (clearer ledger story).
3. Watchlist/notify-on-new-round — recommend include (drives re-engagement).
4. ~~Withdrawal platform split~~ — resolved: both platforms (RB-092); PIN both platforms (RB-093).

### 2.20 Admin — withdrawal queue (web admin)

- Purpose: manual payout operations for V1 (RB-052).
- Queue list: pending withdrawals — user, amount, fee, net payout, bank details (masked→reveal for authorized role), KYC status badge, requested_at, Telegram-alert delivery status.
- Detail: full audit trail, user snapshot, risk flags (velocity, new payout method, first withdrawal).
- Actions: **Mark as paid** (requires payment reference entry + confirmation; maker-checker above threshold) · **Reject** (reason required → funds released + user notified).
- RBAC: `withdrawal.reviewer` (view+approve) vs `withdrawal.approver` (mark paid) vs finance admin; all actions audited.
