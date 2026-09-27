'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreTask, rankTasks } = require('../src/prioritize');

const NOW = new Date('2026-01-01T00:00:00Z');

test('an overdue calendar task scores higher than a distant chat task', () => {
  const overdue = { deadline: '2025-12-31T00:00:00Z', source: 'calendar', importance: 4 };
  const distant = { deadline: '2026-03-01T00:00:00Z', source: 'chat', importance: 2 };
  const a = scoreTask(overdue, NOW);
  const b = scoreTask(distant, NOW);
  assert.ok(a.priorityScore > b.priorityScore);
});

test('manual override skips the algorithm and is reflected in the reasoning log', () => {
  const task = { deadline: null, source: 'email', importance: 1, manualOverride: 99 };
  const { priorityScore, reasoningLog } = scoreTask(task, NOW);
  assert.equal(priorityScore, 99);
  assert.match(reasoningLog[0], /Manually set/);
});

test('rankTasks sorts highest priority first', () => {
  const tasks = [
    { id: 1, deadline: null, source: 'chat', importance: 1 },
    { id: 2, deadline: '2026-01-01T01:00:00Z', source: 'calendar', importance: 5 },
  ];
  const ranked = rankTasks(tasks, NOW);
  assert.equal(ranked[0].id, 2);
});

test('every scored task includes a non-empty reasoning log', () => {
  const { reasoningLog } = scoreTask({ deadline: null, source: 'email', importance: 3 }, NOW);
  assert.ok(reasoningLog.length > 0);
});
