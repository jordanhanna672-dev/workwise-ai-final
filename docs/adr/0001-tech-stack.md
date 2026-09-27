# ADR 0001: Alpha/final tech stack uses zero-dependency Node + vanilla JS instead of React/Express

## Status
Accepted (alpha), carried forward to final release.

## Context
The original pitch specified React (frontend), Node.js + Express (backend),
and PostgreSQL (database). During alpha development, this sandbox/CI
environment does not have reliable, on-demand network access to run
`npm install` for new packages. More importantly, requiring `npm install`
of a dozen-plus packages, a running PostgreSQL server, and a frontend build
step is a common source of "it doesn't run on my machine" failures for
teammates and graders who are not already set up with the exact toolchain.

## Decision
Build the alpha/final on:
- **Frontend**: plain HTML/CSS/JS served as static files, no bundler
- **Backend**: Node's built-in `http` module, no Express
- **Data store**: a JSON file with the same shape as the target relational
  schema (see ADR 0002)

The API surface (`/api/tasks`, `/api/ingest`, method verbs, JSON request/
response bodies) is designed exactly as it would be under Express, so that
migrating is additive rather than a rewrite.

## Consequences
- **Positive**: `npm start` runs the whole app with zero install steps;
  CI has no external package registry dependency for the app itself; the
  team can demo this to any grader on any machine with only Node installed.
- **Negative**: no JSX/component model, so the frontend is more verbose for
  larger UI surfaces than this project currently has; no Express
  middleware ecosystem (body parsing, routing helpers) — reimplemented by
  hand in `server.js` instead, which is fine at this route count but would
  not scale past a much larger API surface without revisiting this
  decision.
- **Future work**: if the team continues past this course project, the
  first candidate to reintroduce is Express (for routing/middleware
  ergonomics), followed by a frontend framework once the UI grows past
  what a single `app.js` file can hold cleanly.
