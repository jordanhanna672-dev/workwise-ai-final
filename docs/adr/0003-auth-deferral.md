# ADR 0003: Defer real authentication in favor of a simulated single-user environment

## Status
Accepted, per the team's own revised Week 1-4 sprint backlog.

## Context
The AI-generated 8-week backlog originally called for full OAuth/JWT
authentication to be built in Week 2, in parallel with the core task API,
database, and dashboard. The team's own retrospective on that backlog
(documented in the pitch materials) identified this as one of three
unrealistic tasks for a three-person team in that timeframe, since full
auth would take meaningful development time away from the core AI
functionality that is the actual point of the project.

## Decision
Ship the alpha and final release with a simulated single-user environment:
there is no login screen, no session model, and no per-user data
isolation. Every task in the store belongs to the one implicit user.

## Consequences
- **Positive**: development time went toward the Smart Task Extractor,
  prioritization logic, and the human-review workflow — the features the
  project is actually being evaluated on — rather than auth plumbing.
- **Negative (documented security implication)**: this is genuinely not
  production-ready. There is no access control at all; anyone who can
  reach the server can read and modify every task. This is acceptable only
  because the app is run locally by one person at a time for
  demonstration purposes, and must not be exposed on a shared or public
  network in its current form.
- **Future work**: authentication is a **required milestone**, not an
  optional enhancement, before this system could handle real multi-user
  workplace data. The existing `src/db/` repository pattern would need a
  `user_id` column/field added to every task record, and every API route
  in `server.js` would need a session/token check inserted before it
  touches the data store.
