'use strict';
/**
 * Defenses against prompt injection in the Smart Task Extractor - built
 * in response to the team's Unit 6 Ethics & Security discussion, which
 * identified this as the highest-priority security threat (STRIDE:
 * Tampering). Raw message text pulled from email/chat is untrusted
 * input - anyone who can get a message in front of the extractor
 * (including a phishing sender) can attempt to embed instructions
 * aimed at the model rather than the human reader.
 *
 * This module is one layer in a defense-in-depth approach, not a
 * complete defense on its own:
 *   1. The system prompt explicitly tells the model the message is
 *      data to analyze, not instructions to follow (buildSystemPrompt
 *      in extractor.js).
 *   2. The message is wrapped in explicit delimiters in the user turn,
 *      reinforcing that separation structurally, not just by wording.
 *   3. This module's pattern-based detector flags common injection
 *      phrasing so a human reviewer sees a specific, named warning
 *      instead of the suggestion looking like any other.
 *   4. Structurally, even a fully successful injection can only ever
 *      change a *suggested* task's title/deadline/subtasks - the
 *      extractor has no ability to send messages, click links, or take
 *      any action, and nothing it produces is saved without explicit
 *      human approval (see server.js). This bounds the worst case even
 *      if layers 1-3 all fail, which is why "tampering" here is a
 *      trust/attention risk rather than a direct compromise risk.
 *
 * The pattern list below is deliberately not exhaustive - it targets
 * the common, well-documented jailbreak/injection phrasings, not every
 * possible phrasing of the same idea. Treat a "no signals found" result
 * as "nothing obvious," never as a guarantee of safety.
 */

const INJECTION_PATTERNS = [
  /ignore (?:all |the )?(?:previous|prior|above)\s+instructions?/i,
  /disregard (?:all |the )?(?:previous|prior|above)/i,
  /forget (?:your|all)(?: previous)? instructions?/i,
  /you are now\s/i,
  /new instructions?\s*:/i,
  /system prompt/i,
  /act as (?:a|an)\s/i,
  /\bDAN\b/, // "Do Anything Now" - a common, well-known jailbreak shorthand
  /this is (?:a|an) (?:urgent|important) system message/i,
  /\[?system\]?\s*:/i,
  /override (?:your|the) (?:instructions|programming|rules)/i,
  /reveal your (?:system )?prompt/i,
];

/**
 * @param {string} text - raw, untrusted message text
 * @returns {string[]} the exact matched phrases, empty if none found
 */
function detectInjectionSignals(text) {
  const matches = [];
  for (const pattern of INJECTION_PATTERNS) {
    const m = text.match(pattern);
    if (m) matches.push(m[0]);
  }
  return matches;
}

module.exports = { detectInjectionSignals, INJECTION_PATTERNS };
