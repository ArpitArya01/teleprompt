/* ═══════════════════════════════════════════════════════════════
   storage.js — shared data layer for all pages
   ───────────────────────────────────────────────────────────────
   Owns three things in localStorage:
     tp_library_v1   many named scripts + which one is active
     tp_sessions_v1  history of practice runs
     tp_theme_v2     UI theme (written by app.js, read by every page)

   Loaded before app.js / library.js / report.js, so everything here
   is a plain global — no modules, no build step.
   ═══════════════════════════════════════════════════════════════ */

const TP_LIBRARY_KEY  = 'tp_library_v1';
const TP_SESSIONS_KEY = 'tp_sessions_v1';
const TP_THEME_KEY    = 'tp_theme_v2';
const TP_OLD_SCRIPT_KEY = 'tp_script_v2';   // the old single-script slot

const TP_MAX_READERS  = 4;
const TP_MAX_SESSIONS = 200;                // keep history from growing forever

const TP_DEFAULT_COLORS = { 1: '#4FC3F7', 2: '#FFD54F', 3: '#A5D6A7', 4: '#F48FB1' };

/* ── safe localStorage wrappers ───────────────────────────────── */

function tpRead(key) {
  try { return localStorage.getItem(key); }
  catch (e) { console.error('[TP] read failed:', key, e); return null; }
}

function tpWrite(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch (e) { console.error('[TP] write failed:', key, e); return false; }
}

function tpReadJSON(key, fallback) {
  const raw = tpRead(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); }
  catch (e) { console.error('[TP] bad JSON in', key, e); return fallback; }
}

/* ── ids & helpers ────────────────────────────────────────────── */

function tpNewId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Words in a blob of text. */
function tpCountWords(text) {
  return String(text || '').trim().split(/\s+/).filter(w => w.length > 0).length;
}

/** Non-empty lines in a blob of text. */
function tpCountLines(text) {
  return String(text || '').split('\n').filter(l => l.trim().length > 0).length;
}

/** A script's spoken text, with speaker tags stripped. */
function tpScriptText(script) {
  if (!script) return '';
  const blocks = tpParseScript(script.body || '', tpActiveReaders(script));
  return blocks.filter(b => b.type === 'line').map(b => b.text).join('\n');
}

/** The readers this script actually uses, per its mode. */
function tpActiveReaders(script) {
  const readers = (script && script.readers && script.readers.length)
    ? script.readers : tpDefaultReaders();
  const count = Math.min(Math.max(parseInt(script && script.mode) || 1, 1), readers.length);
  return readers.slice(0, count);
}

/** Reading-aloud estimate at ~130 words per minute, in seconds. */
function tpEstimateSeconds(words) {
  return Math.round((words / 130) * 60);
}

/** 95 -> "1:35". Negative/NaN becomes "0:00". */
function tpFormatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}

