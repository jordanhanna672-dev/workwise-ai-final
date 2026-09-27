# Setting up the Gmail/Calendar integration (optional)

This feature is entirely optional. Without it, WorkWise AI works exactly
as described in the main README — you paste messages into the Inbox tab
by hand. This guide is for connecting it to a real Gmail/Calendar account
so it can pull recent items automatically instead.

**Read-only, by design.** This integration only requests
`gmail.readonly` and `calendar.readonly` scopes — it cannot send email,
create events, or change anything in your account. See
[ADR 0004](./adr/0004-google-integration.md) for the full reasoning.

## 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com> and create a new project (or
   use an existing one).
2. Under **APIs & Services → Library**, enable:
   - **Gmail API**
   - **Google Calendar API**

## 2. Configure the OAuth consent screen

Google reorganized this part of the console in 2025-2026 — if you're
following an older guide (or the version of these instructions you
might have seen before), the navigation below is the current path, not
"APIs & Services → OAuth consent screen."

1. In the left sidebar, look for **Google Auth Platform** (this replaced
   the old standalone "OAuth consent screen" page). If it's not in the
   sidebar, go directly to:
   ```
   https://console.cloud.google.com/auth/scopes?project=YOUR_PROJECT_ID
   ```
2. Under **Audience**, choose **External** (unless you have a Google
   Workspace org, in which case **Internal** is fine).
3. Under the **Data Access** tab, click **Add or remove scopes** and add:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar.readonly`

   These are "sensitive" scopes, so Google will show an "unverified app"
   warning during consent later — expected and fine while the app is in
   Testing mode (next step); it only becomes a blocker if you try to
   publish this publicly.
4. Under **Audience → Test users**, add your own Google account email
   (and any teammates' accounts you want to test with). This keeps the
   app in "Testing" mode, which skips Google's full app-review process —
   fine for a class project, not for a public production launch.

## 3. Create OAuth credentials

Google currently exposes two navigation routes to this — use whichever
your console shows:

- **Newer path**: left sidebar → **Google Auth Platform → Clients** →
  **Create Client** (or go directly to
  `https://console.cloud.google.com/auth/clients/create?project=YOUR_PROJECT_ID`)
- **Older path**: **APIs & Services → Credentials → Create Credentials →
  OAuth client ID**

Either way:

1. Application type: **Web application**.
2. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:3000/oauth2callback
   ```
   (adjust the port if you run the app on a different one).
3. Click **Create**. Copy the **Client ID** and **Client Secret** shown —
   the secret is only displayed once.

## 4. Configure the app

Add these to your `.env` file (see `.env.example`):

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

Start the app with `npm run start:with-ai` (or any command that loads
`.env` — see the README's `--env-file` note).

## 5. Connect your account

1. Open the app and go to the **Inbox** tab.
2. Under "Or sync from Gmail / Calendar", click **Connect Google
   account**.
3. You'll be redirected to a real Google sign-in/consent screen. Review
   the requested permissions (read-only Gmail and Calendar access) and
   approve.
4. You'll be redirected back to the app, now showing "Connected."

## 6. Sync

Click **Sync recent items**. This pulls your last 7 days of email and
upcoming calendar events, runs each through the Smart Task Extractor, and
shows them as suggestion cards — exactly like pasting a message by hand.
**Nothing is saved automatically here either** — approve or reject each
one individually, same as the manual Inbox flow.

### Filtering by Gmail category

Once connected, a **Gmail category** dropdown appears before the sync
button, mapping to Gmail's own inbox tabs:

| Option | Gmail search operator used |
|---|---|
| Primary (default) | `category:primary` |
| Promotions | `category:promotions` |
| Social | `category:social` |
| Updates | `category:updates` |
| Forums | `category:forums` |
| All (no filter) | *(no category operator — everything from the last 7 days)* |

Primary is the default because it's where person-to-person email lands
in Gmail — the most likely source of real tasks. This only filters the
Gmail portion of the sync; calendar events are always included regardless
of which category is selected.

### Searching before you sync

Above the category dropdown, a search box lets you search Gmail directly
— functionally identical to typing into Gmail's own search bar, since
the term you type is passed straight through to Gmail's real search API
as-is. Press **Enter** or click **Sync recent items** to run it.

This means Gmail's own search operators work here too:

| Example | What it finds |
|---|---|
| `invoice` | Messages mentioning "invoice" anywhere |
| `from:jane@example.com` | Messages from a specific sender |
| `has:attachment` | Messages with an attachment |
| `"quarterly report"` | An exact phrase match |

The search term also applies to the Calendar portion of the sync, as a
simple case-insensitive substring match against each event's title and
description — Calendar's API has no equivalent rich search syntax, so
this half is intentionally simpler.

Leaving the search box empty behaves exactly like before — it pulls
everything from the selected category with no additional filtering.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Google integration is not configured" | `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` aren't set, or you started with `npm start` instead of an `.env`-loading script |
| Redirect URI mismatch error from Google | The redirect URI in your Google Cloud OAuth client must exactly match `http://localhost:<PORT>/oauth2callback`, including the port |
| "Not connected yet" after clicking Sync | The OAuth flow didn't complete — try **Connect Google account** again |
| Sync returns very few or no items | The app only looks at email from the last 7 days and calendar events from now onward — try sending yourself a test email or adding a calendar event |
| Email suggestions look thin on detail | This integration reads Gmail's short `snippet` preview, not the full message body — see [ADR 0004](./adr/0004-google-integration.md) for why, and what a fuller version would need |
| A birthday shows up as a task (e.g. "Send Birthday Wishes") | Should no longer happen — birthday events (`eventType: "birthday"`) are filtered out before reaching the extractor. If you still see this, it may be a manually-created calendar event that isn't tagged that way by Google's API; let us know the exact event title/summary if so |

## Revoking access later

You can revoke this app's access at any time from your Google Account's
[third-party access settings](https://myaccount.google.com/permissions),
or by deleting `data/google-token.json` locally (this only removes the
locally stored token; it doesn't revoke it on Google's side).
