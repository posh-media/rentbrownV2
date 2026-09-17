# RENT BROWN V2 — Backend Architecture Assessment (REVISED)

**Status:** REVISED after founder direction — Supabase-first re-evaluation + hosting/DB evaluation.
**Previous version:** superseded (Firebase+Supabase hybrid no longer proposed).

---

## 1. The workload's non-negotiables (unchanged)

| Requirement                            | Needed for                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Serializable multi-entity transactions | wallet debit + capacity decrement + investment = all-or-nothing                                           |
| Hot-counter concurrency                | last-slot races must be correct AND fast                                                                  |
| Declarative DB invariants              | `0 ≤ available ≤ total`, `Σ debits = Σ credits`, `amount > 0` enforced at the datastore, not only in code |
| Append-only enforcement                | ledger immutability via DB permissions, not convention                                                    |
| Relational querying                    | reconciliation, admin queues, statements, reports                                                         |
| Durable job claiming                   | maturity settlement, outbox, webhooks — `FOR UPDATE SKIP LOCKED` semantics                                |
| Unique constraints                     | idempotency keys as the final duplicate-guard                                                             |
| Nigerian accessibility                 | reasonable latency for Lagos users; reliable payments-region connectivity                                 |

## 2. Can Supabase replace Firebase? — Requirement-by-requirement

| Firebase responsibility                          | Supabase equivalent                                                                                                                    | Replaceable?                      |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Auth** (email/password, sessions, RBAC claims) | **Supabase Auth** — email/password, magic link, OAuth, MFA, JWT access tokens verified locally via JWKS, user metadata for role claims | ✅ Yes — equivalent for our needs |
| **Database**                                     | Supabase **is** managed Postgres — strictly better than Firestore for this workload                                                    | ✅ Yes — upgrade, not replacement |
| **Storage**                                      | Supabase Storage — private buckets, signed URLs, RLS policies                                                                          | ✅ Yes                            |
| **Realtime**                                     | Supabase Realtime exists, but we barely need it — TanStack Query refetch + push notifications cover UX needs                           | ✅ Yes (mostly unused)            |
| **Cloud Functions**                              | NestJS API owns all business logic anyway (server-authoritative)                                                                       | ✅ Yes                            |
| **Push notifications**                           | ⚠️ **Partial caveat — see below**                                                                                                      | ⚠️                                |
| **App Check**                                    | No direct equivalent; API-level rate limiting + device attestation later                                                               | ⚠️ acceptable loss                |

**The one honest caveat — Android push:** Expo Push delivers to Android through FCM, which requires a Google/FCM service-account credential. There is no way to do Android push without FCM. This means a **Google credential remains as invisible infrastructure plumbing** inside Expo Push — but no Firebase SDK, no Firebase project dependency in app/backend code, no Firebase services in the architecture. iOS uses APNs directly. Net: "Firebase the platform" is removed; an FCM credential is plumbing, not a backend platform.

## 3. Option comparison

### Option A — Supabase + NestJS, no Firebase (RECOMMENDED)

```text
Client (Expo / Next.js)
  → Supabase Auth (login only — JWT issued)
  → NestJS API (verifies Supabase JWT, owns ALL business logic)
  → Supabase Postgres (direct pg connection — NOT Supabase client APIs)
  → Supabase Storage (signed URLs issued by API only)
  → Expo Push (notification delivery)
```

- **Strengths:** one backend platform to learn/operate/secure; Postgres primitives for every financial invariant; JWT auth maps cleanly to `IdentityProvider` port; founder familiarity preserved; lower cost than dual-platform; single security model.
- **Weaknesses:** loses App Check; Supabase Auth is younger than Firebase Auth (mature enough — used widely in production); must configure Supabase Postgres correctly (direct connection string, connection pooler, RLS off/bypass for service role since API mediates all access).
- **Boundary:** client talks to Supabase ONLY for auth (and signed-upload via API-issued URLs). All domain data flows through NestJS → Postgres via `pg`/Drizzle — never Supabase auto-APIs (PostgREST not exposed to clients).

### Option B — Firebase + Supabase + NestJS

