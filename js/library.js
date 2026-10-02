/* ═══════════════════════════════════════════════════════════════
   library.js — Script Library page
   Depends on storage.js (loaded first).
   ═══════════════════════════════════════════════════════════════ */

tpApplySavedTheme();

const SORTS = [
  { key: 'recent', label: 'Recent',  fn: (a, b) => b.updatedAt - a.updatedAt },
  { key: 'name',   label: 'A–Z',     fn: (a, b) => a.name.localeCompare(b.name) },
  { key: 'length', label: 'Longest', fn: (a, b) => tpCountWords(tpScriptText(b)) - tpCountWords(tpScriptText(a)) },
];
let sortIndex = 0;
let query = '';

const el = id => document.getElementById(id);
const cardsEl  = el('cards');
const emptyEl  = el('emptyState');
const toastEl  = el('toast');

/* ── toast ────────────────────────────────────────────────────── */

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/* ── modals ───────────────────────────────────────────────────── */

let nameModalOnSave = null;
let confirmOnYes = null;

function openNameModal(title, currentName, onSave) {
  el('nameModalTitle').textContent = title;
  el('nameInput').value = currentName || '';
  nameModalOnSave = onSave;
  el('nameModal').classList.add('open');
  el('nameInput').focus();
  el('nameInput').select();
}

function openConfirm(message, onYes) {
  el('confirmMsg').textContent = message;
  confirmOnYes = onYes;
  el('confirmModal').classList.add('open');
  el('confirmYesBtn').focus();
}

function closeModals() {
  el('nameModal').classList.remove('open');
  el('confirmModal').classList.remove('open');
  nameModalOnSave = null;
  confirmOnYes = null;
}

