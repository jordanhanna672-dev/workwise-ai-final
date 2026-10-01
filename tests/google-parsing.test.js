'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseGmailMessages, buildGmailQuery } = require('../src/google/gmailClient');
const { parseCalendarEvents } = require('../src/google/calendarClient');

// These are hand-written mock objects shaped like real Gmail/Calendar API
// responses, based on the documented response schemas. This lets the
// parsing logic be tested without any network access - the actual
// fetchRecentMessages()/fetchUpcomingEvents() network calls are not
// covered by automated tests in this offline environment, but the part
// that turns API data into this project's own shape is.

test('parseGmailMessages extracts subject + snippet into raw_text with source "email"', () => {
  const mockMessages = [
    {
      id: '18c1a2b3',
      snippet: 'Can you send the Q3 report and slides by Friday? Also loop in Priya.',
      payload: {
        headers: [
          { name: 'Subject', value: 'Q3 report needed' },
          { name: 'From', value: 'manager@example.com' },
        ],
      },
    },
  ];
  const items = parseGmailMessages(mockMessages);
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'email');
  assert.match(items[0].raw_text, /Q3 report needed/);
  assert.match(items[0].raw_text, /send the Q3 report/);
});

test('parseGmailMessages falls back to snippet alone when there is no Subject header', () => {
  const mockMessages = [{ id: 'x', snippet: 'quick question about the invoice', payload: { headers: [] } }];
  const items = parseGmailMessages(mockMessages);
  assert.equal(items[0].raw_text, 'quick question about the invoice');
});

test('parseGmailMessages skips messages with no snippet rather than producing an empty item', () => {
  const mockMessages = [{ id: 'x', payload: { headers: [] } }, null];
  const items = parseGmailMessages(mockMessages);
  assert.equal(items.length, 0);
});

test('parseCalendarEvents uses the event start.dateTime as an exact known deadline', () => {
  const mockEvents = [
    {
      id: 'evt1',
      summary: 'Sprint planning',
      description: 'Bring your estimates.',
      start: { dateTime: '2026-09-21T09:00:00-04:00' },
      end: { dateTime: '2026-09-21T10:00:00-04:00' },
    },
  ];
  const items = parseCalendarEvents(mockEvents);
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'calendar');
  assert.match(items[0].raw_text, /Sprint planning/);
  assert.match(items[0].raw_text, /Bring your estimates/);
  assert.equal(items[0].knownDeadlineIso, new Date('2026-09-21T09:00:00-04:00').toISOString());
});

test('parseCalendarEvents treats an all-day event\'s date as end-of-day', () => {
  const mockEvents = [{ id: 'evt2', summary: 'Company holiday', start: { date: '2026-11-26' } }];
  const items = parseCalendarEvents(mockEvents);
  assert.equal(items[0].knownDeadlineIso, '2026-11-26T23:59:00.000Z');
});

test('parseCalendarEvents skips events with no summary', () => {
  const mockEvents = [{ id: 'evt3', start: { date: '2026-01-01' } }];
  const items = parseCalendarEvents(mockEvents);
  assert.equal(items.length, 0);
});

test('parseCalendarEvents excludes birthday events (Google\'s own eventType field), which are not real tasks', () => {
  const mockEvents = [
    {
      id: 'evt-bday',
      summary: "Jamie Smith's Birthday",
      eventType: 'birthday',
      start: { date: '2026-09-20' },
    },
  ];
  const items = parseCalendarEvents(mockEvents);
  assert.equal(items.length, 0);
});

test('parseCalendarEvents keeps normal events (default eventType, or eventType omitted)', () => {
  const mockEvents = [
    { id: 'evt-a', summary: 'Sprint planning', eventType: 'default', start: { date: '2026-09-20' } },
    { id: 'evt-b', summary: 'Client demo', start: { date: '2026-09-21' } }, // no eventType at all - real events predating the field
  ];
  const items = parseCalendarEvents(mockEvents);
  assert.equal(items.length, 2);
});

test('parseCalendarEvents excludes birthdays alongside a mix of real events, keeping only the real ones', () => {
  const mockEvents = [
    { id: 'evt-a', summary: 'Sprint planning', eventType: 'default', start: { date: '2026-09-20' } },
    { id: 'evt-bday', summary: "Jamie Smith's Birthday", eventType: 'birthday', start: { date: '2026-09-20' } },
  ];
  const items = parseCalendarEvents(mockEvents);
  assert.equal(items.length, 1);
  assert.match(items[0].raw_text, /Sprint planning/);
});

test('buildGmailQuery defaults to the Primary category', () => {
  assert.equal(buildGmailQuery(), 'newer_than:7d category:primary');
});

test('buildGmailQuery supports Promotions and Social categories', () => {
  assert.equal(buildGmailQuery({ category: 'promotions' }), 'newer_than:7d category:promotions');
  assert.equal(buildGmailQuery({ category: 'social' }), 'newer_than:7d category:social');
});

test('buildGmailQuery omits the category filter entirely when "all" is requested', () => {
  assert.equal(buildGmailQuery({ category: 'all' }), 'newer_than:7d');
});

test('buildGmailQuery respects a custom lookback window', () => {
  assert.equal(buildGmailQuery({ category: 'primary', days: 14 }), 'newer_than:14d category:primary');
});

test('buildGmailQuery rejects an unrecognized category rather than silently ignoring it', () => {
  assert.throws(() => buildGmailQuery({ category: 'spam' }), /Unknown Gmail category/);
});

test('buildGmailQuery appends a free-text search term, like typing into Gmail\'s own search bar', () => {
  assert.equal(buildGmailQuery({ category: 'primary', searchTerm: 'invoice' }), 'newer_than:7d category:primary invoice');
});

test('buildGmailQuery trims whitespace from the search term and omits it entirely when blank', () => {
  assert.equal(buildGmailQuery({ category: 'primary', searchTerm: '  ' }), 'newer_than:7d category:primary');
  assert.equal(buildGmailQuery({ category: 'primary', searchTerm: '  invoice  ' }), 'newer_than:7d category:primary invoice');
});

test('buildGmailQuery passes through Gmail\'s own search operators unmodified', () => {
  assert.equal(
    buildGmailQuery({ category: 'all', searchTerm: 'from:boss@example.com has:attachment' }),
    'newer_than:7d from:boss@example.com has:attachment'
  );
});
