'use strict';
/**
 * Orchestrates the Google integration: checks configuration/auth status,
 * builds the consent URL, handles the OAuth callback, and runs a sync
 * that pulls recent Gmail + Calendar items through the SAME Smart Task
 * Extractor pipeline already used for pasted messages - so the human
 * approval step in the Inbox tab applies here exactly the same way. No
 * new code path bypasses the "nothing saves without approval" rule.
 */
const oauthClient = require('./oauthClient');
const gmailClient = require('./gmailClient');
const calendarClient = require('./calendarClient');
const { extractTask } = require('../extractor');

function isConfigured() {
  return oauthClient.isConfigured();
}

function isAuthorized() {
  return oauthClient.isAuthorized();
}

function getAuthUrl(port) {
  return oauthClient.getAuthUrl(port);
}

function getGmailCategories() {
  return gmailClient.VALID_CATEGORIES;
}

async function handleOAuthCallback(code, port) {
  await oauthClient.exchangeCodeForTokens(code, port);
}

/**
 * Pulls recent Gmail + Calendar items and runs each through the Smart Task
 * Extractor, returning suggestions in the exact same shape /api/ingest
 * returns for a single pasted message - the frontend can reuse its
 * existing suggestion-card rendering for each one.
 *
 * @param {{category?: string, searchTerm?: string}} options - category
 *   filters Gmail by its own inbox tabs (primary/promotions/social/
 *   updates/forums, or "all"), defaulting to "primary" inside
 *   gmailClient (see that file for why). searchTerm is a free-text
 *   search, like typing into Gmail's own search bar: applied server-side
 *   via Gmail's search API for the Gmail portion (so it can use Gmail's
 *   full query syntax - from:, has:attachment, quoted phrases, etc.),
 *   and as a simple case-insensitive substring match against the event
 *   text for the Calendar portion, since the Calendar API has no
 *   equivalent free-text search operator to delegate to.
 */
async function syncAll(options = {}) {
  if (!isConfigured()) {
    throw new Error('Google integration is not configured (missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET).');
  }
  const accessToken = await oauthClient.getValidAccessToken();
  if (!accessToken) {
    throw new Error('Not connected yet - visit /auth/google to authorize.');
  }

  const searchTerm = (options.searchTerm || '').trim();

  const [rawMessages, rawEvents] = await Promise.all([
    gmailClient.fetchRecentMessages(accessToken, { category: options.category, searchTerm }),
    calendarClient.fetchUpcomingEvents(accessToken),
  ]);

  const emailItems = gmailClient.parseGmailMessages(rawMessages); // already filtered server-side by Gmail's own query
  const calendarItems = filterItemsBySearchTerm(calendarClient.parseCalendarEvents(rawEvents), searchTerm);

  const suggestions = [];

  for (const item of emailItems) {
    const suggestion = await extractTask(item.raw_text, item.source);
    suggestions.push(suggestion);
  }

  for (const item of calendarItems) {
    const suggestion = await extractTask(item.raw_text, item.source);
    if (item.knownDeadlineIso) {
      suggestion.deadline = item.knownDeadlineIso;
      suggestion.reasoningLog.unshift(
        'Deadline taken directly from the Calendar API event start time, not inferred from text - this is exact, not a guess.'
      );
    }
    suggestions.push(suggestion);
  }

  return suggestions;
}

/**
 * Pure, unit-tested: case-insensitive substring match against an item's
 * raw_text. An empty/missing term returns every item unchanged, matching
 * how leaving Gmail's own search box empty shows everything.
 */
function filterItemsBySearchTerm(items, searchTerm) {
  const trimmed = (searchTerm || '').trim();
  if (!trimmed) return items;
  const needle = trimmed.toLowerCase();
  return items.filter((item) => item.raw_text.toLowerCase().includes(needle));
}

module.exports = {
  isConfigured,
  isAuthorized,
  getAuthUrl,
  getGmailCategories,
  handleOAuthCallback,
  syncAll,
  filterItemsBySearchTerm,
};
