# Web Push deployment

Web Push is optional. No permission is requested until a player turns it on. The Android Capacitor app uses its existing local notifications and does not show this web setting. On iPhone and iPad, Safari requires the app to be added to the Home Screen first.

## Before deployment

Deploy the database migrations through `0012_push.sql` in order and run the SQL and browser checks. Use a secure directory outside the repository for the private files. Do not print the files or commit them.

```sh
mkdir -p "$HOME/.shelflife-push"
chmod 700 "$HOME/.shelflife-push"
node scripts/vapid_keys.mjs "$HOME/.shelflife-push/vapid-private.json"
```

Record the public key printed by the command. Preserve the private JWK: replacing the VAPID keys invalidates existing subscriptions. Use a `mailto:` contact or an HTTPS contact URL for `VAPID_SUBJECT`.

Create a private environment file, outside the repository, with `PUSH_SECRET` set to a long random secret, `VAPID_PRIVATE_JWK` set to the single-line JSON from the private JWK file, `VAPID_PUBLIC_KEY` set to the public key, and `VAPID_SUBJECT` set to the contact. Keep the file readable only by its owner. The same `PUSH_SECRET` must be stored in the database configuration below. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function.

## Supabase

Run this in the project SQL editor:

```sql
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
```

Deploy the function and secrets with the Supabase CLI:

```sh
supabase secrets set --env-file "$HOME/.shelflife-push/push.env" --project-ref wsddmmsddghqxymwsgwt
supabase functions deploy push --no-verify-jwt --project-ref wsddmmsddghqxymwsgwt
```

The function checks `x-push-secret` itself because the database invokes it without a user JWT. In the SQL editor, insert `url` and `secret` into `private.push_config`. The URL is `https://wsddmmsddghqxymwsgwt.supabase.co/functions/v1/push`; the secret must match `PUSH_SECRET`. Use the SQL editor's private session and do not put the value in source control. No player has access to this table.

```sql
insert into private.push_config(key, value) values
  ('url', 'https://wsddmmsddghqxymwsgwt.supabase.co/functions/v1/push'),
  ('secret', '<the same private PUSH_SECRET>')
on conflict (key) do update set value = excluded.value;
```

Create a named retry job after installing `pg_cron` and configuring the function URL and secret. The job calls a private function and never contains the secret. Reusing the name updates the existing job.

```sql
select cron.schedule('shelflife-push-retry', '* * * * *', 'select private.push_kick()');
```

New events wake the queue immediately. Failed deliveries wait five minutes before retry, and a lease expires after five minutes. Each invocation handles at most four queue rows and schedules another invocation for any ready backlog. The cron job wakes delayed retries even when no new events arrive. Responses 404 and 410 remove the affected subscription. Check the Cron job history after setup.

## Builds

Set `SHELFLIFE_VAPID_PUBLIC_KEY` to the public key in Vercel production environment variables and as the GitHub Actions repository variable of the same name for the Pages workflow. Rebuild and deploy both origins. The public key is intended to reach browsers; the JWK, push secret and service-role key are not.

## Verification

On an Android Chrome installation, open Friends and turn notifications on. Accept the browser permission prompt. Send that account a friend request from a second account and check that the notification opens the postbox. Repeat with Do not disturb enabled, after signing out, and after turning a notification group off. Check the function logs and Supabase security advisors. A browser simulator cannot prove delivery to a physical phone. If account exit happens while the browser cannot inspect its subscription, the device keeps a cleanup marker and retries on startup, reconnect, or account change. Generic postbox notifications can still arrive until the browser revokes that subscription; a new account cannot subscribe until cleanup succeeds.

Parlour prediction invitations and answered results use the Games notification group. Both are addressed only to the receiving friend; if either player blocks or removes the other, queued game notifications are discarded before delivery.
