'use strict';
/**
 * Prioritization algorithm.
 *
 * score = deadlineUrgency * 0.5 + sourceWeight * 0.2 + importance * 0.3
 * (each component normalized to a 0-100 scale before weighting)
 *
 * Every score comes with a `reasoningLog`: a short, human-readable list
 * of *why* the task landed where it did. This directly addresses the
 * "poor prioritization" risk from the pitch by making the ranking
 * inspectable, and it's what the "reasoning log" UI feature reads from.
 *
 * A task can be manually overridden (drag-to-reprioritize / manual
 * edit in the UI); once `manualOverride` is set we skip the algorithm
 * entirely and just log that a human decided the rank.
 */

const SOURCE_WEIGHTS = {
  calendar: 90, // a meeting/deadline on the calendar is usually hard and fixed
  email: 60,
  chat: 45,
  manual: 70, // the user typed it in themselves, so they clearly cared enough to
};

function deadlineUrgencyScore(deadlineIso, now = new Date()) {
  if (!deadlineIso) return { score: 20, hoursLeft: null }; // unknown deadline = low-ish, not zero
  const deadline = new Date(deadlineIso);
  const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursLeft <= 0) return { score: 100, hoursLeft }; // overdue or due now
  if (hoursLeft <= 24) return { score: 95, hoursLeft };
  if (hoursLeft <= 72) return { score: 80, hoursLeft };
  if (hoursLeft <= 24 * 7) return { score: 60, hoursLeft };
  if (hoursLeft <= 24 * 14) return { score: 40, hoursLeft };
  return { score: 20, hoursLeft };
}

function scoreTask(task, now = new Date()) {
  if (task.manualOverride != null) {
    return {
      priorityScore: task.manualOverride,
      reasoningLog: [`Manually set to priority ${task.manualOverride} by the user, overriding the algorithm.`],
    };
  }

  const { score: urgency, hoursLeft } = deadlineUrgencyScore(task.deadline, now);
  const sourceWeight = SOURCE_WEIGHTS[task.source] ?? 50;
  const importance = Math.min(Math.max(Number(task.importance) || 3, 1), 5) * 20; // 1-5 -> 20-100

  const priorityScore = Math.round(urgency * 0.5 + sourceWeight * 0.2 + importance * 0.3);

  const reasoningLog = [
    task.deadline
      ? `Deadline urgency: ${urgency}/100 (${describeHoursLeft(hoursLeft)}).`
      : `Deadline urgency: ${urgency}/100 (no deadline set, treated as low-but-not-lowest urgency).`,
    `Source weight: ${sourceWeight}/100 (source = "${task.source}").`,
    `User-set importance: ${importance}/100 (importance = ${task.importance ?? 3}/5).`,
    `Combined score = urgency*0.5 + source*0.2 + importance*0.3 = ${priorityScore}/100.`,
  ];

  return { priorityScore, reasoningLog };
}

function describeHoursLeft(hoursLeft) {
  if (hoursLeft === null) return 'no deadline';
  if (hoursLeft <= 0) return 'overdue';
  if (hoursLeft < 24) return `${Math.round(hoursLeft)}h left`;
  return `${Math.round(hoursLeft / 24)}d left`;
}

/** Re-score and sort a whole list, highest priority first. */
function rankTasks(tasks, now = new Date()) {
  return tasks
    .map((t) => {
      const { priorityScore, reasoningLog } = scoreTask(t, now);
      return Object.assign({}, t, { priorityScore, reasoningLog });
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

module.exports = { scoreTask, rankTasks, deadlineUrgencyScore, SOURCE_WEIGHTS };
