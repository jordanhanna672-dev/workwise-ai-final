# Architecture

## System overview

WorkWise AI is a single deployable unit for the final release: one Node.js
process serves both the REST API and the static frontend. This is a
deliberate simplification from the target three-tier stack (see
[ADR 0001](./adr/0001-tech-stack.md)) chosen to keep the alpha/final
runnable with zero install steps; the module boundaries below are drawn so
that each piece can be swapped independently without touching the others.

```mermaid
flowchart TB
    subgraph Client["Browser (public/)"]
        UI["index.html + app.js\n(vanilla JS, no build step)"]
    end

    subgraph Server["server.js (Node http, zero dependencies)"]
        Router["Request router\n(GET/POST/PUT/DELETE /api/*)"]
        Static["Static file server\n(serves public/)"]
    end

    subgraph Core["Core modules (src/)"]
        Extractor["extractor.js\nSmart Task Extractor"]
        Prioritize["prioritize.js\nPrioritization algorithm"]
        DB["db.js\nData store (JSON + optional AES-256-GCM)"]
    end

    subgraph GoogleMod["src/google/ (optional)"]
        OAuth["oauthClient.js"]
        Gmail["gmailClient.js"]
        Calendar["calendarClient.js"]
    end

    subgraph External["External (optional)"]
        OpenAI["OpenAI API\n(gpt-4o-mini)"]
        GoogleAPI["Gmail / Calendar APIs\n(read-only scopes)"]
    end

    UI -- "fetch()" --> Router
    Router --> Static
    Router -- "POST /api/ingest" --> Extractor
    Router -- "POST/GET/PUT/DELETE /api/tasks" --> DB
    Router -- "/auth/google, /api/google/sync" --> GoogleMod
    Extractor -. "only if OPENAI_API_KEY set" .-> OpenAI
    Extractor -- "deadline math always\ncomputed locally" --> Prioritize
    GoogleMod -. "only if configured + authorized" .-> GoogleAPI
    GoogleMod -- "normalized items\nthrough the SAME extractor" --> Extractor
    DB --> Prioritize
    Router -- "ranked tasks" --> UI
```

## Human-in-the-loop data flow

This is the flow the pitch's risk analysis specifically asked for: nothing
from the AI extractor is ever persisted without a human approving it first.

```mermaid
sequenceDiagram
    actor User
    participant UI as Frontend (Inbox tab)
    participant API as server.js
    participant Extractor as Smart Task Extractor
    participant OpenAI as OpenAI API (optional)
    participant DB as Data store

    User->>UI: Paste raw message + choose source
    UI->>API: POST /api/ingest {text, source}
    API->>Extractor: extractTask(text, source)
    alt OPENAI_API_KEY set
        Extractor->>OpenAI: title/subtasks/confidence request
        OpenAI-->>Extractor: structured JSON (or error)
        Note over Extractor: deadline is computed locally,\nnever trusted to the model's arithmetic
    else no key set
        Note over Extractor: heuristic regex + date-math only
    end
    Extractor-->>API: suggestion (title, deadline, subtasks, reasoning log)
    API-->>UI: suggestion (NOT saved yet)
    UI-->>User: shows suggestion + reasoning log
    User->>UI: Approve
    UI->>API: POST /api/tasks {...suggestion}
    API->>DB: insert(task)
    DB-->>API: saved task
    API-->>UI: 201 Created
```

## Why this differs from the original target stack

| Target stack (original pitch) | What's implemented | Why |
|---|---|---|
| React frontend | Plain HTML/CSS/JS in `public/` | Zero build step; anyone can run it with `npm start` and no `npm install` of a frontend toolchain. See [ADR 0001](./adr/0001-tech-stack.md). |
| Node.js + Express | Node's built-in `http` module | Same route surface (`/api/tasks`, `/api/ingest`); Express can be dropped in later purely as routing sugar without changing the API contract. |
| PostgreSQL | Both: JSON file by default, or PostgreSQL automatically when `DATABASE_URL` is set | See [ADR 0002](./adr/0002-data-store.md), [ADR 0005](./adr/0005-postgres-on-render.md), and the [ER diagram](#data-model--er-diagram) below. |
| OAuth/JWT auth | Simulated single-user environment | Documented, deliberate scope cut from the team's own revised Week 1-4 backlog; see [ADR 0003](./adr/0003-auth-deferral.md). |

## Data model (ER diagram)

The JSON store's shape mirrors the relational schema it became: moving to
PostgreSQL was a matter of implementing `src/db/json-store.js`'s existing
function signatures (`getAll`, `getById`, `insert`, `update`, `remove`)
against SQL rather than a redesign — see `src/db/postgres-store.js` and
[ADR 0005](./adr/0005-postgres-on-render.md).

```mermaid
erDiagram
    TASK {
        int id PK
        string title
        string deadline "ISO 8601, nullable"
        string source "email | chat | calendar | manual"
        int importance "1-5, user-set"
        int manualOverride "nullable, 0-100"
        string status "approved | rejected"
        string createdAt "ISO 8601"
    }
    SUBTASK {
        int id PK
        int task_id FK
        string text
    }
    REASONING_LOG_ENTRY {
        int id PK
        int task_id FK
        string text
        string source "extraction | prioritization | override"
    }

    TASK ||--o{ SUBTASK : "has"
    TASK ||--o{ REASONING_LOG_ENTRY : "has"
```

In the current JSON store, `SUBTASK` and `REASONING_LOG_ENTRY` are embedded
arrays on the task object rather than separate rows — the natural
document-shaped equivalent of the same relationship. The actual PostgreSQL
implementation (`src/db/postgres-store.js`) keeps this same shape rather
than fully normalizing into separate tables: `subtasks` and
`extraction_reasoning` are `JSONB` columns, not foreign-keyed child
tables. This was a deliberate scope decision, not an oversight — at this
project's scale there's no query that needs to join against an individual
subtask or log line, so the added complexity of real child tables (and
the join logic every read would need) wouldn't earn its cost. Full
normalization into the diagram above is the natural next step if a
feature ever needs to query into that data directly (e.g., "find all
tasks with an overdue subtask").

## Module responsibilities

- **`server.js`** — HTTP routing only. No business logic lives here; it
  delegates to `src/*` and serves `public/`.
- **`src/extractor.js`** — turns raw text into a *suggested* task. Never
  writes to the data store directly.
- **`src/prioritize.js`** — pure functions: given a task, compute a score
  and a reasoning log. No I/O.
- **`src/db/`** — the only module that touches storage for task data.
  `src/db/index.js` picks JSON-file or PostgreSQL automatically based on
  `DATABASE_URL`; encryption at rest (JSON mode) is handled transparently
  inside `json-store.js`. Nothing above this layer needs to know which
  backend is active.
- **`src/search.js`** — pure, stateless task filtering by keyword
  (title/subtasks/source), used by `GET /api/tasks?q=...`. No I/O.
- **`src/google/`** — optional Gmail/Calendar integration (OAuth2 +
  read-only REST calls, no SDK dependency — see
  [ADR 0004](./adr/0004-google-integration.md)). Feeds normalized items
  into the same `extractTask()` pipeline as manually pasted text, so the
  human-approval rule applies identically either way. Fully inert if
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` aren't set.
- **`public/`** — no build step, no framework; talks to the backend only
  through `fetch()` calls to `/api/*`.
