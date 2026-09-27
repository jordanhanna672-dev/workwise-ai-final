# WorkWise AI

[![CI/CD](https://github.com/jordanhanna672-dev/YOUR-REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/jordanhanna672-dev/YOUR-REPO/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Coverage](https://img.shields.io/badge/coverage-84%25-brightgreen)

> Replace `YOUR-USERNAME/YOUR-REPO` in the badge URL above once this is
> pushed to GitHub, so the badge actually links to your repo's Actions tab.

An intelligent workplace assistant that consolidates tasks from emails,
messages, and calendars into a single, prioritized dashboard — with AI
suggesting deadlines and subtasks, and a human always approving before
anything is saved.

**This is the final (v1.0.0) release.** It builds on the alpha (end-to-end
proof of concept) with deeper testing, security hardening, performance
evidence, and full documentation — see [CHANGELOG.md](./CHANGELOG.md) for
exactly what changed.

## Team

| Name | Role |
|---|---|
| Jordan Hanna | Lead Architect |
| Ti'Asia Gause | Interface Designer |
| Cal Reed | Integration Lead |

See [docs/contribution-log.md](./docs/contribution-log.md) for individual contributions.

---

## Documentation index

| Doc | What's in it |
|---|---|
| This file | Install, run, test — start here |
| [docs/alpha-cicd-evidence-and-technical-debt.md](./docs/alpha-cicd-evidence-and-technical-debt.md) | Reproducible CI/CD evidence, end-to-end validation results, and the full technical debt inventory (mitigated + outstanding) |
| [docs/architecture.md](./docs/architecture.md) | System diagram, data flow, ER diagram, module responsibilities |
| [docs/adr/](./docs/adr/) | Architecture Decision Records — why the stack differs from the original pitch |
| [docs/api.md](./docs/api.md) | Full REST API reference |
| [docs/user-manual.md](./docs/user-manual.md) | How to use the app, with screenshots |
| [docs/google-integration.md](./docs/google-integration.md) | Optional: connecting real Gmail/Calendar accounts |
| [docs/deploying-to-render.md](./docs/deploying-to-render.md) | One-click persistent deployment — what it does, its real limits, testing the Postgres backend |
| [docs/communication-style-accuracy-report.md](./docs/communication-style-accuracy-report.md) | Bias testing across phrasing styles (ACM 1.4) — a real bug found and fixed, with before/after evidence |
| [docs/accuracy-baseline-report.md](./docs/accuracy-baseline-report.md) | AI extraction accuracy (tuning set + held-out set) |
| [docs/performance-benchmark-report.md](./docs/performance-benchmark-report.md) | API and AI-extraction latency |
| [docs/team-working-agreement.md](./docs/team-working-agreement.md) | Branching, review, and commit conventions |
| [docs/contribution-log.md](./docs/contribution-log.md) | Individual contribution log template (fill in for submission) |
| [GETTING_STARTED_GITHUB.md](./GETTING_STARTED_GITHUB.md) | Beginner-friendly steps to push this to GitHub |
| [CHANGELOG.md](./CHANGELOG.md) | What changed between alpha and final |

---

## 1. What you need before you start

- **Node.js**, version 18 or newer. That's it — no database to install, no
  React/Vite build tools, nothing else.
- If you don't have Node yet: go to <https://nodejs.org>, download the "LTS"
  installer for your operating system, and run it like any other app installer.

To check you have it, open a terminal (see step 2) and type:

```
node --version
```

If you see something like `v20.11.0` or `v22.x.x`, you're good.

---

## 2. Opening a terminal

- **Mac**: press `Cmd + Space`, type `Terminal`, press Enter.
- **Windows**: press the Start key, type `PowerShell`, press Enter.

Everything below is typed into that window, one line at a time, pressing
Enter after each line.

---

## 3. Get the project onto your computer

If you downloaded this as a `.zip` file:

1. Unzip it (double-click it on Mac/Windows).
2. In your terminal, `cd` into the unzipped folder. For example, if it's on
   your Desktop and named `workwise-ai`:

   ```
   cd ~/Desktop/workwise-ai
   ```

If you're getting it from GitHub instead:

```
git clone <the repository URL>
cd workwise-ai
```

---

## 4. Run it

There is no install step — this app has **zero external runtime
dependencies** on purpose, so there's nothing that can fail to download.
Just run:

```
npm start
```

You should see:

```
WorkWise AI running at http://localhost:3000
OPENAI_API_KEY not set - Smart Task Extractor is running in heuristic (no-API-key) mode.
Data store: encryption at rest is OFF (no DATA_ENCRYPTION_KEY set) - fine for local demos, not recommended once real workplace data is involved. See src/db/json-store.js for how to enable it.
```

Now open a web browser and go to:

```
http://localhost:3000
```

That's the app. To stop it later, click back in the terminal window and press
`Ctrl + C`. See [docs/user-manual.md](./docs/user-manual.md) for a full
walkthrough with screenshots.

### Try it out

1. On the **Inbox** tab, paste something like:

   > Hey, can you send the Q3 report and the updated slides by Friday? Also
   > loop in Priya on the budget numbers.

2. Click **Extract task with AI**. You'll see a suggested title, deadline,
   and subtasks, plus a "why" explanation.
3. Click **Approve & save** (or **Reject** if it looks wrong — nothing is
   ever saved automatically).
4. Click the **Prioritized Dashboard** tab to see it ranked alongside any
   other tasks, with a "Why is this ranked here?" explanation and a manual
   override box.

---

## 5. Running the automated tests

```
npm test
```

This uses Node's own built-in test runner (`node --test`) — no extra
install needed. You should see `# pass 64` and `# fail 0`.

For a coverage report (target: 70-80% on core modules — the project
currently runs at ~84% overall):

```
npm run test:coverage
```

To also run the lightweight style/syntax check used in CI:

```
npm run lint
```

---

## 6. (Optional) Turning on real AI extraction

By default the "Smart Task Extractor" uses built-in keyword and date-pattern
rules — no API key, no internet call, no cost, and it's what makes this app
runnable by anyone instantly. If you'd like it to use a real large language
model instead:

1. Copy `.env.example` to a new file named `.env`.
2. Put your OpenAI API key after `OPENAI_API_KEY=`.
3. Start the app with `npm run start:with-ai` instead of `npm start`.

If the API call ever fails (bad key, no internet, unexpected response), the
app automatically falls back to the built-in rules instead of crashing or
losing your message — you'll see that noted in the "why" explanation. Note
that even in `llm` mode, deadline arithmetic ("next Friday" → an actual
date) is always computed by this project's own tested code, never left to
the model — see the note in `src/extractor.js` for why.

---

## 7. (Optional) Turning on encryption at rest

Task text can include names, deadlines, and other workplace details, so
by default it's worth knowing this is stored as **plain JSON** on disk
unless you turn on encryption:

```
npm run generate-key
```

Copy the printed `DATA_ENCRYPTION_KEY=...` line into your `.env` file,
then start the app as usual. From then on, `data/tasks.json` is encrypted
with AES-256-GCM and unreadable without that same key. See
[ADR 0002](./docs/adr/0002-data-store.md) for the reasoning and
limitations.

---

## 8. (Optional) Connecting real Gmail / Calendar accounts

There's an optional Gmail/Calendar sync feature, built with read-only
scopes only and no SDK dependency (just Node's built-in `fetch`). It's
entirely off by default — see
[docs/google-integration.md](./docs/google-integration.md) for full setup
(Google Cloud project, OAuth consent screen, and connecting an account).

---

## 9. Measuring accuracy and performance

Two scripts back the metrics referenced in `docs/accuracy-baseline-report.md`
and `docs/performance-benchmark-report.md`:

```
npm run benchmark:accuracy       # scores extraction against labeled test data
npm run benchmark:performance    # measures API and AI-extraction latency
```

Both regenerate their respective report file in `docs/` — re-run them
after any change to `src/extractor.js` or `src/prioritize.js` and compare
against the committed baseline.

---

## 10. Why no Express / React / PostgreSQL?

The team's original target stack is React + Node/Express + PostgreSQL +
OpenAI. That's still a reasonable direction for continued work past this
course project. For this release specifically, the priority was: **anyone
on the team, or a grader, can run this in under a minute with zero setup
friction.** Full reasoning is in [the ADRs](./docs/adr/); the short version:

| Target stack | What's implemented | Swap-in path |
|---|---|---|
| React frontend | Plain HTML/CSS/JS in `public/` | Point a Vite/CRA app at the same `/api/*` endpoints |
| Node.js + Express backend | Node's built-in `http` module in `server.js` | Same routes, drop in Express for routing sugar |
| PostgreSQL database | Both: JSON file (`data/tasks.json`) by default, PostgreSQL automatically when `DATABASE_URL` is set | Already implemented — see `src/db/` and [ADR 0005](./docs/adr/0005-postgres-on-render.md) |
| OAuth/JWT auth | Simulated single-user environment | See [ADR 0003](./docs/adr/0003-auth-deferral.md) — required before any real deployment |
| OpenAI API | Optional — real OpenAI call if `OPENAI_API_KEY` is set, otherwise a rule-based fallback (`src/extractor.js`) | Already wired up; just add a key |
| Real Gmail/Calendar ingestion | Optional — `src/google/` (read-only OAuth2 via `fetch`, no SDK) if `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set | Already wired up; see [docs/google-integration.md](./docs/google-integration.md) |

Nothing about the API contract (`/api/tasks`, `/api/ingest`) changes when any
of these are swapped out, so the frontend and tests don't need to be
rewritten later.

---

## 11. Getting your own live, persistent instance (one click)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/jordanhanna672-dev/YOUR-REPO)

> Replace `YOUR-USERNAME/YOUR-REPO` above once this is pushed to GitHub,
> the same way the CI badge at the top of this file needs updating.

Clicking this button gives you a free, private, persistent instance of
WorkWise AI — no zip file, no terminal, no `npm install`. It uses the
`render.yaml` Blueprint in this repo, which also provisions a free
PostgreSQL database automatically, so your tasks survive Render's
free-tier restarts (a plain JSON file wouldn't — see
[ADR 0005](./docs/adr/0005-postgres-on-render.md) for why this matters
and what changed to support it).

**What works immediately, with zero configuration:** everything —
pasting messages, heuristic extraction, the prioritized dashboard,
search, manual priority overrides. This is the same zero-setup
experience as running it locally with no `.env` file.

**What needs a couple of extra minutes afterward, only if you want it:**
- **Real AI extraction**: add `OPENAI_API_KEY` in Render's dashboard
  (your service → Environment tab), then manually restart the service.
- **Gmail/Calendar sync**: follow
  [docs/google-integration.md](./docs/google-integration.md), using your
  Render URL (`https://<your-service-name>.onrender.com`) as the redirect
  URI, then add `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`
  the same way.
- **Encryption at rest**: run `node scripts/generate-encryption-key.js`
  locally once, then add the printed `DATA_ENCRYPTION_KEY` value in
  Render's dashboard.

These aren't included in the Blueprint itself on purpose — Render
prompts for a value for every secret declared there during setup, which
would turn "one click" into "one click, then fill out a form." See
[docs/deploying-to-render.md](./docs/deploying-to-render.md) for the
full picture, including the free tier's real limitations (cold starts,
the 30-day free-database expiry) and how to test the Postgres backend
yourself before trusting it with real data.

### Manual deploy (any host, without the Blueprint)

If you'd rather not use the button — a different host, or you want the
original JSON-file-only version without Postgres:

1. Create a free account on a Node-friendly host — [Render](https://render.com)
   and [Railway](https://railway.app) both have free tiers well-suited to
   a project this size.
2. Create a new **Web Service**, point it at this GitHub repo.
3. Build command: `npm install` (a no-op here without Postgres, since
   there are no required dependencies).
4. Start command: `npm start`.
5. Optionally set `OPENAI_API_KEY`, `DATA_ENCRYPTION_KEY`, and the
   `GOOGLE_*` variables as secrets in the host's dashboard.

Without `DATABASE_URL` set, this always uses the original JSON-file
store — fine for a quick demo, but see the ephemeral-filesystem warning
above if the host's free tier behaves like Render's.

---

## 12. Project structure

```
workwise-ai/
├── server.js                    # HTTP server + API routes
├── render.yaml                  # Render Blueprint - powers the one-click deploy button
├── src/
│   ├── db/                       # data store - JSON file or PostgreSQL, chosen automatically
│   │   ├── index.js               # picks a backend based on DATABASE_URL
│   │   ├── json-store.js          # zero-install default + optional encryption at rest
│   │   └── postgres-store.js      # used automatically when DATABASE_URL is set (e.g. on Render)
│   ├── extractor.js              # Smart Task Extractor (AI feature)
│   ├── search.js                 # keyword search/filter over tasks
│   ├── prioritize.js             # Prioritization algorithm + reasoning log
│   └── google/                   # optional Gmail/Calendar integration (read-only)
│       ├── oauthClient.js
│       ├── tokenStore.js
│       ├── gmailClient.js
│       ├── calendarClient.js
│       └── index.js
├── public/                      # Frontend (plain HTML/CSS/JS, no build step)
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── tests/                       # node:test unit tests (64 tests)
├── scripts/
│   ├── lint.js                   # zero-dependency syntax check used in CI
│   ├── accuracy-benchmark.js     # AI extraction accuracy report
│   ├── performance-benchmark.js  # API/AI latency report
│   └── generate-encryption-key.js
├── data/
│   ├── seed-mock-items.json      # 25-item mock dataset (Week 3 deliverable)
│   ├── holdout-items.json        # held-out validation set (never used to tune the extractor)
│   └── tasks.json                # created at runtime (JSON-store mode only), git-ignored
├── docs/
│   ├── architecture.md           # diagrams + module responsibilities
│   ├── api.md                    # REST API reference
│   ├── user-manual.md            # usage guide with screenshots
│   ├── google-integration.md     # optional Gmail/Calendar setup guide
│   ├── deploying-to-render.md    # one-click deploy - what it does, limits, testing Postgres
│   ├── accuracy-baseline-report.md
│   ├── performance-benchmark-report.md
│   ├── team-working-agreement.md
│   ├── contribution-log.md
│   ├── screenshots/
│   └── adr/                      # architecture decision records
├── .github/workflows/ci.yml     # lint -> test+coverage -> benchmarks -> boot check -> package build
├── .env.example
├── CHANGELOG.md
└── package.json
```

---

## 13. Putting this on GitHub

See **GETTING_STARTED_GITHUB.md** in this same folder for step-by-step
instructions, including how to create the `.github` folder on a Mac (Finder
hides dot-folders, but Terminal and Git handle them just fine).
