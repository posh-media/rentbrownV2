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
- **`kyc-documents` must be created PRIVATE by hand** — the API never creates
  buckets or touches bucket policies at runtime: Dashboard → Storage → New
  bucket → name `kyc-documents` → uncheck "Public bucket". Do NOT add any
  public/anon read policy — access is only via short-lived (60s) signed URLs
  minted by the API with the service role key after an authorization check.
- Smile Identity (KYC): store `SMILE_IDENTITY_PARTNER_ID` and
  `SMILE_IDENTITY_API_KEY` in GCP Secret Manager per env, set
  `SMILE_IDENTITY_ENV=production` for prod, and set
  `SMILE_IDENTITY_CALLBACK_URL` to
  `https://<api-host>/v1/kyc/webhooks/smile-identity` — the same URL must be
  registered in the Smile Identity dashboard/partner config.
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
# one-shot (root cloudbuild.yaml builds + pushes both images):
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=SHORT_SHA=$(git rev-parse --short HEAD)

# or individually:
gcloud builds submit --tag europe-west3-docker.pkg.dev/PROJECT/rentbrown/api:SHA \
  -f apps/api/Dockerfile .
gcloud builds submit --tag europe-west3-docker.pkg.dev/PROJECT/rentbrown/worker:SHA \
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

## Vercel — three projects from one repo

Import `posh-media/rentbrownV2` **three times** in Vercel — one project per
Next app. Each app's `vercel.json` already pins the install/build commands;
Vercel runs them from the repo root for pnpm workspaces.

| Project         | Root directory | Package            | Port (dev) |
| --------------- | -------------- | ------------------ | ---------- |
| rentbrown-web   | `apps/web`     | `@rentbrown/web`   | 3000       |
| rentbrown-admin | `apps/admin`   | `@rentbrown/admin` | 3002       |
| rentbrown-site  | `apps/site`    | `@rentbrown/site`  | 3003       |

Per project:

- **Node version**: 22.x (set in project settings).
- **Environment variables** (per environment):
  `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` — **anon key only**, never the service
  role key.
- `vercel.json` sets `installCommand: pnpm install --frozen-lockfile`,
  `buildCommand: pnpm turbo run build --filter=<pkg>` and
  `ignoreCommand: npx turbo-ignore` so unchanged apps skip builds.
- Production branch `main`; PRs get preview deployments automatically.
- Workspace deps (`@rentbrown/ui`, `api-client`, `types`, …) are built by
  turbo before the app; Next consumes their `dist` output.
- No secrets in `vercel.json` or source — env vars come from Vercel's
  project settings.

**Auth follow-up:** web/admin use Supabase browser sessions (localStorage),
which are NOT visible to Next.js server rendering — route protection is
client-side `(app)`/`(console)` layouts only. A later phase should add
`@supabase/ssr` + Next middleware for server-side auth gating.

## Mobile (EAS)

- `apps/mobile` builds via `eas build --platform android|ios` using the
  `development` / `preview` / `production` profiles in `eas.json`; env vars
  per profile use `EXPO_PUBLIC_*` (`EXPO_PUBLIC_API_URL`,
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
- EAS project **created and linked**: `@devposh/rentbrown`
  (`extra.eas.projectId` in `app.json` is the real id —
  https://expo.dev/accounts/devposh/projects/rentbrown).
- Session persistence currently uses AsyncStorage (Supabase's official Expo
  guide). **Follow-up:** move the session to a chunked SecureStore adapter
  for hardening.

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
