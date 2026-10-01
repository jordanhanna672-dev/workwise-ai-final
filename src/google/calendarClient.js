'use strict';
/**
 * Google Calendar read-only client, split the same way as gmailClient.js:
 * a network-calling fetch function, and a pure, unit-tested parse
 * function.
 *
 * Design note: unlike email, a calendar event's deadline is not something
 * that needs to be *guessed* from free text - the API already gives an
 * exact start time. So parseCalendarEvents returns a `knownDeadlineIso`
 * alongside the free-text description, and src/google/index.js uses that
 * directly instead of running it through the heuristic/LLM date-guessing
 * logic. This sidesteps the entire "does the extractor recognize this
 * phrasing" problem for calendar-sourced items, since the ground truth is
 * already structured data.
 *
 * Non-task event types: Google Calendar auto-generates certain events
 * that are not real commitments - most commonly birthdays synced from
 * Google Contacts (Google's API tags these with eventType: "birthday",
 * a precise, documented field - see
 * https://developers.google.com/workspace/calendar/api/guides/event-types
 * - rather than something inferred from the event's text, which would be
 * guesswork). Passing one of these through the extractor, especially in
 * LLM mode, tends to produce an invented, not-actually-requested "task"
 * like "Send Birthday Wishes," since the model is prompted to extract an
 * actionable task and a birthday isn't one. These are filtered out before
 * they ever reach the extractor. Other synthetic types Google's API
 * defines the same way - "outOfOffice", "workingLocation", "focusTime" -
 * are personal status blocks with the identical problem, and can be
 * added to NON_TASK_EVENT_TYPES below the same way if they turn out to
 * cause similar noise.
 */
const NON_TASK_EVENT_TYPES = ['birthday'];

async function fetchUpcomingEvents(accessToken, maxResults = 10) {
  const timeMin = new Date().toISOString();
  const params = new URLSearchParams({
    timeMin,
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Calendar events.list failed (${res.status})`);
  const data = await res.json();
  return data.items || [];
}

/**
 * @param {Array} events - raw Calendar API event objects
 * @returns {Array<{raw_text: string, source: 'calendar', knownDeadlineIso: string|null}>}
 */
function parseCalendarEvents(events) {
  return events
    .filter((e) => e && e.summary)
    .filter((e) => !NON_TASK_EVENT_TYPES.includes(e.eventType))
    .map((e) => {
      const text = e.description ? `${e.summary}. ${e.description}` : e.summary;
      let knownDeadlineIso = null;
      if (e.start && e.start.dateTime) {
        knownDeadlineIso = new Date(e.start.dateTime).toISOString();
      } else if (e.start && e.start.date) {
        // All-day event: treat end-of-that-day (UTC) as the effective
        // deadline. The explicit "Z" suffix matters here - without it,
        // the Date constructor parses this as local time, meaning the
        // exact same calendar event would produce a different stored
        // instant depending on which timezone the server happens to be
        // running in. Appending "Z" makes this deterministic everywhere.
        knownDeadlineIso = new Date(`${e.start.date}T23:59:00Z`).toISOString();
      }
      return { raw_text: text, source: 'calendar', knownDeadlineIso };
    });
}

module.exports = { fetchUpcomingEvents, parseCalendarEvents, NON_TASK_EVENT_TYPES };
