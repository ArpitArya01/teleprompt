/* ═══════════════════════════════════════════════════════════════
   report.js — Session Report page
   Depends on storage.js (loaded first).
   ═══════════════════════════════════════════════════════════════ */

tpApplySavedTheme();

const el = id => document.getElementById(id);
const toastEl = el('toast');

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/** Builds one stat tile. `foot` is optional. */
function tile(label, value, unit, foot) {
  const d = document.createElement('div');
  d.className = 'stat-tile';
  d.innerHTML =
    '<div class="label"></div>' +
    '<div class="value"><span></span>' + (unit ? '<small></small>' : '') + '</div>' +
    (foot ? '<div class="foot"></div>' : '');
  d.querySelector('.label').textContent = label;
  d.querySelector('.value span').textContent = value;
  if (unit) d.querySelector('.value small').textContent = unit;
  if (foot) d.querySelector('.foot').textContent = foot;
  return d;
}

/* ── last run ─────────────────────────────────────────────────── */

function renderLast(s) {
  el('lastWhen').textContent = tpFormatDate(s.endedAt);

  const grid = el('lastGrid');
  grid.innerHTML = '';
  grid.appendChild(tile('Time reading', tpFormatDuration(s.durationSec), '',
    'Estimated ' + tpFormatDuration(s.estimatedSec)));
  grid.appendChild(tile('Your pace', s.wpm || 0, 'wpm',
    'Comfortable speech is 120–150'));
  grid.appendChild(tile('Words read', s.wordsRead || 0, '',
    'of ' + (s.totalWords || 0) + ' in the script'));
  grid.appendChild(tile('Progress', (s.progressPct || 0) + '%', '',
    s.completed ? 'Read all the way through' : 'Stopped before the end'));
  grid.appendChild(tile('Pauses', s.pauseCount || 0, '',
    (s.rewinds || 0) + ' rewind/skip' + ((s.rewinds || 0) === 1 ? '' : 's')));

  // Compare actual time against the 130 wpm estimate.
  let verdict;
  if (!s.estimatedSec || !s.durationSec) {
    verdict = 'Not enough data to judge the pace on this run.';
  } else {
    const ratio = s.durationSec / s.estimatedSec;
    if (ratio > 1.25)      verdict = 'You took noticeably longer than the estimate — a slower, more deliberate read.';
    else if (ratio > 1.08) verdict = 'Slightly slower than estimated. Good for clarity.';
    else if (ratio < 0.8)  verdict = 'Well ahead of the estimate. Check you are not rushing.';
    else if (ratio < 0.92) verdict = 'A touch quicker than estimated.';
    else                   verdict = 'Right on the estimated pace. Nicely controlled.';
  }
  if ((s.pauseCount || 0) >= 5) verdict += ' You paused ' + s.pauseCount + ' times — try a slower scroll speed to reduce that.';
  el('lastVerdict').textContent = verdict;
}

/* ── all time ─────────────────────────────────────────────────── */

function renderTotals(summary) {
  const grid = el('totalGrid');
  grid.innerHTML = '';
  grid.appendChild(tile('Sessions', summary.count));
  grid.appendChild(tile('Time practised', tpFormatDuration(summary.totalSeconds)));
  grid.appendChild(tile('Average pace', summary.avgWpm, 'wpm'));
  grid.appendChild(tile('Best pace', summary.bestWpm, 'wpm'));
  grid.appendChild(tile('Finished', summary.completionRate + '%', '', 'runs read to the end'));
  grid.appendChild(tile('Words read', summary.totalWords));
}

/* ── chart ────────────────────────────────────────────────────── */