document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModals));
document.querySelectorAll('.modal-backdrop').forEach(bd => {
  // click the dimmed area (not the dialog) to dismiss
  bd.addEventListener('click', e => { if (e.target === bd) closeModals(); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModals();
  if (e.key === 'Enter' && el('nameModal').classList.contains('open')) {
    e.preventDefault();
    el('nameSaveBtn').click();
  }
});

el('nameSaveBtn').addEventListener('click', () => {
  const value = el('nameInput').value.trim();
  if (!value) { el('nameInput').focus(); return; }
  const fn = nameModalOnSave;
  closeModals();
  if (fn) fn(value);
});

el('confirmYesBtn').addEventListener('click', () => {
  const fn = confirmOnYes;
  closeModals();
  if (fn) fn();
});

/* ── rendering ────────────────────────────────────────────────── */

function previewText(script) {
  const text = tpScriptText(script).trim();
  return text ? text.replace(/\n{2,}/g, '\n') : 'Empty script — nothing written yet.';
}

function render() {
  const lib = tpLoadLibrary();
  let list = lib.scripts.slice();

  if (query) {
    const q = query.toLowerCase();
    list = list.filter(s =>
      s.name.toLowerCase().includes(q) || tpScriptText(s).toLowerCase().includes(q));
  }
  list.sort(SORTS[sortIndex].fn);

  const total = lib.scripts.length;
  el('pageSub').textContent = total === 0
    ? 'Every script you save lives here.'
    : total + (total === 1 ? ' script saved' : ' scripts saved') +
      (query ? ' · ' + list.length + ' matching' : '');

  const badge = el('libraryCount');
  if (badge) badge.textContent = total === 1 ? '1 script' : total + ' scripts';

  // Nothing at all vs nothing matching the search are different messages.
  emptyEl.hidden = total !== 0;
  cardsEl.innerHTML = '';

  if (total > 0 && list.length === 0) {
    cardsEl.innerHTML = '<div class="empty"><div class="big">No matches</div>' +
      '<p>Nothing matches “' + tpEscape(query) + '”.</p></div>';
    return;
  }

  list.forEach(s => cardsEl.appendChild(buildCard(s, lib.activeId)));
}

function buildCard(s, activeId) {
  const words = tpCountWords(tpScriptText(s));
  const lines = tpCountLines(tpScriptText(s));
  const isActive = s.id === activeId;

  const card = document.createElement('article');
  card.className = 'script-card' + (isActive ? ' is-active' : '');

  let dots = '';
  tpActiveReaders(s).forEach(r => {
    dots += '<i style="background:' + tpEscape(r.color) + ';color:' + tpEscape(r.color) +
            '" title="' + tpEscape(r.name) + '"></i>';
  });

  card.innerHTML =
    '<div class="script-card-top">' +
      '<h2 class="script-name"></h2>' +
      (isActive ? '<span class="active-tag">Open</span>' : '') +
    '</div>' +
    '<div class="script-preview"></div>' +
    '<div class="script-meta">' +
      '<span><b>' + words + '</b> words</span>' +
      '<span><b>' + lines + '</b> lines</span>' +
      '<span><b>' + tpFormatDuration(tpEstimateSeconds(words)) + '</b> est.</span>' +
      '<span class="reader-dots" title="' + s.mode + ' reader(s)">' + dots + '</span>' +
    '</div>' +
    '<div class="script-meta"><span>Edited ' + tpFormatDate(s.updatedAt) + '</span></div>' +
    '<div class="script-card-actions">' +
      '<button class="btn tiny primary" data-act="open">Open</button>' +
      '<button class="btn tiny" data-act="rename">Rename</button>' +
      '<button class="btn tiny" data-act="dup">Duplicate</button>' +
      '<button class="btn tiny" data-act="download">Download</button>' +
      '<button class="btn tiny danger" data-act="del">Delete</button>' +
    '</div>';

  // textContent (not innerHTML) so script names and bodies can't inject markup
  card.querySelector('.script-name').textContent = s.name;
  card.querySelector('.script-preview').textContent = previewText(s);

  card.querySelector('[data-act=open]').addEventListener('click', () => openScript(s.id));
  card.querySelector('[data-act=rename]').addEventListener('click', () => renameScript(s));
  card.querySelector('[data-act=dup]').addEventListener('click', () => duplicateScript(s.id));
  card.querySelector('[data-act=download]').addEventListener('click', () => downloadScript(s));
  card.querySelector('[data-act=del]').addEventListener('click', () => deleteScript(s));

  return card;
}

/* ── actions ──────────────────────────────────────────────────── */

function openScript(id) {
  tpSetActiveScript(id);
  window.location.href = 'index.html';
}

function renameScript(s) {
  openNameModal('Rename script', s.name, name => {
    tpUpdateScript(s.id, { name: name });
    render();
    toast('Renamed');
  });
}

function duplicateScript(id) {
  const copy = tpDuplicateScript(id);
  render();
  toast(copy ? 'Duplicated' : 'Could not duplicate');
}

function deleteScript(s) {
  openConfirm('“' + s.name + '” will be removed from the library. This cannot be undone.', () => {
    tpDeleteScript(s.id);
    render();
    toast('Deleted');
  });
}

function newScript() {
  openNameModal('New script', '', name => {
    const s = tpAddScript(tpMakeScript(name, '', 1, null));
    render();
    toast('Created — opening…');
    setTimeout(() => openScript(s.id), 450);
  });
}

/* ── download / import / export ───────────────────────────────── */

function triggerDownload(filename, text, mime) {
  const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(name) {
  return (name || 'script').replace(/[^a-z0-9\-_ ]/gi, '').trim().slice(0, 60) || 'script';
}

/**
 * One .txt per script. The file carries a small comment header with the
 * reader names and colours, so importing it again rebuilds the same
 * multi-reader script instead of flattening everything into Reader 1.
 */
function downloadScript(s) {
  triggerDownload(safeFilename(s.name) + '.txt', tpScriptToFile(s));
  toast('Downloaded');
}

/** Full backup of library + session history. */
function exportBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    library: tpLoadLibrary(),
    sessions: tpLoadSessions(),
  };
  triggerDownload('teleprompt-backup.json', JSON.stringify(payload, null, 2),
                  'application/json;charset=utf-8');
  toast('Backup downloaded');
}

el('importFile').addEventListener('change', e => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  let done = 0;

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = () => {
      const fallback = file.name.replace(/\.[^.]+$/, '') || 'Imported script';
      // Recovers reader names, colours and the reader count from either our
      // own export header or plain speaker tags in a hand-written file.
      const parsed = tpParseScriptFile(String(reader.result || ''), fallback);
      tpAddScript(tpMakeScript(parsed.name, parsed.body, parsed.mode, parsed.readers));
      if (++done === files.length) {
        render();
        toast(done === 1 ? 'Imported 1 script' : 'Imported ' + done + ' scripts');
      }
    };
    reader.onerror = () => {
      if (++done === files.length) { render(); toast('Some files could not be read'); }
    };
    reader.readAsText(file);
  });

  e.target.value = '';   // let the same file be picked again later
});

/* ── wiring ───────────────────────────────────────────────────── */

el('newBtn').addEventListener('click', newScript);
el('importBtn').addEventListener('click', () => el('importFile').click());
el('exportBtn').addEventListener('click', exportBackup);

el('sortBtn').addEventListener('click', () => {
  sortIndex = (sortIndex + 1) % SORTS.length;
  el('sortBtn').textContent = 'Sort: ' + SORTS[sortIndex].label;
  render();
});

let searchTimer = null;
el('searchInput').addEventListener('input', e => {
  const v = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { query = v.trim(); render(); }, 120);
});

render();
