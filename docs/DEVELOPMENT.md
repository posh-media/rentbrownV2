# Local development

## Prerequisites

- Node.js ≥ 20 (repo built on 22.x)
- pnpm 9 (`npm i -g pnpm@9.15.9`)
- A Postgres 15+ instance for local development — Supabase local CLI
  (`supabase start`) or any Docker Postgres works. Docker was unavailable on
  the build machine; a hosted Supabase dev project is equally fine.
- No Firebase tooling needed.

## Environment

```bash
cp .env.example .env
```

Fill in for local dev:

| Var                         | Source                                        |
| --------------------------- | --------------------------------------------- |
| `SUPABASE_URL`              | Supabase project URL (dev project)            |
| `SUPABASE_ANON_KEY`         | project anon key                              |
| `SUPABASE_SERVICE_ROLE_KEY` | project service-role key — **server only**    |
| `SUPABASE_JWT_SECRET`       | optional HS256 fallback; JWKS is preferred    |
| `DATABASE_URL`              | Postgres connection string (pooler or direct) |
| `SCHEDULER_SECRET`          | any ≥32-char secret for sweep endpoint tests  |

Client apps read `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` vars — those are safe to
expose. Anything secret stays server-side only.

## Database

```bash
# generate SQL from the Drizzle schema (no DB needed)
pnpm --filter @rentbrown/database run generate

# apply migrations to DATABASE_URL
pnpm db:migrate
```

Schema lives in `packages/database/src/schema/index.ts`. Conventions:

- `uuid` PKs with `gen_random_uuid()`
- `timestamptz` everywhere; UTC
- money as `bigint` minor units (`*_minor` columns) — never numeric/float
- ROI in basis points (`roi_bps`, integer)
- enum types for all state machines
- `CHECK` constraints on non-negative balances / positive amounts
- unique indexes on `(user, scope, key)` idempotency triples

Migrations output to `packages/database/drizzle/` — commit them.

## Running

```bash
pnpm --filter @rentbrown/api dev       # API :3001 — /health, /health/ready, /docs
pnpm --filter @rentbrown/worker dev    # worker (needs DATABASE_URL reachable)
pnpm --filter @rentbrown/web dev       # web :3000
pnpm --filter @rentbrown/mobile start  # Expo
```

Verify the pipeline end-to-end without any UI:

```bash
curl localhost:3001/health
curl localhost:3001/health/ready                    # checks DB
curl -X POST localhost:3001/v1/jobs/sweep/ops.heartbeat \
  -H "x-scheduler-key: $SCHEDULER_SECRET"           # enqueues to pg-boss
# worker log shows "heartbeat processed"
```

## Auth flow

1. Client signs in via `supabase.auth` (anon key) → gets a Supabase JWT.
2. Client calls the API with `Authorization: Bearer <jwt>`.
3. API verifies via Supabase JWKS (`/auth/v1/.well-known/jwks.json`);
   `SUPABASE_JWT_SECRET` is a legacy HS256 fallback only.
4. `GET /v1/users/me` provisions the internal `users` row on first call
   (just-in-time provisioning keyed on `sub`).

## Admin roles

The `investor` role is assigned automatically at provisioning. To create the
first super_admin (or grant any role) run:

```bash
pnpm --filter @rentbrown/api grant-role -- <email> <role>
# roles: investor support kyc_reviewer ops_admin finance_admin super_admin
```

The grant writes a `rbac.role_assigned` audit event (`actorType: SYSTEM`,
`metadata.source: "cli"`). Alternatively set `BOOTSTRAP_SUPER_ADMIN_EMAILS`
to a comma-separated list — matching emails get `super_admin` on their first
authenticated request. `super_admin` grants via the API require the actor to
already hold `super_admin`.

Admin endpoints (`/v1/admin/*`) require Supabase MFA (`aal2`) while the
`admin.mfa_required` policy is true. `ADMIN_MFA_ENFORCE=false` disables the
check for local dev only — it is ignored when `APP_ENV=production`.

## Tests

```bash
pnpm test          # all unit tests (vitest)
pnpm --filter @rentbrown/domain test   # financial primitives only
```

DB-dependent tests (connectivity, migration execution, queue processing)
require a reachable `DATABASE_URL` and are exercised manually/CI-integration
rather than in unit suites.
