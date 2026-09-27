# Alpha Release: CI/CD Evidence & Technical Debt Inventory

Written in response to instructor feedback requesting: (1) direct
evidence of the working alpha release and CI/CD pipeline, with specific
automated tests, pipeline results, and end-to-end validation on the
reviewed modules, and (2) a clear split of technical debt into
mitigated vs. outstanding, with a milestone and an operational/
maintenance cost estimate for each outstanding item.

Every number below was captured by actually running the project on
2026-09-20, not reconstructed from memory or copied from an earlier
report — the exact commands are given so any of this can be reproduced
in under a minute. This document was first written on 2026-09-17 and
has been re-run and updated since, most recently to reflect the Unit 6
Ethics & Security response (see [ADR 0006](./adr/0006-ethics-and-security-response.md))
— the numbers below are current as of that update, not the original.

---

## Part 1: Evidence the pipeline actually works

### 1.1 Automated test suite

```
npm test
```

**Result: 64/64 tests passing, 0 failures, 585ms total.**

Full breakdown by file:

| Test file | Tests | What it actually verifies |
|---|---|---|
| `tests/db.test.js` | 4 | Encryption at rest: plaintext-by-default, transparent encrypt/decrypt with a key, wrong-key failure is loud (not silent), invalid key length is rejected clearly |
| `tests/extractor.test.js` | 19 | Deadline pattern-matching (weekdays, explicit dates, "end of month", negated/cancelled deadlines), subtask decomposition (bullets, inline numbered lists, non-Oxford-comma lists, hedge-fragment filtering), that the LLM path never overrides a deterministically-computed deadline and discards implausible (hallucinated) dates, and the prompt-injection defenses (hardened system prompt, confidence/injection-based review flagging) |
| `tests/google-parsing.test.js` | 14 | Gmail query construction (category filters, free-text search, Gmail operator passthrough), Gmail/Calendar API response parsing, and birthday-event exclusion via Google's own `eventType` field |
| `tests/google-sync-search.test.js` | 4 | Calendar-side search-term filtering (case-insensitivity, empty-term passthrough, no-match handling) |
| `tests/prioritize.test.js` | 4 | Priority scoring math (deadline urgency + source + importance), manual override bypassing the algorithm, correct sort order, non-empty reasoning log on every score |
| `tests/search.test.js` | 8 | Dashboard keyword search (title/subtask/source matching, empty-query passthrough, no-match handling) |
| `tests/security.test.js` | 5 | Prompt-injection pattern detection: catches known injection/jailbreak phrasing, does not false-positive on ordinary messages that merely share a word with a pattern |

Reproduce this exactly with `npm test` from a clean clone — no setup,
no environment variables, no external services required for any of
these 64 tests.

### 1.2 Code coverage

```
npm run test:coverage
```

**Result: 83.85% line coverage, 88.73% branch coverage, 84.05% function
coverage overall** — within (and slightly above) the 70-80% target from
the project brief.

Per-module breakdown (line %), from the actual run:

| Module | Line % | Note |
|---|---|---|
| `src/search.js` | 100.00 | Fully covered — pure function, no I/O |
| `src/security.js` | 100.00 | Fully covered — pure function, no I/O |
| `src/prioritize.js` | 100.00 | Fully covered — pure function, no I/O |
| `src/db/index.js` | 100.00 | Fully covered — the backend-selection logic itself |
| `src/db/json-store.js` | 81.32 | Core paths covered; uncovered lines are filesystem edge cases (corrupted file, missing directory) not worth mocking |
| `src/extractor.js` | 89.98 | Core paths covered, including the new negation/injection-flagging logic; uncovered lines are inside the live-OpenAI-call branch, which needs a real API key to exercise |
| `src/google/calendarClient.js` | 78.87 | Parsing logic fully tested; the network-calling function itself is not (see T-4 below) |
| `src/google/gmailClient.js` | 77.42 | Same pattern — parsing tested, network call not |
| `src/google/oauthClient.js` | 27.03 | Token exchange/refresh logic requires a live Google OAuth flow — see T-4 |
| `src/google/tokenStore.js` | 34.57 | Encrypted token storage logic is straightforward and mirrors the already-tested `db.test.js` patterns, but has no dedicated test file yet |
| `src/db/postgres-store.js` | **not listed — never loaded during this run** | See T-1 below; this is the most important honesty note in this whole document |