- Adds Firebase Auth while Supabase already provides Auth. Two identity systems = token verification for two issuers, two admin consoles, duplicated user mapping, doubled secrets surface, and the open question "which is authoritative" — pure cost, no benefit. Firebase would also keep the V1 project's unsafe-rules legacy surface alive.
- **Verdict: rejected.** Rejected on architecture, not familiarity — dual auth is objectively worse.

### Option C — alternatives considered

- **Firebase-only:** rejected in prior assessment (no constraints, hot-counter contention, rules-regression risk already burned V1).
- **Clerk/Auth0 + Supabase:** better auth UX polish but extra vendor + cost for no current need; Supabase Auth sufficient.
- **AWS Cognito + RDS:** heavier ops, worse DX for this team size; rejected.

**DECISION: Option A — Supabase + NestJS, Firebase removed.**

## 4. Hosting & database evaluation

### 4.1 Latency reality check

Two latency paths matter differently:

- **User → API:** Lagos→Frankfurt ≈ 120–180ms RTT. Acceptable for this app class (not realtime trading). Lagos→Johannesburg ≈ 30–60ms (Equiano cable) — better but not critical.
- **API → DB:** the dominant factor — every request makes several DB round trips. **API and DB must be co-located.** This single rule drives the recommendation.

### 4.2 Database options

| Option                    | Latency (from API if co-located)  | Backups/PITR                                      | Cost early             | Notes                                                                                                           |
| ------------------------- | --------------------------------- | ------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Supabase Postgres**     | n/a (co-locate API to its region) | Daily backups free tier; **PITR on Pro ($25/mo)** | $0 dev → $25/mo launch | Bundles Auth+Storage; Frankfurt closest to NG (~130ms user-side); one console                                   |
| Neon                      | co-locate in Frankfurt            | PITR included, branching is excellent for dev     | $0–19/mo               | Scale-to-zero cold starts unsuitable for financial DB defaults; great DX but a second vendor vs Supabase bundle |
| Cloud SQL (africa-south1) | ~1ms w/ Cloud Run Joburg          | Full PITR, HA option                              | ~$30–60/mo min viable  | Best NG latency; but then DB lives in GCP while Auth/Storage in Supabase = split anyway; more ops               |
| Railway/Render Postgres   | co-located                        | Basic backups; PITR limited/paid                  | $5–20/mo               | Weaker backup story than Supabase Pro for a financial system                                                    |

### 4.3 API + worker hosting

