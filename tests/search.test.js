'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { matchesQuery, filterTasks } = require('../src/search');

const tasks = [
  { id: 1, title: 'Send the Q3 report', subtasks: ['Send report', 'Send slides'], source: 'email' },
  { id: 2, title: 'Sprint planning', subtasks: ['Bring estimates'], source: 'calendar' },
  { id: 3, title: 'Review the vendor contract', subtasks: [], source: 'manual' },
];

test('matchesQuery matches on title, case-insensitively', () => {
  assert.equal(matchesQuery(tasks[0], 'q3'), true);
  assert.equal(matchesQuery(tasks[0], 'Q3'), true);
  assert.equal(matchesQuery(tasks[0], 'report'), true);
});

test('matchesQuery matches on a subtask', () => {
  assert.equal(matchesQuery(tasks[1], 'estimates'), true);
});

test('matchesQuery matches on source', () => {
  assert.equal(matchesQuery(tasks[1], 'calendar'), true);
});

test('matchesQuery returns false when nothing matches', () => {
  assert.equal(matchesQuery(tasks[2], 'birthday'), false);
});

test('matchesQuery handles a task with no subtasks without throwing', () => {
  assert.equal(matchesQuery(tasks[2], 'contract'), true);
});

test('filterTasks returns every task when the query is empty, missing, or whitespace', () => {
  assert.equal(filterTasks(tasks, '').length, 3);
  assert.equal(filterTasks(tasks, undefined).length, 3);
  assert.equal(filterTasks(tasks, '   ').length, 3);
});

test('filterTasks narrows the list to matching tasks only', () => {
  const result = filterTasks(tasks, 'report');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 1);
});

test('filterTasks returns an empty array when nothing matches', () => {
  assert.equal(filterTasks(tasks, 'nonexistent keyword').length, 0);
});
