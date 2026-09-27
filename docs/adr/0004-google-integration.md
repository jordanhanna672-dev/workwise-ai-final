# ADR 0004: Optional Gmail/Calendar integration via raw OAuth2 + fetch, not the googleapis SDK

## Status
Accepted.

## Context
The original pitch and Week 3 backlog called for real Gmail/Calendar API
integration, which the team's own retrospective deferred in favor of mock
data (see [ADR 0002](./0002-data-store.md)) due to the setup complexity of
OAuth and multiple APIs in a short timeframe. Once the core system was
solid, real integration became worth revisiting as an optional add-on
rather than a required path.

Google's official Node.js client is the `googleapis` npm package. Using
it would be the conventional choice, but it's a large dependency, and
this project has otherwise deliberately stayed at zero runtime
dependencies (see [ADR 0001](./0001-tech-stack.md)) so that `npm start`
never requires `npm install` to succeed first.

## Decision
Implement the OAuth2 authorization-code flow and the two API calls this
project actually needs (`gmail.readonly` message list/get, `calendar.readonly`
event list) directly against Google's REST endpoints using Node's built-in
`fetch`, rather than adding `googleapis` as a dependency. The whole
integration lives under `src/google/` and is entirely optional: if
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` aren't set, every route
degrades to a clear "not configured" response instead of erroring, and
the rest of the app is completely unaffected.

Scopes requested are read-only only (`gmail.readonly`, `calendar.readonly`)
— this integration cannot send email, create events, or modify anything
in the connected account, by design, not just by convention.

Gmail message bodies are read via the `snippet` field (a short plain-text
preview the API already provides) rather than parsing full MIME bodies.
Full MIME parsing (multipart, base64-encoded sections, HTML vs. plain
text) is meaningfully more code for marginal benefit at this project's
current scope — a snippet is enough text for the Smart Task Extractor to
work with, and this is a known, documented limitation rather than a
silent one.

Calendar events are handled differently from email on purpose: a
calendar event's start time is already exact, structured data from the
API, so it's used directly as the deadline rather than being re-guessed
from free text by the extractor's date-parsing heuristics. Only the
event's summary/description text goes through the extractor, for title
and subtask generation.

Calendar events whose `eventType` is `"birthday"` (a field Google's APIsets precisely for events synced from Google Contacts or the account's
own profile - see
[Google's event types guide](https://developers.google.com/workspace/calendar/api/guides/event-types))
are excluded before reaching the extractor entirely. Left in, these
produced a real, observed failure mode: since a birthday isn't
inherently actionable, LLM-mode extraction would invent a plausible-
sounding but unrequested "task" (e.g., "Send Birthday Wishes") rather
than recognizing there was no real task there. This is filtered using
Google's own structured field, not a text-pattern guess (e.g., checking
whether the word "birthday" appears in the summary), which is both more
precise and immune to false negatives from unusual phrasing. Other
synthetic, non-task event types Google's API defines the same way
(`outOfOffice`, `workingLocation`, `focusTime`) are documented as
candidates for the same treatment if they turn out to cause similar
noise, but are not excluded by default since they haven't been observed
to cause a problem yet.

## Consequences
- **Free-text search**: the Gmail portion of a sync accepts an optional
  search term, passed through verbatim to Gmail's own search API (`q=`)
  - meaning Gmail's real search operators (`from:`, `has:attachment`,
    quoted phrases) work without this project needing to parse or
    reimplement any of that syntax itself. The Calendar portion has no
    equivalent operator-rich search API to delegate to, so the same term
    is applied there as a plain case-insensitive substring match against
    each event's text - a deliberately simpler fallback, not an attempt
    to replicate Gmail's query language against Calendar data.
- **Positive**: zero new dependencies; the integration is fully optional
  and cannot break the app for anyone who doesn't configure it; scopes
  are minimal and read-only, limiting the blast radius of a leaked token;
  reusing the existing `extractTask()` pipeline means the human-approval
  UI flow applies identically to Gmail/Calendar-sourced suggestions as to
  pasted text, with no separate code path to audit for that rule.
- **Negative**: hand-rolled OAuth token refresh and pagination logic is
  more code to maintain than a well-tested SDK would provide, and doesn't
  cover the full Gmail/Calendar API surface (e.g., no support for shared
  calendars, labels, or threads) - acceptable for this project's scope,
  not a general-purpose Google API client.
- **Testing limitation**: the network-calling functions
  (`fetchRecentMessages`, `fetchUpcomingEvents`, the OAuth token exchange)
  are not covered by automated tests, since doing so would require either
  a live Google account or a mocking framework this project doesn't
  currently have. What *is* tested is the parsing logic that turns API
  responses into this project's normalized shape
  (`tests/google-parsing.test.js`), which is where a real bug (e.g.,
  missing null-checks, wrong date math) would actually show up.
- **Future work**: if usage grows, revisit `googleapis` for its handling
  of pagination, rate-limit backoff, and token refresh edge cases that
  this hand-rolled version doesn't yet handle.
