'use strict';
/**
 * Task search - a small, pure filtering layer over the task list, similar
 * in spirit to how Gmail lets you search your inbox by keyword. Kept
 * intentionally simple: a case-insensitive substring match against the
 * fields a person would actually remember about a task (its title, its
 * subtasks, and where it came from) - not a full-text search engine with
 * ranking/relevance scoring, which would be overkill for a single
 * person's task list at this project's scale.
 */

/**
 * @param {object} task - a task record (title, subtasks, source, etc.)
 * @param {string} query - the search term, already expected to be a
 *   non-empty string by the time this is called (see filterTasks)
 * @returns {boolean}
 */
function matchesQuery(task, query) {
  const needle = query.toLowerCase();

  if (task.title && task.title.toLowerCase().includes(needle)) return true;
  if (task.source && task.source.toLowerCase().includes(needle)) return true;
  if (Array.isArray(task.subtasks) && task.subtasks.some((s) => s.toLowerCase().includes(needle))) {
    return true;
  }
  return false;
}

/**
 * @param {Array<object>} tasks
 * @param {string|undefined|null} query - an empty/whitespace/missing
 *   query returns every task unchanged, matching how Gmail's search box
 *   shows your whole inbox when nothing is typed yet.
 * @returns {Array<object>}
 */
function filterTasks(tasks, query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return tasks;
  return tasks.filter((task) => matchesQuery(task, trimmed));
}

module.exports = { matchesQuery, filterTasks };
