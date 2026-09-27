# Deploying to Render (one-click, persistent, free)

This is the detailed version of README section 11. Read this if you want
to understand exactly what the "Deploy to Render" button does, what its
real limitations are, and how to add the optional features afterward.

## What clicking the button actually does

1. You'll be asked to sign in to (or create) a free Render account — no
   credit card required for the free tier.
2. Render reads `render.yaml` from this repo and shows you a preview:
   one **Web Service** (the app itself) and one **PostgreSQL database**,
   already wired together.
3. You confirm, and Render builds and deploys both. The build step runs
   `npm install && npm install pg --no-save` — the second command is
   what pulls in the PostgreSQL client library, kept out of this
   project's own `package.json` so local, offline, zero-install use
   (README section 4) is completely unaffected by this feature existing.
4. Within a couple of minutes, you get a live URL like
   `https://workwise-ai-xxxx.onrender.com` — open it, and the app works
   immediately, exactly like running it locally with no `.env` file.

No SQL to run by hand, no environment variables to configure just to get
started — the database table is created automatically the first time
the app touches it (see `src/db/postgres-store.js`).

## What you get for free, and its real limits

- **The web service** spins down after 15 minutes with no traffic, and
  takes 30-60 seconds to wake back up on the next request. Fine for
  personal use; if that wake-up delay bothers you, Render's cheapest
  paid tier removes it.
- **The database** is free for 30 days, then enters a 14-day grace
  period during which you can upgrade to keep it (and your data). After
  that, it's deleted. This is a genuine constraint if you want to keep
  using this for free indefinitely — there's no way around it on
  Render's free tier. Set yourself a reminder, or budget for Render's
  cheapest paid Postgres plan if this becomes your daily tool.

This is why the persistence problem this whole setup solves (ADR 0005)
and the "is this free forever" question are two separate things — the
button fixes the first (tasks no longer vanish every 15 minutes), not
the second (a free database has its own expiry, unrelated to spin-down).

## Adding the optional features afterward

None of these are required to use the app — each unlocks one specific
feature.

### Real AI extraction (instead of the built-in heuristic rules)
1. Get an OpenAI API key.
2. In Render's dashboard: your service → **Environment** → **Add
   Environment Variable** → key `OPENAI_API_KEY`, paste your key.
3. **Manual Deploy** → **Deploy latest commit** (or just wait for the
   next restart) to pick up the change.

### Gmail / Calendar sync
Follow [docs/google-integration.md](./google-integration.md) in full,
with one difference: your **Authorized redirect URI** in Google Cloud
Console is `https://<your-service-name>.onrender.com/oauth2callback`
(your actual Render URL), not `http://localhost:3000/oauth2callback`.
Then add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
`GOOGLE_REDIRECT_URI` (set to that same `https://.../oauth2callback` URL)
as environment variables the same way as above.

### Encryption at rest
Encryption at rest here protects the JSON-file backend specifically. On
Render, you're using the Postgres backend instead, so this specific
mechanism isn't the relevant protection — Render's managed Postgres has
its own encryption at rest and TLS in transit, handled by the platform
rather than this app. If you deploy the manual (non-Blueprint) path
without Postgres, `DATA_ENCRYPTION_KEY` still applies exactly as
documented in the main README.

## Testing the Postgres backend yourself before deploying

This is worth doing once, since the honesty note in
[ADR 0005](./adr/0005-postgres-on-render.md) is worth taking seriously:
the Postgres repository module was written without access to a live
database in the environment that built it. Verify it yourself in about
five minutes with Docker:

```
docker run --name workwise-test-pg -e POSTGRES_PASSWORD=test -p 5432:5432 -d postgres
npm install pg --no-save
DATABASE_URL=postgresql://postgres:test@localhost:5432/postgres npm start
```

Use the app normally, then stop the server (`Ctrl+C`) and start it again
with the same `DATABASE_URL` — your tasks should still be there. That's
the exact scenario this whole setup exists to fix.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| First request after a while is very slow | Normal free-tier spin-up (30-60s) — not an error |
| "relation \"tasks\" does not exist" or similar | The app couldn't reach the database on first boot — check `DATABASE_URL` is set (Render's Blueprint should do this automatically) |
| Tasks still disappearing | You may have deployed the manual path (README's "Manual deploy" section) without wiring up a database — that path uses the original JSON file, which Render's free tier will still wipe |
| Google OAuth "redirect URI mismatch" | The URI in Google Cloud Console must exactly match your Render URL, including `https://` and the `/oauth2callback` path |
| The database disappeared after ~6 weeks | The free 30-day expiry + 14-day grace period passed without upgrading — see "What you get for free" above |
