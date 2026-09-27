'use strict';
// WorkWise AI - frontend.
//
// Team:
//   Jordan Hanna   - Lead Architect
//   Ti'Asia Gause  - Interface Designer
//   Cal Reed       - Integration Lead
//
// This file is the entire front-end "brain" of WorkWise AI. There's no
// build step and no framework here on purpose (see docs/adr/0001) - it's
// plain JavaScript that runs directly in the browser. It talks to the
// backend (server.js) purely through fetch() calls to the /api/* routes
// documented in docs/api.md, and it updates the page by directly
// creating/editing HTML elements (no React, no virtual DOM).
//
// Roughly, this file has four sections, in the order they appear below:
//   1. Tab switching (Inbox / Prioritized Dashboard / About)
//   2. The "Inbox" flow: paste a message -> get an AI suggestion -> approve or reject it
//   3. The "Prioritized Dashboard" flow: load, search, and manage saved tasks
//   4. The optional Gmail/Calendar sync flow

// --- 1. Tab switching ---
// The page has three tabs (see index.html): Inbox, Prioritized Dashboard,
// and About. Only one is visible at a time. Clicking a tab button just
// swaps which button/section has the "active" CSS class - the class
// itself is what actually shows/hides content (see styles.css).
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    // Refresh the task list every time someone switches to the dashboard,
    // so it always shows the latest data instead of a stale snapshot.
    if (btn.dataset.tab === 'dashboard') loadTasks();
  });
});

// --- 2. Ingest / extraction flow (the "Inbox" tab) ---
// This is the form where someone pastes in a raw email/chat/calendar
// message and clicks "Extract task with AI".
const ingestForm = document.getElementById('ingest-form');
const suggestionArea = document.getElementById('suggestion-area');

ingestForm.addEventListener('submit', async (e) => {
  e.preventDefault(); // stop the browser from doing a full page reload on submit
  const text = document.getElementById('ingest-text').value;
  const source = document.getElementById('ingest-source').value;
  if (!text.trim()) return; // ignore empty submissions

  suggestionArea.innerHTML = '<p class="hint">Extracting…</p>';
  try {
    // Send the raw text to the backend's Smart Task Extractor
    // (src/extractor.js) and wait for its suggested title/deadline/subtasks.
    const res = await fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'extraction failed');
    suggestionArea.innerHTML = '';
    // Nothing is saved yet at this point - renderSuggestion() just shows
    // the AI's suggestion and waits for a human to approve or reject it.
    renderSuggestion(data.suggestion, suggestionArea);
    document.getElementById('ingest-text').value = '';
  } catch (err) {
    suggestionArea.innerHTML = `<p class="hint">Something went wrong: ${escapeHtml(err.message)}</p>`;
  }
});

// Plain-language explanations shown to the user when a suggestion is
// flagged as needing a closer look (see src/extractor.js's `flagReasons`).
const FLAG_LABELS = {
  possible_prompt_injection:
    'This message contains phrasing that looks like an attempt to instruct the AI directly (e.g. "ignore previous instructions"). The AI did not follow it, but please read the original context carefully before approving.',
  low_confidence: "The AI wasn't very confident about this one — double-check the details below before approving.",
};

// The backend stores/returns deadlines as ISO date strings (e.g.
// "2026-09-18T23:59:00.000Z"), but the browser's <input type="datetime-local">
// field needs a different, timezone-less format ("2026-09-18T23:59") in
// the visitor's own local time. These two functions convert between the
// two formats so editing a deadline in the UI "just works."
function isoToDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d) ? null : d.toISOString();
}

