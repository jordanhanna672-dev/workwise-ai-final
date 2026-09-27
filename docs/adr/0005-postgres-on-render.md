# ADR 0005: Add a PostgreSQL backend, selected automatically, to survive Render's free-tier ephemeral filesystem

## Status
Accepted.

## Context
A one-click "Deploy your own instance" button (see the README's
deployment section and `render.yaml`) is the easiest way for a
non-technical user to get a fully-featured private instance of WorkWise
AI — no zip file, no terminal, no `npm install`. Render's free web
service tier makes this genuinely free.

Render's free tier has an ephemeral filesystem: any local file changes
are wiped whenever the service redeploys, restarts, **or spins down**
(which happens automatically after 15 minutes with no traffic). The
JSON file data store (ADR 0002) writes `data/tasks.json` to local disk —
on Render's free tier, this means **every task silently disappears the
first time the service goes idle for 15 minutes.** For a demo, that's a
minor annoyance; for someone actually adopting this as their task
manager (the stated goal of the one-click deploy button), it's a
first-week deal-breaker that would look like data loss or a bug.

This is the concrete, specific problem that motivated this ADR — not a
general "PostgreSQL is more scalable" argument, which still doesn't
meaningfully apply at this project's size (see ADR 0002).

## Decision
Add a second repository implementation, `src/db/postgres-store.js`,
implementing the exact same function interface as `src/db/json-store.js`
(`getAll`, `getById`, `insert`, `update`, `remove`, `resetForTests`).
`src/db/index.js` picks whichever one is live based on whether
`DATABASE_URL` is set — Render sets this automatically when a Postgres
database is attached in the same Blueprint (`render.yaml`), so a person
using the one-click deploy button never sees this decision at all; it
just works. Locally, with no `DATABASE_URL`, nothing changes — the
JSON-file path is exactly as it was.

The Postgres schema keeps `subtasks` and `extraction_reasoning` as
`JSONB` columns rather than fully normalizing them into child tables
with foreign keys (see the note in
[docs/architecture.md](../architecture.md#data-model--er-diagram) for
why) — this project has no query that needs to join into an individual
subtask or log line, so real child tables would add join complexity
without earning it yet.

The schema is created automatically on first use
(`CREATE TABLE IF NOT EXISTS`) rather than requiring a separate migration
step or tool — consistent with the whole point of a one-click deploy:
the person clicking the button never has to run SQL by hand.

`pg` (the PostgreSQL client library) is intentionally **not** added to
`package.json`'s `dependencies`. Doing so would mean `npm install` needs
network access even for someone who only ever wants the local,
zero-install JSON-file mode (see ADR 0001) — exactly the friction this
project has avoided from the start. Instead, `render.yaml`'s
`buildCommand` installs it explicitly (`npm install pg --no-save`) only
in the environment where it's actually needed. Locally, `pg` is only
required if `DATABASE_URL` happens to be set; `postgres-store.js` gives
a clear, actionable error rather than a cryptic "Cannot find module" if
it's set without `pg` installed.

## Consequences
- **Positive**: the one-click deploy button now produces something that
  behaves like a real, persistent personal tool, not a demo that quietly
  loses data — while genuinely free (Render's free Postgres tier).
  Nothing above the repository layer (`server.js`, the extractor, the
  prioritizer) needed to change, which is exactly what ADR 0002's
  original interface design was for.
- **Negative / honesty note on testing**: this module was written
  without access to a live PostgreSQL instance or an internet connection
  to install `pg` — this development environment has neither. It follows
  `pg`'s documented API carefully and mirrors the interface
  `json-store.js` already proves correct, but **it has not been run
  against a real database.** See "Testing this yourself" below before
  trusting it with real data.
- **Negative**: Render's free PostgreSQL tier expires 30 days after
  creation (with a 14-day grace period to upgrade before deletion) — a
  real constraint for genuinely long-term free use, distinct from the
  ephemeral-filesystem problem this ADR solves. This is a Render
  platform limit, not something this project's code can work around.
- **Negative**: two data store implementations now exist, which is more
  surface area to maintain than one. Kept manageable by the fact that
  both implement the identical five-function interface, so a bug fix to
  one's *behavior* (not its storage mechanics) usually implies checking
  the other too.

## Testing this yourself
Before relying on the Postgres backend for anything real, verify it
against an actual database — this takes about five minutes with Docker:

```
docker run --name workwise-test-pg -e POSTGRES_PASSWORD=test -p 5432:5432 -d postgres
npm install pg --no-save
DATABASE_URL=postgresql://postgres:test@localhost:5432/postgres npm start
```

Then use the app normally and confirm tasks survive a server restart
(`Ctrl+C`, run `npm start` again with the same `DATABASE_URL`) — that's
the exact scenario this ADR exists to fix.
