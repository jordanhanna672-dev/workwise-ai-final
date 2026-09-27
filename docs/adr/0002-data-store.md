# ADR 0002: JSON file data store (with optional encryption at rest), PostgreSQL added later as an alternative

## Status
Accepted (alpha and final release, as the default). Superseded in part by
[ADR 0005](./0005-postgres-on-render.md), which adds PostgreSQL as an
automatically-selected alternative backend rather than a replacement -
the JSON store described below remains the default for local/offline use.

## Context
The target stack specifies PostgreSQL. Setting up and configuring a
database server is itself a source of setup friction (see ADR 0001), and
for a project of this scope, the relational features PostgreSQL offers
(joins, transactions, concurrent write safety at scale) are not yet
exercised by the current feature set — the app has a single logical
"tasks" table with no other tables to join against.

## Decision
Use a single JSON file (`data/tasks.json`) as the data store, accessed only
through `src/db/json-store.js`, which exposes the same function signatures a real
repository layer would (`getAll`, `getById`, `insert`, `update`, `remove`).
The JSON record shape mirrors the relational schema documented in
[the ER diagram](../architecture.md#data-model--er-diagram), so the
migration path is "reimplement these five functions against `pg`," not "
redesign the data model."

As a security pass (addressing the "data privacy" risk named in the
original pitch), the store supports optional AES-256-GCM encryption at
rest via a `DATA_ENCRYPTION_KEY` environment variable, implemented with
Node's built-in `crypto` module — no additional dependency required.

## Consequences
- **Positive**: zero setup; the data file can be inspected directly during
  development and demos; encryption at rest is available without adding
  any new dependency or infrastructure.
- **Negative**: no real concurrent-write safety (two simultaneous writes
  from different requests are not guaranteed to be race-free — acceptable
  for a single-user prototype demoed by one person at a time, but a real
  blocker before any multi-user production use); no query language beyond
  what's hand-written in `json-store.js`; the whole file is read and
  rewritten on every write, which would not scale past a small number of
  tasks.
- **Update**: the PostgreSQL migration described as "future work" below
  has since happened — see [ADR 0005](./0005-postgres-on-render.md). It
  was triggered by a specific, concrete problem (Render's free-tier
  ephemeral filesystem silently wiping this JSON file), not by the
  general "PostgreSQL is more scalable" argument, which still doesn't
  meaningfully apply at this project's size. `json-store.js` remains the
  default for local, zero-install use; the two backends are selected
  automatically based on whether `DATABASE_URL` is set, and nothing
  above the repository layer needed to change to support this.
- **Future work (still open)**: encryption should move from
  application-level AES-256-GCM to database-native encryption at rest plus
  TLS in transit once a real client/server network boundary exists — this
  applies as much to the new Postgres backend as it did to the JSON file.

