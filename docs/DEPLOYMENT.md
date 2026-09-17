# Deployment

Three environments: **development** (local/preview), **staging**, **production**.
Secrets live in each platform's secret store — never in the repo.

## Supabase (Postgres + Auth + Storage)

- One project per environment (dev / staging / prod), region **eu-central**
  (Frankfurt) — co-located with Cloud Run.
- Pro tier for staging/prod (PITR backups).
- Apply migrations via CI: `pnpm db:migrate` with that env's `DATABASE_URL`
  injected from secrets.
- Storage buckets (created per env): `kyc-documents` (private, signed URLs),
  `media-public` (public). Bucket policies deny unauthenticated reads on
  private buckets; API signs URLs via the service role.
- Auth: enable email provider; JWTs verified by the API over JWKS — the API
  needs only `SUPABASE_URL` for that (plus optional `SUPABASE_JWT_SECRET`
  fallback).
- Auth security notes: admin endpoints require `aal2` (MFA) in production —
  enforced in the API and cannot be disabled by the `admin.mfa_required`
  policy there. Admin session time-boxing is configured in Supabase Auth
  settings (refresh/session lifetime); the API's
  `admin.session_max_age_seconds` check is defence-in-depth on token `iat`
  only, since Supabase re-issues access tokens on refresh.

## Cloud Run (API + worker) — europe-west3

Dockerfiles build from the **repo root**:

```bash
gcloud builds submit --tag eu-west3-docker.pkg.dev/PROJECT/rentbrown/api:SHA \
  -f apps/api/Dockerfile .
gcloud builds submit --tag eu-west3-docker.pkg.dev/PROJECT/rentbrown/worker:SHA \
  -f apps/worker/Dockerfile .
```

API service:

- `gcloud run deploy rentbrown-api --image ... --region europe-west3`
- env: `APP_ENV`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `CORS_ORIGINS`,
  `SCHEDULER_SECRET` — all via Secret Manager references.
- liveness → `/health`, readiness → `/health/ready` (checks DB).
- scale: default (0..N) is fine for the API.

Worker service:

- **min-instances = 1** — pg-boss polls Postgres; scale-to-zero would stall
  the queue.
- same env minus CORS. No ingress needed (or internal-only ingress).

## Cloud Scheduler → worker pipeline

Scheduler is a trigger only — it never carries financial logic.

```
Cloud Scheduler job
  POST https://API/v1/jobs/sweep/ops.heartbeat
  header: x-scheduler-key: $SCHEDULER_SECRET
→ API validates key, enqueues named pg-boss job
→ worker (always-on) claims and processes it
```

The API only allows whitelisted job names (`ops.heartbeat` in Phase 1 —
see `apps/api/src/modules/jobs/jobs.provider.ts`). Phase 2+ adds
`investments.maturity`, `outbox.process`, `reconciliation.*` to the same
whitelist + worker `JobRegistry`.

## Vercel (web / admin / site)

Three Vercel projects, each with **root directory** set to `apps/web`,
`apps/admin`, `apps/site`. Vercel auto-detects Next.js; workspace deps are
compiled via `transpilePackages` in each `next.config.ts`.

- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` per environment.
- Production branch `main`; PRs get preview deployments automatically.
- Monorepo note: install command stays `pnpm install` (Vercel detects pnpm
  from `pnpm-lock.yaml` at repo root).

## Mobile (EAS)

- `apps/mobile` builds via `eas build --platform android|ios`.
- `EXPO_PUBLIC_*` vars per EAS environment profile.
- `extra.eas.projectId` in `app.json` is a placeholder — replace with the
  real EAS project id at first build.

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR:

```
install (frozen lockfile) → format check → lint → build → typecheck → test
```

Deployment pipeline (to add when cloud creds exist): on `main` merge →
build images → push → `gcloud run deploy` → `pnpm db:migrate` for the
target env. Staging deploys auto from `main`; production behind a manual
approval gate.

## Secrets inventory

| Secret                            | Lives in                      | Used by         |
| --------------------------------- | ----------------------------- | --------------- |
| `DATABASE_URL`                    | GCP Secret Manager            | api, worker     |
| `SUPABASE_SERVICE_ROLE_KEY`       | GCP Secret Manager            | api only        |
| `SUPABASE_JWT_SECRET`             | GCP Secret Manager (optional) | api             |
| `SCHEDULER_SECRET`                | GCP Secret Manager            | api + Scheduler |
| Provider keys (Phase 2+)          | GCP Secret Manager            | api             |
| `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` | Vercel/EAS env                | clients (safe)  |

Rotation: all secrets rotate via their platform stores; nothing is
baked into images.