function renderChart(sessions) {
  // oldest -> newest, last 12
  const recent = sessions.slice(0, 12).reverse();
  const chart = el('chart');
  chart.innerHTML = '';

  const max = Math.max.apply(null, recent.map(s => s.wpm || 0).concat([1]));

  recent.forEach(s => {
    const col = document.createElement('div');
    col.className = 'chart-col';
    const pct = Math.max(3, Math.round(((s.wpm || 0) / max) * 100));
    col.innerHTML =
      '<div class="chart-bar" style="height:' + pct + '%"><span>' + (s.wpm || 0) + '</span></div>' +
      '<div class="tick"></div>';
    col.querySelector('.tick').textContent =
      new Date(s.endedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    col.title = (s.scriptName || 'Script') + ' — ' + (s.wpm || 0) + ' wpm, ' +
                tpFormatDuration(s.durationSec);
    chart.appendChild(col);
  });

  if (recent.length < 2) {
    el('chartLegend').textContent = 'Practise a few more times to see your pace trend.';
    return;
  }
  const first = recent[0].wpm || 0;
  const last = recent[recent.length - 1].wpm || 0;
  const diff = last - first;
  el('chartLegend').textContent = diff === 0
    ? 'Your pace has held steady across these runs.'
    : 'Your pace has ' + (diff > 0 ? 'risen' : 'dropped') + ' by ' +
      Math.abs(diff) + ' wpm since the oldest run shown.';
}

/* ── history table ────────────────────────────────────────────── */

function renderHistory(sessions) {
  el('historyCount').textContent = sessions.length +
    (sessions.length === 1 ? ' run' : ' runs') + ' recorded';

  const body = el('historyBody');
  body.innerHTML = '';

  sessions.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="num"></td>' +
      '<td class="name"></td>' +
      '<td class="num">' + tpFormatDuration(s.durationSec) + '</td>' +
      '<td class="num">' + tpFormatDuration(s.estimatedSec) + '</td>' +
      '<td class="num">' + (s.wpm || 0) + '</td>' +
      '<td class="num">' + (s.wordsRead || 0) + '</td>' +
      '<td class="num">' + (s.pauseCount || 0) + '</td>' +
      '<td><span class="pill ' + (s.completed ? 'done">Yes' : 'partial">' + (s.progressPct || 0) + '%') + '</span></td>' +
      '<td><button class="btn tiny danger" aria-label="Delete this run">✕</button></td>';
    tr.querySelector('td.num').textContent = tpFormatDate(s.endedAt);
    tr.querySelector('td.name').textContent = s.scriptName || 'Untitled script';
    tr.querySelector('button').addEventListener('click', () => {
      tpDeleteSession(s.id);
      render();
      toast('Run deleted');
    });
    body.appendChild(tr);
  });
}

/* ── csv ──────────────────────────────────────────────────────── */

function exportCSV() {
  const sessions = tpGetSessions();
  if (!sessions.length) { toast('Nothing to export'); return; }

  const headers = ['Date', 'Script', 'Readers', 'Seconds read', 'Estimated seconds',
                   'WPM', 'Words read', 'Total words', 'Pauses', 'Rewinds',
                   'Progress %', 'Completed'];
  // Wrap every field in quotes and double any inner quote — keeps commas safe.
  const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = sessions.map(s => [
    new Date(s.endedAt).toISOString(), s.scriptName || '', s.mode || 1,
    s.durationSec || 0, s.estimatedSec || 0, s.wpm || 0,
    s.wordsRead || 0, s.totalWords || 0, s.pauseCount || 0, s.rewinds || 0,
    s.progressPct || 0, s.completed ? 'yes' : 'no',
  ].map(cell).join(','));

  const csv = headers.map(cell).join(',') + '\r\n' + rows.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'teleprompt-sessions.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('CSV downloaded');
}

/* ── render ───────────────────────────────────────────────────── */

function render() {
  const sessions = tpGetSessions();
  const any = sessions.length > 0;

  el('hasData').hidden = !any;
  el('emptyState').hidden = any;
  el('exportBtn').disabled = !any;
  el('clearBtn').disabled = !any;

  const badge = el('runCount');
  if (badge) badge.textContent = !any ? 'No runs yet'
    : (sessions.length === 1 ? '1 run' : sessions.length + ' runs');

  if (!any) {
    el('pageSub').textContent = 'How your practice runs are going.';
    return;
  }

  const summary = tpSessionSummary(sessions);
  el('pageSub').textContent = summary.count +
    (summary.count === 1 ? ' run' : ' runs') + ' · ' +
    tpFormatDuration(summary.totalSeconds) + ' practised · ' +
    summary.avgWpm + ' wpm average';

  renderLast(sessions[0]);
  renderTotals(summary);
  renderChart(sessions);
  renderHistory(sessions);
}

/* ── wiring ───────────────────────────────────────────────────── */

function closeModal() { el('confirmModal').classList.remove('open'); }

el('clearBtn').addEventListener('click', () => el('confirmModal').classList.add('open'));
el('confirmYesBtn').addEventListener('click', () => {
  tpClearSessions();
  closeModal();
  render();
  toast('History cleared');
});
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
el('confirmModal').addEventListener('click', e => {
  if (e.target === el('confirmModal')) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
el('exportBtn').addEventListener('click', exportCSV);

render();