// Builds the HTML card for one AI suggestion and wires up its buttons.
// Used both by the Inbox tab (one suggestion at a time) and the Gmail/
// Calendar sync feature (many suggestions at once) - see `container`
// below, which is just "where in the page should this card be added."
function renderSuggestion(suggestion, container) {
  const div = document.createElement('div');
  // Suggestions the extractor flagged as risky/low-confidence get an
  // extra CSS class that makes them visually stand out (a red border and
  // warning banner - see styles.css) so a reviewer is more likely to
  // actually notice and double-check them instead of rubber-stamping
  // every suggestion the same way ("approval fatigue" - see ADR 0006).
  div.className = 'task-card suggestion-card' + (suggestion.needsReview ? ' needs-review' : '');

  const reviewBanner = suggestion.needsReview
    ? `<div class="review-banner"><strong>⚠ Needs a closer look before you approve it</strong>
        <ul>${suggestion.flagReasons.map((r) => `<li>${escapeHtml(FLAG_LABELS[r] || r)}</li>`).join('')}</ul>
      </div>`
    : '';

  // Build the card's HTML. Note that title/deadline/subtasks are shown
  // as *editable* form fields (an <input>, another <input>, and a
  // <textarea>), not plain read-only text - a person reviewing the
  // suggestion can correct the AI's guess before approving it, rather
  // than only being able to accept it as-is or throw it away entirely.
  div.innerHTML = `
    ${reviewBanner}
    <header>
      <input type="text" class="task-title-input" value="${escapeHtml(suggestion.title)}" aria-label="Task title" />
      <span class="confidence">confidence: ${(suggestion.confidence * 100).toFixed(0)}% · mode: ${suggestion.mode}</span>
    </header>
    <label class="field-label">Deadline (leave blank for none)
      <input type="datetime-local" class="task-deadline-input" value="${isoToDatetimeLocal(suggestion.deadline)}" />
    </label>
    <label class="field-label">Subtasks (one per line)
      <textarea class="task-subtasks-input" rows="3">${escapeHtml(suggestion.subtasks.join('\n'))}</textarea>
    </label>
    <p class="task-meta">Source: ${suggestion.source}</p>
    <details class="task-reasoning" open>
      <summary>AI reasoning</summary>
      <ul>${suggestion.reasoningLog.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
    </details>
    <div class="task-actions">
      <button class="approve-btn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>Approve & save</button>
      <button class="secondary reject-btn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>Reject</button>
    </div>
  `;

  // "Approve & save" - read whatever is CURRENTLY in the input fields
  // (which may have been hand-edited since the suggestion first
  // appeared), figure out whether anything was actually changed, and
  // send the final version to the backend to be saved as a real task.
  div.querySelector('.approve-btn').addEventListener('click', async () => {
    const editedTitle = div.querySelector('.task-title-input').value.trim();
    const editedDeadlineIso = datetimeLocalToIso(div.querySelector('.task-deadline-input').value);
    const editedSubtasks = div
      .querySelector('.task-subtasks-input')
      .value.split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    // Compare the edited values against the AI's original suggestion so
    // we can record whether a human changed anything before approving.
    const wasEdited =
      editedTitle !== suggestion.title ||
      editedDeadlineIso !== (suggestion.deadline || null) ||
      JSON.stringify(editedSubtasks) !== JSON.stringify(suggestion.subtasks);

    const reasoningLog = wasEdited
      ? [...suggestion.reasoningLog, 'Human review: the reviewer edited this suggestion before approving it (see the ethics & security discussion on tracking edit rates during testing).']
      : suggestion.reasoningLog;

    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editedTitle || suggestion.title,
        deadline: editedDeadlineIso,
        subtasks: editedSubtasks,
        source: suggestion.source,
        importance: 3,
        extractionReasoning: reasoningLog,
      }),
    });
    div.remove(); // the suggestion card disappears once it's been saved
  });

  // "Reject" - just remove the card from the page. Nothing was ever
  // saved for a suggestion until Approve is clicked, so there's nothing
  // to undo on the backend here.
  div.querySelector('.reject-btn').addEventListener('click', () => {
    div.remove();
  });

  container.appendChild(div);
}

// --- 3. Dashboard / prioritized list (the "Prioritized Dashboard" tab) ---
const taskListEl = document.getElementById('task-list');
const cardTemplate = document.getElementById('task-card-template'); // an invisible <template> in index.html - see the notes below
const taskSearchInput = document.getElementById('task-search');

