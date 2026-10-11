# Managed website and backend deployment

The prepared target is Vercel Pro for the static game, Supabase Pro for accounts,
saves and social APIs, and a dedicated SMTP provider such as Resend. This file
describes the configuration and verification gates; it does not indicate that a
hosting account, subscription, domain or database migration has been created.

## Build configuration

Import this repository with Vercel's **Other** framework. `vercel.json` packages
the playable assets into `dist/` with `python3 scripts/build_site.py --require-cloud`.
The build fails before replacing its output when required settings are absent or
unsafe. The existing `npm run build` remains available for the current Pages and
Android distribution.

Configure these variables separately for production and preview/staging:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | That environment's Supabase HTTPS project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | That project's public publishable key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Alternative for projects using a legacy public anon key |
| `SHELFLIFE_PUBLIC_URL` | Canonical playable HTTPS URL; required for production |

Enable access to Vercel system environment variables. On preview builds, an
unset `SHELFLIFE_PUBLIC_URL` uses `https://` plus `VERCEL_URL`, so share instructions
point at that preview. `VERCEL_GIT_COMMIT_SHA` stamps the actual release revision
even when the build container has no Git directory. Public configuration changes
also change the PWA cache identifier, including for an unchanged commit.

Only the named public URL/key values are written into the browser configuration.
Never assign a service-role or secret key to a public variable. The Supabase
integration may supply server credentials too; those are not packaged. Public
keys are not an authorization boundary: the SQL permissions, RLS and authenticated
RPC checks enforce access.

## Environment isolation

Use a production project and a separate staging project or database branches.
Connect matching website previews and database branches using the official
Supabase/Vercel integration. Verify the actual generated configuration after each
preview build; do not let preview clients write to production. A branch recreated
after a deployment may require a new website deployment to refresh configuration.

Apply migrations `0001` through `0010` in order to staging first, including the
reviewed settlement, concurrency and privacy corrections. Run them twice to verify
repeatability and run real concurrent PostgreSQL checks in addition to the SQL
unit harness. Never run the concurrency harness against player data.

Configure Supabase Auth's site URL and allowed redirect URLs for the actual game
and protected staging previews. Configure SMTP on the server with a verified
sender domain, and test delivery, linking, recovery and deletion with staging
accounts. Supabase's default sender is limited to team addresses and is unsuitable
for public player accounts.

## Release gates

Require the repository's Game checks, PostgreSQL checks and Secret Scan before
production promotion. PostgreSQL checks run migrations and concurrent writes on
an isolated PostgreSQL 17 service; a unit run that skips them is insufficient.
Verify two authenticated players can complete every social flow in desktop
Chromium, mobile Chromium and mobile WebKit, including lost responses, retries,
account switches, duplicate submissions, concurrent writes and restored older
saves. Clearly distinguish fake-server browser checks from real staging evidence.

Enable daily backups and point-in-time recovery for production, and test restoring
to a disposable environment. Database backups do not include Storage object
contents; maintain a separate object backup policy if uploads are introduced.
Monitor errors with account IDs, email addresses and player content redacted.
Alert on unavailable game/backend, failed releases and failed scheduled jobs.

Before changing the public domain, verify signed-in players recover their existing
cloud save. Browser-local saves and anonymous sessions belong to the old origin;
provide a tested export/import or migration journey for those players. Keep the
old game reachable during the transition. Android uses the same intended backend,
but its packaged configuration and actual device behavior require verification.

After publishing, read `release.json` and verify the intended revision, fresh and
installed-PWA boot, update prompt, offline shell, save/reload and real social writes.
A website rollback does not roll back the database or instantly replace every
installed PWA. Keep migrations compatible with older clients and document any
recovery procedure before release.

## Local preparation checks

```sh
python3 test/deployment_build_test.py
node --test test/pages.test.mjs test/release.test.mjs test/backup.test.mjs
npm run build
```

Primary documentation: [Vercel build image](https://vercel.com/docs/builds/build-image),
[system variables](https://vercel.com/docs/environment-variables/system-environment-variables),
[deployment checks](https://vercel.com/docs/deployment-checks),
[Supabase preview integration](https://supabase.com/docs/guides/deployment/branching/integrations),
[SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[backups](https://supabase.com/docs/guides/platform/backups).
