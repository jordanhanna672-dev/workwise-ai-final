'use strict';
/**
 * Gmail read-only client. Split deliberately into:
 *   - buildGmailQuery(): a pure function that builds the Gmail search
 *     query string (fully unit tested - this is where a category-filter
 *     bug would actually show up)
 *   - fetchRecentMessages(): makes real network calls (can't be unit
 *     tested in an offline environment)
 *   - parseGmailMessages(): a pure function that turns Gmail API response
 *     shapes into this project's normalized {raw_text, source} items
 *     (fully unit tested in tests/google-parsing.test.js against
 *     hand-written mock API responses, since the parsing logic is the
 *     part actually worth testing here)
 *
 * Uses the snippet field (a short plain-text preview Gmail's API returns
 * for every message) rather than parsing the full MIME body. This is a
 * deliberate scope simplification: MIME multipart parsing (base64
 * sections, HTML vs. plain-text parts, attachments) is a meaningfully
 * larger effort for marginal benefit at this project's current scope. A
 * snippet is enough text for the Smart Task Extractor to work with, and
 * this limitation is documented rather than silently accepted - see
 * docs/adr/0004-google-integration.md.
 */

// Gmail's own inbox tabs, exposed as a search operator (category:X).
// "primary" is the sensible default for a task extractor - Promotions
// and Social rarely contain anything actionable, and including them by
// default would just feed the extractor noise.
const VALID_CATEGORIES = ['primary', 'promotions', 'social', 'updates', 'forums'];
const DEFAULT_CATEGORY = 'primary';

/**
 * @param {{category?: string, days?: number, searchTerm?: string}} options
 * @returns {string} a Gmail search query, e.g. "newer_than:7d category:primary invoice"
 */
function buildGmailQuery({ category = DEFAULT_CATEGORY, days = 7, searchTerm = '' } = {}) {
  const parts = [`newer_than:${days}d`];
  if (category && category !== 'all') {
    if (!VALID_CATEGORIES.includes(category)) {
      throw new Error(`Unknown Gmail category "${category}" - expected one of: ${VALID_CATEGORIES.join(', ')}, or "all"`);
    }
    parts.push(`category:${category}`);
  }
  const trimmedSearch = (searchTerm || '').trim();
  if (trimmedSearch) {
    // Appended as-is, exactly like typing into Gmail's own search bar -
    // Gmail's query language handles multi-word terms, quoted phrases,
    // and its other search operators (from:, has:attachment, etc.)
    // without this project needing to parse any of that itself.
    parts.push(trimmedSearch);
  }
  return parts.join(' ');
}

async function fetchRecentMessages(accessToken, { category = DEFAULT_CATEGORY, maxResults = 10, searchTerm = '' } = {}) {
  const query = buildGmailQuery({ category, searchTerm });
  const params = new URLSearchParams({ maxResults: String(maxResults), q: query });
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) throw new Error(`Gmail messages.list failed (${listRes.status})`);
  const listData = await listRes.json();
  const ids = (listData.messages || []).map((m) => m.id);

  const messages = [];
  for (const id of ids) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!msgRes.ok) continue; // skip a single unreadable message rather than failing the whole sync
    messages.push(await msgRes.json());
  }
  return messages;
}

/**
 * @param {Array} messages - raw Gmail API message objects (each with
 *   .snippet and .payload.headers)
 * @returns {Array<{raw_text: string, source: 'email'}>}
 */
function parseGmailMessages(messages) {
  return messages
    .filter((m) => m && m.snippet)
    .map((m) => {
      const headers = (m.payload && m.payload.headers) || [];
      const subject = headers.find((h) => h.name === 'Subject');
      const text = subject ? `${subject.value}: ${m.snippet}` : m.snippet;
      return { raw_text: text, source: 'email' };
    });
}

module.exports = { fetchRecentMessages, parseGmailMessages, buildGmailQuery, VALID_CATEGORIES };