### 1.3 Domain-specific accuracy benchmark

```
npm run benchmark:accuracy
```

**Result** (full report regenerated at `docs/accuracy-baseline-report.md`):
- Tuning set (25 hand-labeled items): 100% deadline accuracy, 100%
  subtask accuracy
- **Held-out set (8 items never used to tune the extractor): 75%
  deadline accuracy, 100% subtask accuracy** — this is the number that
  actually matters; the tuning-set 100% mainly confirms known phrasing
  categories still work after code changes, not generalization
- Two specific, named failures on the held-out set, not a vague
  "sometimes wrong": the phrases "within 48 hours" and "close of
  business" aren't recognized by the heuristic date parser (see
  Technical Debt item T-5 below)
- **Third dataset added since this document was first written**:
  `docs/communication-style-accuracy-report.md` tests four phrasing
  styles (indirect/hedged, concise/direct, non-native-English patterns,
  passive/impersonal) — see the "Mitigated" table below (M-9) for what
  this found and fixed

### 1.4 Performance benchmark

```
npm run benchmark:performance
```

**Result** (full report at `docs/performance-benchmark-report.md`):
`GET /api/tasks` averaged 1.45ms (p95: 15.88ms); `POST /api/ingest`
(the AI extraction endpoint) averaged 0.66ms in heuristic mode (p95:
1.82ms). Both regenerated fresh, not reused from an earlier run.

### 1.5 End-to-end validation actually performed

This is the piece most likely to be missing from a typical submission:
proof that the *running application*, not just isolated unit tests,
behaves correctly. The following 12 checks were run against a live
instance of the server on 2026-09-20 (exact commands and raw output
available on request):

| # | Check | Result |
|---|---|---|
| 1 | Static frontend serves | `HTTP 200` |
| 2 | POST `/api/ingest` extracts a real task from raw text | Correct title, deadline, and 3 subtasks returned, `mode: heuristic`, `needsReview: false` |
| 3 | POST `/api/tasks` saves an approved suggestion | Task created with `id: 1`, `status: approved` |
| 4 | A second task is added for ranking comparison | Created successfully |
| 5 | GET `/api/tasks` ranks by priority score, highest first | `76/100` then `36/100`, correct order |
| 6 | GET `/api/tasks?q=vendor` filters correctly | Returned only the matching task |
| 7 | PUT `/api/tasks/:id` manual override applies | `manualOverride: 99` confirmed in the response |
| 8 | DELETE `/api/tasks/:id` removes a task | `{"deleted": true}` |
| 9 | Google integration degrades gracefully when unconfigured | `{"configured": false, "authorized": false, ...}` — no crash, no error |
| 10 | Invalid input is rejected cleanly | `400 {"error": "title is required"}` — not a 500, not a crash |
| 11 | **New**: a real prompt-injection attempt is flagged, not silently followed | `needsReview: true`, `flagReasons: ["possible_prompt_injection", "low_confidence"]` |
| 12 | **New**: a negated/cancelled deadline is correctly suppressed | "Never mind the Friday deadline, we no longer need it" → `deadline: null`, not the cancelled date |

This exercises every core API route, the extraction pipeline, the
prioritization algorithm, search, manual override, deletion, error
handling, and the security/ethics fixes from
[ADR 0006](./adr/0006-ethics-and-security-response.md) — end to end,
against the actual running server, not mocks.

### 1.6 What's evidenced here vs. what needs a GitHub push

Everything above was captured locally and can be reproduced by anyone
who clones the repo — that's real, durable evidence independent of any
hosting decision. What **cannot** be shown until this is pushed to
GitHub and the workflow actually runs there:
- A green checkmark on an actual GitHub Actions run
- The uploaded CI artifacts (`workwise-ai-staging-build`, coverage
  report, benchmark reports) as downloadable Actions artifacts
- The CI badge at the top of the README resolving to a real, current
  status