// Fetches the current list of saved tasks (already sorted by priority by
// the backend) and re-draws the dashboard. Also passes along whatever is
// typed into the search box, if anything, so the backend can filter the
// results before sending them back (see src/search.js).
async function loadTasks() {
  taskListEl.innerHTML = '<p class="hint">Loading…</p>';
  const q = taskSearchInput.value.trim();
  const res = await fetch(`/api/tasks${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  const data = await res.json();
  renderTasks(data.tasks, q);
}

// Re-run the search a fraction of a second after the person stops typing
// (rather than on every single keystroke), so we're not hammering the
// server with a request per letter typed.
let searchDebounceTimer = null;
taskSearchInput.addEventListener('input', () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(loadTasks, 250);
});

// Picks which color/style "band" a priority score falls into (see the
// matching CSS classes .band-high/.band-mid/.band-low in styles.css) -
// this is purely a visual/cosmetic decision, it doesn't change the score
// itself or the sort order.
function scoreBandClass(score) {
  if (score >= 80) return 'band-high';
  if (score >= 50) return 'band-mid';
  return 'band-low';
}

// Draws every task card on the dashboard from scratch. `tasks` is the
// list returned by the backend (already ranked, highest priority first).
// `activeQuery` is only used to word the "nothing found" message.
function renderTasks(tasks, activeQuery) {
  taskListEl.innerHTML = '';
  if (!tasks.length) {
    // Nothing to show - either there really are no tasks yet, or a
    // search query didn't match anything. Show a friendly empty state
    // either way, with wording that depends on which case it is.
    const icon = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M9 3v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V3"></path><path d="m9 13 2 2 4-4"></path></svg>';
    taskListEl.innerHTML = activeQuery
      ? `<div class="empty-state">${icon}No tasks match "${escapeHtml(activeQuery)}".</div>`
      : `<div class="empty-state">${icon}No tasks yet — approve a suggestion from the Inbox tab, or one will appear here once added.</div>`;
    return;
  }
  // For each task, clone the reusable <template id="task-card-template">
  // from index.html (this avoids having to hand-write a big HTML string
  // for every single task, unlike renderSuggestion() above) and fill in
  // its blanks with this task's actual data.
  tasks.forEach((task, index) => {
    const node = cardTemplate.content.cloneNode(true);
    const articleEl = node.querySelector('.task-card');
    const titleEl = node.querySelector('.task-title');
    // The very first task in the (already-sorted) list is the highest
    // priority one - give it a small "Top priority" flag and a slightly
    // different visual treatment, but only if there's more than one task
    // (a "top priority" label doesn't mean much when it's the only task).
    if (index === 0 && tasks.length > 1) {
      articleEl.classList.add('is-top-priority');
      const flag = document.createElement('span');
      flag.className = 'top-priority-flag';
      flag.textContent = 'Top priority';
      titleEl.parentElement.parentElement.insertBefore(flag, titleEl.parentElement);
    }
    titleEl.textContent = task.title;
    const scoreEl = node.querySelector('.task-score');
    scoreEl.textContent = `${task.priorityScore}/100`;
    scoreEl.classList.add(scoreBandClass(task.priorityScore));
    node.querySelector('.task-meta').textContent =
      `Deadline: ${task.deadline ? new Date(task.deadline).toLocaleString() : 'none'} · Source: ${task.source} · Importance: ${task.importance}/5`;

    // List out each subtask as its own bullet point.
    const subtasksEl = node.querySelector('.task-subtasks');
    (task.subtasks || []).forEach((s) => {
      const li = document.createElement('li');
      li.textContent = s;
      subtasksEl.appendChild(li);
    });

    // "Why is this ranked here?" - the prioritization algorithm's own
    // explanation (see src/prioritize.js), e.g. "Deadline urgency: 80/100...".
    const reasoningEl = node.querySelector('.task-reasoning ul');
    (task.reasoningLog || []).forEach((r) => {
      const li = document.createElement('li');
      li.textContent = r;
      reasoningEl.appendChild(li);
    });

    // "How was this task extracted?" - a *different* explanation than the
    // one above: this one is about how the AI originally read the raw
    // message (see src/extractor.js), not about the priority score.
    // Manually-created tasks (typed straight into a form, never run
    // through the extractor) have no such history, so hide this section
    // entirely for those rather than showing an empty, confusing box.
    const extractionSection = node.querySelector('.task-extraction-reasoning');
    const extractionEl = extractionSection.querySelector('ul');
    if (task.extractionReasoning && task.extractionReasoning.length) {
      task.extractionReasoning.forEach((r) => {
        const li = document.createElement('li');
        li.textContent = r;
        extractionEl.appendChild(li);
      });
    } else {
      extractionSection.style.display = 'none'; // manually-created tasks have no extraction history to show
    }

    // The little number box where someone can type their own priority
    // score (0-100) to override the algorithm entirely. Saving a new
    // value tells the backend, then reloads the whole list so the task
    // moves to its new position in the sort order.
    const overrideInput = node.querySelector('.override-input');
    overrideInput.value = task.manualOverride != null ? task.manualOverride : '';
    overrideInput.addEventListener('change', async () => {
      const val = overrideInput.value === '' ? null : Number(overrideInput.value);
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualOverride: val }),
      });
      loadTasks();
    });

    // Delete button: tell the backend to remove this task, then reload.
    node.querySelector('.delete-btn').addEventListener('click', async () => {
      await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      loadTasks();
    });

    taskListEl.appendChild(node);
  });
}

// A small safety helper: turns any string into text that's safe to drop
// into innerHTML without it being interpreted as HTML/script. Used
// everywhere a task's title, subtasks, or reasoning (all just plain text
// from the backend) gets inserted into the page, so nothing a user
// pastes into the Inbox tab can accidentally break the page's layout or
// run as code.
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Load the dashboard's data once immediately on page load too, in case
// someone opens the app with the Prioritized Dashboard tab already
// selected (e.g. after a page refresh) rather than clicking into it.
loadTasks();

// --- 4. Google Gmail/Calendar sync (optional integration) ---
// This whole section only does anything if the server has Google OAuth
// credentials configured (see docs/google-integration.md) - if not, the
// status check below just says so and the rest of the UI stays hidden.
const googleStatusEl = document.getElementById('google-sync-status');
const googleConnectBtn = document.getElementById('google-connect-btn');
const googleSyncControls = document.getElementById('google-sync-controls');
const googleSearchInput = document.getElementById('google-search-input');
const googleCategorySelect = document.getElementById('google-category-select');
const googleSyncBtn = document.getElementById('google-sync-btn');
const googleSuggestionsEl = document.getElementById('google-suggestions');

// Asks the backend three things at once: is Google integration turned on
// for this server at all, and if so, has this person already connected
// their account? Shows the right UI for whichever answer comes back.
async function refreshGoogleStatus() {
  try {
    const res = await fetch('/api/google/status');
    const { configured, authorized } = await res.json();

    if (!configured) {
      googleStatusEl.textContent = 'Not configured on this server (optional feature — see docs/google-integration.md).';
      googleConnectBtn.style.display = 'none';
      googleSyncControls.style.display = 'none';
      return;
    }
    if (!authorized) {
      googleStatusEl.textContent = 'Configured, but not connected yet.';
      googleConnectBtn.style.display = 'inline-block';
      googleSyncControls.style.display = 'none';
      return;
    }
    googleStatusEl.textContent = 'Connected — read-only access to recent Gmail and Calendar items.';
    googleConnectBtn.style.display = 'none';
    googleSyncControls.style.display = 'block';
  } catch (err) {
    googleStatusEl.textContent = 'Could not check Google integration status.';
  }
}

// Clicking "Connect Google account" just sends the browser to the
// backend's /auth/google route, which redirects on to Google's own
// sign-in/consent screen. Nothing happens here in the frontend beyond
// that redirect - see src/google/oauthClient.js for the actual OAuth flow.
googleConnectBtn.addEventListener('click', () => {
  window.location.href = '/auth/google';
});

// Pulls recent Gmail messages (filtered by category and/or search term)
// and Calendar events, runs them all through the same AI extractor as
// the manual paste box, and shows each result as its own suggestion card
// - exactly like renderSuggestion() above, just fed by Google instead of
// someone typing text in by hand.
async function runGoogleSync() {
  const category = googleCategorySelect.value;
  const searchTerm = googleSearchInput.value.trim();
  const searchNote = searchTerm ? ` matching "${searchTerm}"` : '';
  googleSuggestionsEl.innerHTML = `<p class="hint">Fetching recent Gmail (${category})${searchNote} and Calendar items…</p>`;
  try {
    const params = new URLSearchParams({ category });
    if (searchTerm) params.set('q', searchTerm);
    const res = await fetch(`/api/google/sync?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'sync failed');
    googleSuggestionsEl.innerHTML = '';
    if (!data.suggestions.length) {
      const icon = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>';
      googleSuggestionsEl.innerHTML = `<div class="empty-state">${icon}Nothing found.</div>`;
      return;
    }
    data.suggestions.forEach((s) => renderSuggestion(s, googleSuggestionsEl));
  } catch (err) {
    googleSuggestionsEl.innerHTML = `<p class="hint">Sync failed: ${escapeHtml(err.message)}</p>`;
  }
}

googleSyncBtn.addEventListener('click', runGoogleSync);

// Pressing Enter in the search box triggers a sync too, matching how
// Gmail's own search bar behaves.
googleSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    runGoogleSync();
  }
});

// If we just came back from the OAuth redirect, show a quick confirmation.
// (server.js redirects back here with ?google_connected=1 in the URL
// after a successful Google sign-in - see the /oauth2callback route.)
if (new URLSearchParams(window.location.search).get('google_connected') === '1') {
  googleStatusEl.textContent = 'Connected! Checking status…';
  window.history.replaceState({}, '', window.location.pathname); // clean the ?google_connected=1 out of the visible URL
}

refreshGoogleStatus();
