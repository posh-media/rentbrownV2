# RentBrown V2 — agent notes

## Commands

```bash
pnpm install                 # Node ≥20, pnpm 9.15.9
pnpm build                   # turbo: packages first, then apps
pnpm test                    # vitest across workspace (60 tests)
pnpm typecheck               # tsc --noEmit per package
pnpm lint                    # eslint (flat config at root)
pnpm format / format:check   # prettier
pnpm db:generate             # drizzle-kit generate → packages/database/drizzle/
pnpm db:migrate              # apply migrations to DATABASE_URL
```

Per-app dev: `pnpm --filter @rentbrown/{api,worker,web,admin,site,mobile} dev`
(api :3001, web :3000, admin :3002, site :3003).

## Conventions

- ESM everywhere — `module/moduleResolution: NodeNext`; relative imports in
  `apps/*` and `packages/*` source MUST use `.js` extensions.
- Packages compile to `dist/` ESM; apps consume built output (turbo orders
  `^build` before dependents).
- **NestJS DI caveat:** do NOT convert constructor-injected imports to
  `import type` — `emitDecoratorMetadata` needs the runtime binding. The
  `consistent-type-imports` lint rule is disabled for `apps/api`.
- **drizzle-kit caveat:** never use `.default(0n)` on bigint columns — the
  BigInt literal breaks kit's JSON snapshot. Use a raw SQL default instead.
- Money = `bigint` minor units; ROI = integer basis points; never floats.
- Client apps call Supabase for AUTH ONLY. All domain traffic → NestJS API.
- No Firebase dependencies, ever.
- Request validation = zod via `ZodValidationPipe` + shared schemas from
  `@rentbrown/validation` (no class-validator).

## Testing

- vitest unit tests per package (`src/**/*.test.ts`, `test/**/*.test.ts`).
- API smoke: boot `apps/api/dist/main.js` with env vars — `/health` works
  without DB; `/health/ready` reports DB state.
- Scheduler pipeline: `POST /v1/jobs/sweep/ops.heartbeat` with
  `x-scheduler-key` header.
