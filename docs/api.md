# API Documentation

Base URL (local dev): `http://localhost:3000`

All request and response bodies are JSON. There is no authentication (see
[ADR 0003](./adr/0003-auth-deferral.md)) — every endpoint acts on the one
shared task list.

---

## `GET /api/tasks`

Returns every non-rejected task, ranked by priority score (highest first).

**Query parameters**
- `q` (optional) — filters the list to tasks whose title, subtasks, or
  source contain this term (case-insensitive substring match), similar
  to a Gmail-style search box. Omit or leave empty to get every task.

**Response `200`**
```json
{
  "tasks": [
    {
      "id": 1,
      "title": "Send the Q3 report",
      "deadline": "2026-09-18T23:59:00.000Z",
      "subtasks": ["Send Q3 report", "Send updated slides", "Loop in Priya"],
      "source": "email",
      "importance": 3,
      "manualOverride": null,
      "status": "approved",
      "extractionReasoning": [],
      "createdAt": "2026-09-14T10:00:00.000Z",
      "priorityScore": 74,
      "reasoningLog": [
        "Deadline urgency: 80/100 (4d left).",
        "Source weight: 60/100 (source = \"email\").",
        "User-set importance: 60/100 (importance = 3/5).",
        "Combined score = urgency*0.5 + source*0.2 + importance*0.3 = 74/100."
      ]
    }
  ]
}
```

---

## `POST /api/ingest`

Runs the Smart Task Extractor on raw text. **Does not save anything** —
this is the AI-suggestion step; nothing persists until the suggestion is
separately POSTed to `/api/tasks`.

**Request body**
```json
{ "text": "Can you send the Q3 report by Friday?", "source": "email" }
```
- `text` (string, required)
- `source` (string, optional — one of `email`, `chat`, `calendar`; defaults to `email`)

**Response `200`**
```json
{
  "suggestion": {
    "title": "Can you send the Q3 report",
    "deadline": "2026-09-18T23:59:00.000Z",
    "subtasks": ["Can you send the Q3 report"],
    "source": "email",
    "confidence": 0.6,
    "mode": "heuristic",
    "reasoningLog": ["Pattern recognition: ...", "..."]
  }
}
```
`mode` is `"heuristic"` (no API key configured, or the LLM call failed and
fell back) or `"llm"` (a real OpenAI call succeeded). `confidence` is a
0–1 self-reported estimate, not a guarantee.

**Response `400`** — `{ "error": "text is required" }`

---

## `POST /api/tasks`

Approves a suggestion (or creates a task manually). This is the only way
a task is persisted.

**Request body**
```json
{
  "title": "Send the Q3 report",
  "deadline": "2026-09-18T23:59:00.000Z",
  "subtasks": ["Send Q3 report", "Send slides"],
  "source": "email",
  "importance": 3
}
```
- `title` (string, required)
- `deadline` (ISO 8601 string or `null`, optional)
- `subtasks` (string array, optional, defaults to `[]`)
- `source` (string, optional, defaults to `"manual"`)
- `importance` (integer 1–5, optional, defaults to `3`)
- `extractionReasoning` (string array, optional) — pass through the AI suggestion's `reasoningLog` when approving one, so it's preserved on the saved task for later reference

**Response `201`** — `{ "task": { ...full task record... } }`
**Response `400`** — `{ "error": "title is required" }`

---

## `PUT /api/tasks/:id`

Partially updates a task. Commonly used for `manualOverride` (an integer
0–100, or `null` to remove the override and let the algorithm re-score it).

**Request body** (any subset of task fields)
```json
{ "manualOverride": 95 }
```

**Response `200`** — `{ "task": { ...updated record... } }`
**Response `404`** — `{ "error": "task not found" }`

---

## `DELETE /api/tasks/:id`

**Response `200`** — `{ "deleted": true }`
**Response `404`** — `{ "error": "task not found" }`

---

## Error format

All errors are `{ "error": "<message>" }` with an appropriate 4xx/5xx
status. A `500` typically means the data store hit an unexpected
condition (e.g., an encrypted `data/tasks.json` with no matching
`DATA_ENCRYPTION_KEY` set — see [ADR 0002](./adr/0002-data-store.md)).

---

## Optional: Gmail/Calendar routes

These are only meaningful if `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
are set — see [docs/google-integration.md](./google-integration.md) for
setup. They return clear "not configured" responses otherwise, rather
than erroring.

### `GET /api/google/status`

**Response `200`** — `{ "configured": boolean, "authorized": boolean, "gmailCategories": ["primary", "promotions", "social", "updates", "forums"] }`

### `GET /auth/google`

Not a JSON endpoint — a `302` redirect to Google's OAuth consent screen.
Returns `503` (plain text) if not configured.

### `GET /oauth2callback`

Not a JSON endpoint — the OAuth redirect target. On success, `302`
redirects back to `/?google_connected=1`. Returns `400`/`500` (plain
text) on various failure cases (user denied consent, missing code,
token exchange failed).

### `GET /api/google/sync`

Pulls recent Gmail messages (last 7 days) and upcoming Calendar events,
runs each through the Smart Task Extractor, and returns suggestions —
**nothing is saved**, same as `/api/ingest`.

**Query parameters**
- `category` (optional) — filters Gmail by its own inbox tabs: `primary`
  (default), `promotions`, `social`, `updates`, `forums`, or `all` (no
  filter). Calendar events are always included regardless of this
  parameter — it only affects the Gmail portion of the sync.
- `q` (optional) — a free-text search term, just like typing into
  Gmail's own search bar. Applied server-side via Gmail's search API for
  the Gmail portion (so Gmail's own search operators work too — `from:`,
  `has:attachment`, quoted phrases, etc.), and as a simple
  case-insensitive substring match against event text for the Calendar
  portion, since Calendar's API has no equivalent free-text search to
  delegate to.

**Response `200`**
```json
{ "suggestions": [ { "title": "...", "deadline": "...", "subtasks": [...], "source": "email", "mode": "heuristic", "reasoningLog": [...] } ] }
```

**Response `400`** — `{ "error": "Unknown category \"spam\" - expected one of: primary, promotions, social, updates, forums, or \"all\"" }`

**Response `500`** — e.g. `{ "error": "Not connected yet - visit /auth/google to authorize." }`