| Option        | NG latency                                      | Workers/cron                                           | Cost                            | Ops                                                                                        |
| ------------- | ----------------------------------------------- | ------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------ |
| **Cloud Run** | africa-south1 available; or co-locate Frankfurt | Cloud Run Job + Scheduler, or always-on worker service | ~$0–30/mo early (scale-to-zero) | Low ops, GCP-grade reliability                                                             |
| Railway       | EU/US only (~150ms)                             | Cron + background workers native                       | ~$5–20/mo                       | Simplest DX; Hobby plan lacks some guarantees                                              |
| Render        | EU/US (~150ms)                                  | Cron + workers native                                  | ~$7–25/mo                       | Similar to Railway; free tier sleeps (don't use)                                           |
| Fly.io        | jnb region (~40ms)                              | Machines for workers                                   | ~$10–20/mo                      | More DIY; historical reliability incidents; Postgres-on-Fly is NOT managed (reject for DB) |
| Vercel (API)  | edge → still hits distant DB                    | NO long-running workers                                | —                               | Rejected for API: cold starts + timeouts on financial endpoints                            |

### 4.4 Recommended production combination

```text
Database/Auth/Storage:  Supabase Pro — Frankfurt (eu-central-1)
API (NestJS):           Google Cloud Run — europe-west3 (Frankfurt, co-located w/ DB)
Worker:                 Cloud Run service (min-instances=1) running pg-boss
                        + Cloud Scheduler → maturity/outbox/reconciliation sweeps
                        (pg-boss = Postgres-native queue, SKIP LOCKED, no Redis needed)
Web (3 Next.js apps):   Vercel
Push:                   Expo Push (FCM credential = plumbing only)
Admin alerts:           Telegram Bot API (notification-only, non-blocking)
KYC:                    Smile Identity (behind KycProvider port)
```

**Why:** Supabase Frankfurt + Cloud Run Frankfurt keeps API↔DB at ~1ms. Supabase consolidates DB+Auth+Storage at $25/mo with PITR — the right backup story for money data. Cloud Run gives scale-to-zero API economics plus a proper always-on worker, GCP reliability, and a future path to `africa-south1` + Cloud SQL if Nigerian latency ever becomes the bottleneck (migration = env change + DB migration, no code change).

**Alternative if simplest-possible-ops preferred:** Railway (API+worker+Postgres all-in-one, EU) — acceptable but weaker backups/PITR story; only choose if Supabase console overhead becomes painful. I recommend the primary combo.

### 4.5 Cost projection

| Stage              | Supabase                     | Cloud Run (api+worker) | Vercel | Misc                   | Total/mo      |
| ------------------ | ---------------------------- | ---------------------- | ------ | ---------------------- | ------------- |
| Dev                | $0 (free)                    | ~$0–5                  | $0     | domain ~$1             | **~$5**       |
| Launch / ~1k users | $25 Pro                      | ~$15–40                | $0–20  | storage/bandwidth ~$10 | **~$50–95**   |
| ~10k users         | $25 + compute add-on ~$25–60 | ~$50–150               | $20    | ~$30                   | **~$150–285** |

Excluded: per-transaction provider fees (Paystack ~1.5%+₦100 capped ₦2k local; Korapay similar), Smile Identity per-verification fees, email provider (~$0–20/mo at this scale).

### 4.6 Limitations/risks of the recommendation

- Lagos→Frankfurt user latency ~130–180ms — acceptable, monitor; Joburg migration path exists if UX suffers.
- Supabase Pro required for PITR — $25/mo floor for launch.
- GCP setup (Cloud Run + Scheduler + secrets) is one-time infra work; document as runbook.
- FCM credential still needed for Android push (plumbing only — documented).
- Supabase Auth phone OTP needs a third-party SMS provider later — not a launch blocker (email auth).

## 5. Final architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ SURFACES (Vercel)                                            │
│   site (marketing) · web (investor) · admin (Next.js)        │
│ MOBILE: Expo + RN + TS (EAS Build)                           │
├──────────────────────────────────────────────────────────────┤
│ AUTH: Supabase Auth — JWT verified by API via JWKS           │
│   client↔Supabase for auth/session ONLY                      │
├──────────────────────────────────────────────────────────────┤
│ COMPUTE (Cloud Run, europe-west3)                            │
│   api    — NestJS modular monolith (REST+OpenAPI)            │
│   worker — pg-boss jobs: maturity, outbox, webhooks, recon   │
│   + Cloud Scheduler cron triggers                            │
├──────────────────────────────────────────────────────────────┤
│ DATA                                                         │
│   Supabase Postgres (Frankfurt) — SOLE financial authority   │
│   Supabase Storage — private KYC buckets + signed URLs       │
│   Public media — Supabase Storage public bucket or R2        │
├──────────────────────────────────────────────────────────────┤
│ PROVIDERS                                                    │
│   Paystack · Korapay (pay-in) · Smile Identity (KYC)         │
│   Expo Push (FCM/APNs) · Email (Resend/Postmark later)       │
│   Telegram Bot API (admin withdrawal alerts — non-blocking)  │
└──────────────────────────────────────────────────────────────┘
```

## 6. KYC — Smile Identity (CONFIRMED RB-063)

```text
KYC domain service → KycProvider interface → SmileIdentityAdapter
  Products: Biometric KYC (BVN/NIN_V2/vNIN/NIN slip), Document Verification,
            SmartSelfie liveness, AML check (upgrade path)
  Integration: REST + Node.js server lib; RN SDK for capture; webhook callbacks
  Environments: sandbox (free, test data) → production
  Data: provider refs stored in kyc_checks; images via signed URLs, never public
```

Fallback adapters (Youverify/VerifyMe) require only a new adapter + config — domain untouched.

## 7. V1 Firebase disposition (updated)

Firebase is **removed from the V2 architecture**. Remaining actions on the V1 project (planning only): read-only security inspection of live rules/config to confirm nothing risky is exposed; then decide whether to decommission or keep dormant. No reuse of Auth (Supabase Auth replaces it — V1 accounts were test-only, no real users to migrate). FCM service-account credential may be generated solely for Expo Push plumbing.
