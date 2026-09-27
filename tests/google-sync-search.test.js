'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { filterItemsBySearchTerm } = require('../src/google/index');

const items = [
  { raw_text: 'Client demo prep. Bring the staging build.', source: 'calendar' },
  { raw_text: 'Sprint planning. Bring your estimates.', source: 'calendar' },
  { raw_text: 'Renew the SSL certificate before it expires.', source: 'email' },
];

test('filterItemsBySearchTerm matches case-insensitively against raw_text', () => {
  const result = filterItemsBySearchTerm(items, 'DEMO');
  assert.equal(result.length, 1);
  assert.match(result[0].raw_text, /Client demo prep/);
});

test('filterItemsBySearchTerm returns everything when the term is empty, missing, or whitespace', () => {
  assert.equal(filterItemsBySearchTerm(items, '').length, 3);
  assert.equal(filterItemsBySearchTerm(items, undefined).length, 3);
  assert.equal(filterItemsBySearchTerm(items, '   ').length, 3);
});

test('filterItemsBySearchTerm returns an empty array when nothing matches', () => {
  assert.equal(filterItemsBySearchTerm(items, 'nonexistent keyword').length, 0);
});

test('filterItemsBySearchTerm matches on a word appearing anywhere in the text, not just at the start', () => {
  const result = filterItemsBySearchTerm(items, 'estimates');
  assert.equal(result.length, 1);
  assert.match(result[0].raw_text, /Sprint planning/);
});
