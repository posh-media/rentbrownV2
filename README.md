# RentBrown V2

Property investment platform — rebuilt deliberately on a server-authoritative
foundation. Postgres is the sole financial source of truth; clients never
compute balances, ROI, capacity, or financial state.

## Repository layout

```
apps/
  mobile/    Expo + React Native + TypeScript (iOS/Android, EAS builds)
  web/       Next.js investor portal          → Vercel
  admin/     Next.js operations console       → Vercel
  site/      Next.js marketing site           → Vercel
  api/       NestJS modular monolith          → Cloud Run (europe-west3)
  worker/    pg-boss job processor            → Cloud Run (min-instances=1)

packages/
  domain/        pure TS financial primitives (money, ROI, duration, states)
  types/         wire-level DTO contracts shared with clients
  validation/    zod request schemas shared client ↔ server
  config/        typed env loading, validated at boot
  design-tokens/ Warm Institutional Fintech token system (light + dark maps)
  api-client/    typed fetch client (auth, idempotency, platform headers)
  providers/     provider port interfaces (payments, KYC, push, email, storage)
  database/      Drizzle schema, client, migration runner
```

## Quickstart

```bash
pnpm install          # requires Node ≥ 20, pnpm 9
pnpm build            # build all packages + apps (turbo)
pnpm test             # unit tests
pnpm typecheck        # typecheck every workspace
pnpm lint             # eslint
pnpm format:check     # prettier
```

Copy `.env.example` → `.env` (never commit real values), then:

```bash
pnpm --filter @rentbrown/api dev      # NestJS API on :3001
pnpm --filter @rentbrown/worker dev   # pg-boss worker
pnpm --filter @rentbrown/web dev      # investor web on :3000
pnpm --filter @rentbrown/admin dev    # admin on :3002
pnpm --filter @rentbrown/site dev     # marketing on :3003
pnpm --filter @rentbrown/mobile start # Expo dev server
```

See `docs/DEVELOPMENT.md` for database setup and migrations, and
`docs/DEPLOYMENT.md` for Supabase / Cloud Run / Vercel / Cloud Scheduler.

## Core rules

- **Client is never the financial authority.** All domain writes go through
  the API; Supabase is used for auth (and storage) only.
- **Money is integer minor units** (`bigint`), never floats.
- **Posted ledger entries are immutable** — corrections are reversals.
- **Every financial mutation is idempotent** (`idempotency-key` header).
- **No Firebase anywhere** in this codebase.