/** Short human date, e.g. "2 Oct, 16:40". */
function tpFormatDate(ms) {
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
         ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Escapes text for safe insertion into innerHTML. */
function tpEscape(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ── script shape ─────────────────────────────────────────────── */

function tpMakeScript(name, body, mode, readers) {
  const now = Date.now();
  return {
    id: tpNewId('s'),
    name: (name || 'Untitled script').trim() || 'Untitled script',
    mode: Math.min(TP_MAX_READERS, Math.max(1, parseInt(mode) || 1)),
    readers: tpNormalizeReaders(readers),
    body: String(body == null ? '' : body),
    history: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Always returns exactly TP_MAX_READERS entries with sane names/colours. */
function tpNormalizeReaders(readers) {
  const defaults = tpDefaultReaders();
  return defaults.map((d, i) => {
    const given = (readers && readers[i]) || null;
    return {
      id: d.id,
      name: (given && String(given.name || '').trim()) || d.name,
      color: (given && /^#[0-9a-fA-F]{6}$/.test(String(given.color || '').trim()))
        ? String(given.color).trim() : d.color,
    };
  });
}

/**
 * Brings any stored record up to the current shape.
 * Records written before the rewrite carried texts{1..4} and a strict
 * round-robin order; those are folded into one speaker-tagged body
 * that reads in the same sequence, so nothing is lost or reordered.
 */
function tpNormalizeScript(s) {
  if (!s || typeof s !== 'object') return null;

  const mode = Math.min(TP_MAX_READERS, Math.max(1, parseInt(s.mode) || 1));

  // Colours used to live in a { 1:'#rgb', … } map alongside texts.
  let readers = s.readers;
  if (!readers && s.colors) {
    readers = tpDefaultReaders().map((d, i) => ({
      id: d.id,
      name: d.name,
      color: s.colors[i + 1] || s.colors[String(i + 1)] || d.color,
    }));
  }
  readers = tpNormalizeReaders(readers);

  let body = s.body;
  if (body == null) {
    // Legacy record: rebuild the body from the old per-reader boxes.
    body = tpBodyFromLegacyTexts(s.texts || {}, mode, readers);
  }

  return {
    id: s.id || tpNewId('s'),
    name: (s.name || 'Untitled script').trim() || 'Untitled script',
    mode: mode,
    readers: readers,
    body: String(body == null ? '' : body),
    history: Array.isArray(s.history) ? s.history.slice(-12) : [],
    createdAt: s.createdAt || Date.now(),
    updatedAt: s.updatedAt || s.createdAt || Date.now(),
  };
}

/* ── library ──────────────────────────────────────────────────── */

/**
 * Reads the library, creating it on first run.
 * If the old single-script key is present its content is carried over
 * so nobody loses the script they were working on.
 */
function tpLoadLibrary() {
  let lib = tpReadJSON(TP_LIBRARY_KEY, null);

  if (!lib || !Array.isArray(lib.scripts)) {
    lib = { version: 1, activeId: null, scripts: [] };

    const old = tpReadJSON(TP_OLD_SCRIPT_KEY, null);
    if (old) {
      const readers = tpNormalizeReaders(
        tpDefaultReaders().map((d, i) => ({
          id: d.id, name: d.name,
          color: (old.colors && (old.colors[i + 1] || old.colors[String(i + 1)])) || d.color,
        })));
      const body = tpBodyFromLegacyTexts(
        { 1: old.text1 || '', 2: old.text2 || '', 3: old.text3 || '', 4: old.text4 || '' },
        old.mode || 1, readers);
      const migrated = tpMakeScript('My first script', body, old.mode || 1, readers);
      lib.scripts.push(migrated);
      lib.activeId = migrated.id;
      console.log('[TP] migrated the old single-slot script into the library');
    }
    tpSaveLibrary(lib);
  }

  lib.scripts = lib.scripts.map(tpNormalizeScript).filter(Boolean);
  if (!lib.scripts.some(s => s.id === lib.activeId)) {
    lib.activeId = lib.scripts.length ? lib.scripts[0].id : null;
  }
  return lib;
}

function tpSaveLibrary(lib) {
  lib.version = 1;
  return tpWrite(TP_LIBRARY_KEY, JSON.stringify(lib));
}

function tpGetScripts() {
  return tpLoadLibrary().scripts;
}

function tpGetActiveScript() {
  const lib = tpLoadLibrary();
  return lib.scripts.find(s => s.id === lib.activeId) || null;
}

function tpSetActiveScript(id) {
  const lib = tpLoadLibrary();
  if (!lib.scripts.some(s => s.id === id)) return false;
  lib.activeId = id;
  return tpSaveLibrary(lib);
}

function tpAddScript(script) {
  const lib = tpLoadLibrary();
  const s = tpNormalizeScript(script) || tpMakeScript('Untitled script');
  lib.scripts.push(s);
  lib.activeId = s.id;
  tpSaveLibrary(lib);
  return s;
}

/** Shallow-merges `patch` into the script with this id and bumps updatedAt. */
function tpUpdateScript(id, patch) {
  const lib = tpLoadLibrary();
  const i = lib.scripts.findIndex(s => s.id === id);
  if (i === -1) return null;
  const merged = Object.assign({}, lib.scripts[i], patch, { id: id, updatedAt: Date.now() });
  lib.scripts[i] = tpNormalizeScript(merged);
  tpSaveLibrary(lib);
  return lib.scripts[i];
}

function tpDeleteScript(id) {
  const lib = tpLoadLibrary();
  const before = lib.scripts.length;
  lib.scripts = lib.scripts.filter(s => s.id !== id);
  if (lib.scripts.length === before) return false;
  if (lib.activeId === id) lib.activeId = lib.scripts.length ? lib.scripts[0].id : null;
  tpSaveLibrary(lib);
  return true;
}

function tpDuplicateScript(id) {
  const src = tpGetScripts().find(s => s.id === id);
  if (!src) return null;
  const copy = tpMakeScript(src.name + ' (copy)', src.body, src.mode, src.readers);
  const lib = tpLoadLibrary();
  lib.scripts.splice(lib.scripts.findIndex(s => s.id === id) + 1, 0, copy);
  tpSaveLibrary(lib);
  return copy;
}

/* ── sessions ─────────────────────────────────────────────────── */

function tpLoadSessions() {
  const data = tpReadJSON(TP_SESSIONS_KEY, null);
  if (!data || !Array.isArray(data.sessions)) return { version: 1, sessions: [] };
  return data;
}

function tpSaveSessions(data) {
  data.version = 1;
  return tpWrite(TP_SESSIONS_KEY, JSON.stringify(data));
}

/** Newest first. */
function tpGetSessions() {
  return tpLoadSessions().sessions.slice().sort((a, b) => b.endedAt - a.endedAt);
}

function tpAddSession(session) {
  const data = tpLoadSessions();
  const s = Object.assign({ id: tpNewId('r'), endedAt: Date.now() }, session);
  data.sessions.push(s);
  // Trim oldest first if we're over the cap.
  if (data.sessions.length > TP_MAX_SESSIONS) {
    data.sessions.sort((a, b) => a.endedAt - b.endedAt);
    data.sessions = data.sessions.slice(data.sessions.length - TP_MAX_SESSIONS);
  }
  tpSaveSessions(data);
  return s;
}

function tpDeleteSession(id) {
  const data = tpLoadSessions();
  const before = data.sessions.length;
  data.sessions = data.sessions.filter(s => s.id !== id);
  if (data.sessions.length === before) return false;
  return tpSaveSessions(data);
}

function tpClearSessions() {
  return tpSaveSessions({ version: 1, sessions: [] });
}

/** Totals and averages across every recorded run. */
function tpSessionSummary(sessions) {
  const list = sessions || tpGetSessions();
  if (!list.length) {
    return { count: 0, totalSeconds: 0, avgWpm: 0, bestWpm: 0,
             completionRate: 0, totalWords: 0, avgPauses: 0 };
  }
  const withWpm = list.filter(s => s.wpm > 0);
  const sum = (fn) => list.reduce((a, s) => a + (Number(fn(s)) || 0), 0);
  return {
    count: list.length,
    totalSeconds: sum(s => s.durationSec),
    totalWords: sum(s => s.wordsRead),
    avgWpm: withWpm.length ? Math.round(withWpm.reduce((a, s) => a + s.wpm, 0) / withWpm.length) : 0,
    bestWpm: withWpm.length ? Math.max.apply(null, withWpm.map(s => s.wpm)) : 0,
    completionRate: Math.round((list.filter(s => s.completed).length / list.length) * 100),
    avgPauses: Math.round((sum(s => s.pauseCount) / list.length) * 10) / 10,
  };
}

/* ── theme ────────────────────────────────────────────────────── */

/**
 * Applies the theme saved by the main page so the library and report
 * pages match whatever the user picked. Safe to call on any page.
 */
function tpApplySavedTheme() {
  const t = tpReadJSON(TP_THEME_KEY, null);
  if (!t) return;
  const root = document.documentElement;
  const vars = { accent: '--accent', accentGlow: '--accent-glow', bg: '--bg',
                 surface: '--surface', surface2: '--surface2', text: '--text' };
  Object.keys(vars).forEach(k => { if (t[k]) root.style.setProperty(vars[k], t[k]); });
  if (t.pageBg) {
    document.body.style.background = t.pageBg;
    document.body.style.backgroundSize = t.pageBgSize || '';
  }
}