**Recommended before final submission:** push to GitHub (see
`GETTING_STARTED_GITHUB.md`), let `.github/workflows/ci.yml` run once,
then screenshot the green Actions run and attach it alongside this
document. That is the one piece of evidence that cannot be generated
any other way.

---

## Part 2: Technical debt — mitigated

Each item below names the original risk, what was actually done about
it, and where the evidence lives.

| ID | Risk / issue | Mitigation | Evidence |
|---|---|---|---|
| M-1 | AI extraction could silently save wrong/hallucinated tasks | Every suggestion requires explicit human approval before anything is written to storage; no code path bypasses this | UI flow (Inbox tab), `server.js` `/api/ingest` never writes to `db` |
| M-2 | Prioritization could feel arbitrary or like a black box | Deterministic, documented scoring formula (urgency × 0.5 + source × 0.2 + importance × 0.3) with a visible reasoning log on every task, plus manual override | `tests/prioritize.test.js` (4 tests), reasoning log in UI |
| M-3 | Task text (names, deadlines, workplace details) stored in plaintext | Optional AES-256-GCM encryption at rest, transparent to the rest of the app | `tests/db.test.js` (4 tests covering encrypt, decrypt, wrong-key failure, invalid-key rejection) |
| M-4 | **Real bug found during development**: LLM-mode deadline dates were sometimes hallucinated (wrong year) or arithmetically wrong ("next day" instead of "next Friday") | Deadline is always computed by this project's own deterministic date-math code; the LLM is only trusted for title/subtasks/confidence, never date arithmetic | `tests/extractor.test.js`: "llmExtract computes 'by Friday' deterministically... ignoring whatever date the model returns" and the implausible-past-date discard test |
| M-5 | **Real bug found during development**: DB test suite left `data/tasks.json` encrypted after tests ran, breaking any script run afterward without the same key | `test.afterEach` hook cleans up the data file and env var after every test in `db.test.js` | `tests/db.test.js` source, verified by running the full suite followed by `npm start` with no leftover errors |
| M-6 | Google Calendar birthday events were being extracted as fake tasks (e.g., "Send Birthday Wishes" invented by the LLM) | Filtered out using Google's own `eventType: "birthday"` field before reaching the extractor — precise, not a text-pattern guess | `tests/google-parsing.test.js`: 3 dedicated birthday-exclusion tests |
| M-7 | Render's free-tier ephemeral filesystem would silently wipe all tasks every ~15 minutes of inactivity | Automatic PostgreSQL backend, selected via `DATABASE_URL`, with zero change to local/offline behavior | `render.yaml`, `src/db/postgres-store.js`, [ADR 0005](./adr/0005-postgres-on-render.md) — **see T-1 below for the honest caveat on this one** |
| M-8 | Mobile header overflowed horizontally at narrow widths (< 400px) | Nav wraps to its own row below 560px via a CSS media query | Manually verified via Playwright screenshots at 320px and 390px widths, zero horizontal overflow confirmed — **not yet an automated test, see T-6** |
| M-9 | **Real bug found via testing, not assumed in advance**: communication-style bias (ACM Code of Ethics 1.4) — the extractor's clause-splitting was treating hedging language as fake subtasks specifically for indirect/hedged and non-native-English phrasing (44%/43% junk-subtask rates), while performing cleanly for direct/passive phrasing | `guessSubtasks` now filters hedge fragments via `isLikelyJunkSubtask`, shared between the extractor and the benchmark so both use one definition; junk rate confirmed at 0% post-fix | `docs/communication-style-accuracy-report.md` (before/after numbers), [ADR 0006](./adr/0006-ethics-and-security-response.md) |
| M-10 | Prompt injection (STRIDE: Tampering) — the team's own top-priority security finding; raw untrusted email/chat text reaches the LLM with no defense | Hardened system prompt (message content explicitly framed as data, never instructions), message delimiting, and pattern-based detection that flags suspicious content for mandatory human review rather than passing through silently | `tests/security.test.js` (5 tests), end-to-end check #11 above, [ADR 0006](./adr/0006-ethics-and-security-response.md) |
| M-11 | "Approval fatigue" — the team's own highest-priority red-team finding; a human-in-the-loop step only works if the human is actually looking, and every suggestion looked identical regardless of risk | Flagged suggestions (low confidence or injection signals) get a visually distinct warning banner; suggestion fields are now genuinely editable before approval (previously approve-as-is or reject only); an edit is recorded in the task's extraction reasoning | Manual Playwright verification of the visual distinction; [ADR 0006](./adr/0006-ethics-and-security-response.md) — **not yet covered by an automated visual-difference test, see T-9** |
| M-12 | Silent failure on negation (red-team critique's third point): "don't worry about the Friday deadline anymore" could be misread as an active deadline | `guessDeadline` now checks for negation cues in the same sentence as a matched deadline phrase and suppresses the match rather than reviving a cancelled deadline | `tests/extractor.test.js`: dedicated negation tests, end-to-end check #12 above |

---

## Part 3: Technical debt — outstanding

For each item: what it is, the expected milestone, and the concrete
operational/maintenance cost of leaving it unresolved.

### T-1: PostgreSQL backend has never run against a live database
**What:** `src/db/postgres-store.js` was written in a development
environment with no internet access and no PostgreSQL instance
available. It follows `pg`'s documented API and mirrors the already-
proven `json-store.js` interface, but has not been executed once
against a real database.
**Milestone:** Before the deploy button is used by anyone beyond the
team for real, ongoing task data — ideally this week, via the 5-minute
Docker test documented in [ADR 0005](./adr/0005-postgres-on-render.md).
**Cost if unresolved:** The one specific feature this was built to
enable (a persistent, one-click-deployed instance) could silently fail
or corrupt data the first time someone actually relies on it — the
worst possible failure mode for a feature whose entire pitch is
reliability. This is the single highest-priority item in this table.

### T-2: No authentication
**What:** The application has no login, no session model, and no per-
user data isolation (documented from the start in [ADR 0003](./adr/0003-auth-deferral.md)).
**Milestone:** Required before any shared or public multi-user
deployment; not required for the current one-click-deploy model, since
each person who clicks the button gets their own private instance.
**Cost if unresolved:** Zero access control on any instance that is
ever shared or exposed beyond one person — anyone who has the URL can
read, modify, or delete all tasks. Low risk today given the private-
instance-per-user deployment model; becomes a hard blocker the moment
multi-tenancy is considered.

### T-3: No CI-based integration test against a real Postgres instance
**What:** `postgres-store.js` is exercised only by manual local testing
(see T-1), not by an automated test in `.github/workflows/ci.yml`.
**Milestone:** Next development cycle — GitHub Actions supports Postgres
as a first-class service container, so this is a low-effort addition
(a `services:` block in the workflow YAML plus a handful of integration
tests using the existing `resetForTests` function).
**Cost if unresolved:** Every future change to `postgres-store.js` is
verified by manual testing only; a regression could ship and pass CI
green while silently breaking the deployed persistence story.

### T-4: Google integration's network-calling functions are untested
**What:** `fetchRecentMessages`, `fetchUpcomingEvents`, and the OAuth
token exchange/refresh functions in `src/google/` have no automated
test coverage (27-35% line coverage on those files) — only the pure
parsing/query-building logic around them is tested.
**Milestone:** No specific date — would need either a live Google test
account wired into CI (real credential management overhead) or a
mocking library, neither of which currently exists in this project.
**Cost if unresolved:** A regression in the actual network-calling code
(as opposed to the parsing logic) would not be caught by CI; would only
surface when a real user tries to sync and it fails.

### T-5: Two specific heuristic-mode deadline phrasings aren't recognized
**What:** The held-out accuracy benchmark (section 1.3) shows the
extractor's heuristic mode doesn't recognize "within 48 hours" or
"close of business" as deadline phrases.
**Milestone:** Low priority — next iteration of `src/extractor.js`'s
pattern list, or simply rely on LLM mode (which has no such gap, per
the same benchmark) for messages with unusual phrasing.
**Cost if unresolved:** A small, bounded set of real deadlines get
missed for users running heuristic mode (no OpenAI key) specifically.
Does not affect LLM-mode users at all.

### T-6: No automated visual/responsive regression testing
**What:** The mobile header overflow bug (M-8) was caught by manually
running Playwright and taking screenshots during development, not by
an assertion that runs automatically in CI.
**Milestone:** Could be added alongside T-3 — a lightweight Playwright
script asserting `document.documentElement.scrollWidth <=
document.documentElement.clientWidth` at a few standard viewport widths,
run as a CI step.
**Cost if unresolved:** Future CSS changes could reintroduce layout
bugs (overflow, broken stacking) that would only be caught by someone
manually checking a phone-width browser window before shipping.

### T-7: Application-level encryption, not database-native
**What:** Encryption at rest (`DATA_ENCRYPTION_KEY`, AES-256-GCM) is
implemented in application code rather than relying on the database's
own encryption-at-rest and TLS-in-transit features.
**Milestone:** Revisit once a real client/server network boundary and
authentication exist (tied to T-2) — at that point, database-native
encryption plus TLS is the more standard, less bespoke approach.
**Cost if unresolved:** Currently low — a single local user on their
own machine already has this protected. Would need addressing before
any claim of production-grade security.

### T-8: Render's free PostgreSQL database expires after 30 days
**What:** This is a hosting-platform constraint, not application code
debt: Render's free Postgres tier expires 30 days after creation, with
a 14-day grace period to upgrade before deletion.
**Milestone:** Ongoing/recurring — anyone using the free deploy path
long-term needs to either upgrade to a paid Postgres plan before the
~44-day mark or accept eventual data loss.
**Cost if unresolved:** Silent, complete data loss for any instance
left on the free database past the grace period. Documented clearly in
[docs/deploying-to-render.md](./deploying-to-render.md) so it isn't a
surprise, but the constraint itself cannot be fixed in code.

### T-9: The "needs review" visual treatment has no automated test
**What:** M-11's flagged-suggestion warning banner and border were
verified manually via Playwright screenshots during development, not by
an automated assertion that runs in CI — the same pattern as M-8/T-6.
**Milestone:** Could be addressed alongside T-6 as one combined
visual-regression effort, rather than two separate ones.
**Cost if unresolved:** A future CSS or markup change could silently
break the one visual signal the "approval fatigue" mitigation actually
depends on — the banner could stop rendering, or stop being visually
distinct, and nothing would catch it automatically.

### T-10: The injection pattern list and communication-style dataset are not validated against LLM mode
**What:** Both the prompt-injection detector and the communication-style
bias fix were built and tested against heuristic mode. LLM mode was not
separately re-tested against either — a language model might handle
hedging language differently (better or worse) than the heuristic
clause-splitter, and might be more or less susceptible to the injection
phrasings tested here.
**Milestone:** Before claiming either fix "covers" LLM mode — ideally
before the final release, using the existing datasets
(`data/communication-style-items.json`) with `OPENAI_API_KEY` set.
**Cost if unresolved:** A real gap in test coverage for the mode most
likely to be used for actual production-quality extraction — the
heuristic-mode fixes are proven, the LLM-mode behavior on the same
inputs is simply unknown, not verified-safe.

---

## Summary for the instructor

- **12 technical debt items have concrete mitigations with test evidence**
  (Part 2), including four real bugs found and fixed during development
  (M-4, M-5, M-9, and the extraction-reasoning display gap noted in
  [ADR 0006](./adr/0006-ethics-and-security-response.md)) — not just
  theoretical risks from the original pitch.
- **10 items remain outstanding** (Part 3), each with a named milestone
  and an honest cost assessment rather than a vague "future work" label.
- **T-1 is flagged as the highest priority**: it is the one place in
  this project where "should work" and "has been proven to work" are
  not the same claim, and it sits directly behind this release's
  headline new feature (the one-click persistent deploy).
- **M-9, M-10, M-11, and M-12 are the direct response to the team's
  Unit 6 Ethics & Security discussion** — all three issues raised there
  (prompt injection, communication-style bias, approval fatigue) now
  have working code and test evidence behind them, not just a written
  commitment. See [ADR 0006](./adr/0006-ethics-and-security-response.md)
  for the full mapping from that discussion's points to what was built.
- Sections 1.1-1.5 are fully reproducible by any grader with the repo
  and Node.js installed — no GitHub access, no live services, no
  credentials required.
