/* ═══════════════════════════════════════════════════════════════
   script-model.js — how a script turns into on-screen lines
   ───────────────────────────────────────────────────────────────
   Replaces the old "one textarea per reader, strict round-robin"
   model, which could not express two consecutive turns for the
   same speaker, silently deleted blank lines, and pushed whole
   paragraphs onto the stage as a single line.

   Now a script is ONE body of text written top to bottom:

       Alice: Good morning.
       Alice: Did you sleep well?
       Bob: Like a log.

       Alice: Glad to hear it.

   Rules
     • "Name:" / "A:" / "1:" at the start of a line sets the speaker.
     • A line with no tag continues whatever speaker was last seen,
       so one person can talk for as long as they like.
     • A blank line is a real pause on stage, not something to strip.
     • A long paragraph is split at sentence boundaries so each
       chunk is comfortable to read aloud.

   Loaded before app.js / library.js, so everything here is global.
   ═══════════════════════════════════════════════════════════════ */

/** Target characters per on-screen line before a paragraph is split. */
const TP_CHUNK_CHARS = 92;

/** Words-per-minute used for reading-aloud estimates. */
const TP_WPM = 130;

/* ── reader identity ──────────────────────────────────────────── */

const TP_READER_LETTERS = ['A', 'B', 'C', 'D'];

function tpDefaultReaders() {
  return [
    { id: 1, name: 'Reader 1', color: '#4FC3F7' },
    { id: 2, name: 'Reader 2', color: '#FFD54F' },
    { id: 3, name: 'Reader 3', color: '#A5D6A7' },
    { id: 4, name: 'Reader 4', color: '#F48FB1' },
  ];
}

function tpNormalizeTag(s) {
  return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Every way a reader may be addressed at the start of a line.
 * Reader 2 named "Bob" answers to: "bob", "b", "2", "reader 2", "r2".
 */
function tpReaderTags(readers) {
  const map = new Map();
  readers.forEach((r, i) => {
    const keys = [
      tpNormalizeTag(r.name),
      tpNormalizeTag(TP_READER_LETTERS[i]),
      String(i + 1),
      'reader ' + (i + 1),
      'r' + (i + 1),
    ];
    keys.forEach(k => { if (k) map.set(k, r.id); });
  });
  return map;
}

/* ── paragraph chunking ───────────────────────────────────────── */

/**
 * Splits `text` into pieces that are pleasant to read aloud.
 * Prefers sentence ends, then clause breaks, then whole words.
 * Never splits mid-word, and never returns an empty piece.
 */
function tpChunkText(text, maxChars) {
  const limit = Math.max(24, maxChars || TP_CHUNK_CHARS);
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= limit) return [clean];

  // Split into sentences first, keeping their terminators.
  const sentences = clean.match(/[^.!?…]+[.!?…]+[)"'”’]*\s*|[^.!?…]+$/g) || [clean];

  const out = [];
  let buffer = '';

  const flush = () => { if (buffer.trim()) out.push(buffer.trim()); buffer = ''; };

  sentences.forEach(raw => {
    const sentence = raw.trim();
    if (!sentence) return;

    // A sentence that fits: pack it with the current buffer if there's room.
    if (sentence.length <= limit) {
      if (!buffer) buffer = sentence;
      else if ((buffer + ' ' + sentence).length <= limit) buffer += ' ' + sentence;
      else { flush(); buffer = sentence; }
      return;
    }

    // Oversized sentence — break it down further.
    flush();
    tpSplitLongSentence(sentence, limit).forEach(part => out.push(part));
  });

  flush();
  return out.length ? out : [clean];
}

/** Breaks one over-long sentence at clause marks, then at word gaps. */
function tpSplitLongSentence(sentence, limit) {
  const pieces = [];
  // Keep clause punctuation attached to the text before it.
  const clauses = sentence.match(/[^,;:—–]+[,;:—–]?\s*/g) || [sentence];
  let buffer = '';

  clauses.forEach(raw => {
    const clause = raw.trim();
    if (!clause) return;
    if (!buffer) buffer = clause;
    else if ((buffer + ' ' + clause).length <= limit) buffer += ' ' + clause;
    else { pieces.push(buffer); buffer = clause; }
  });
  if (buffer) pieces.push(buffer);

  // Anything still too long gets wrapped on word boundaries.
  const out = [];
  pieces.forEach(piece => {
    if (piece.length <= limit) { out.push(piece); return; }
    let line = '';
    piece.split(' ').forEach(word => {
      if (!line) line = word;
      else if ((line + ' ' + word).length <= limit) line += ' ' + word;
      else { out.push(line); line = word; }
    });
    if (line) out.push(line);
  });
  return out;
}

/* ── parsing ──────────────────────────────────────────────────── */

/**
 * Turns script text into a flat list of stage blocks:
 *   { type:'line',  readerId, text, startsTurn }
 *   { type:'pause', size }            // consecutive blank lines
 *
 * `startsTurn` marks the first chunk of a new speaker, which is where
 * the stage draws the speaker's name.
 */
function tpParseScript(body, readers, options) {
  const opts = options || {};
  const list = (readers && readers.length) ? readers : tpDefaultReaders();
  const tags = tpReaderTags(list);
  const validIds = new Set(list.map(r => r.id));
  const fallbackId = list[0].id;
  const limit = opts.maxChars || TP_CHUNK_CHARS;

  const blocks = [];
  let currentReader = null;
  let pendingPause = 0;

  String(body == null ? '' : body).split('\n').forEach(rawLine => {
    const line = rawLine.trim();

    // Blank line → remember it as a pause instead of throwing it away.
    if (!line) { pendingPause++; return; }

    let text = line;
    let readerId = currentReader;
    let explicit = false;

    // "Something: rest" — only treat it as a speaker tag when the token
    // is actually one of this script's readers, so "Note: ..." stays text.
    const m = /^([^:]{1,32}):\s*([\s\S]*)$/.exec(line);
    if (m) {
      const id = tags.get(tpNormalizeTag(m[1]));
      if (id !== undefined) {
        readerId = id;
        text = m[2].trim();
        explicit = true;
      }
    }

    if (readerId == null || !validIds.has(readerId)) readerId = fallbackId;

    // A tag on its own line just switches speaker for what follows.
    if (explicit && !text) {
      currentReader = readerId;
      return;
    }

    const startsTurn = readerId !== currentReader;
    currentReader = readerId;

    if (pendingPause > 0) {
      blocks.push({ type: 'pause', size: Math.min(pendingPause, 3) });
      pendingPause = 0;
    }

    tpChunkText(text, limit).forEach((chunk, i) => {
      blocks.push({
        type: 'line',
        readerId: readerId,
        text: chunk,
        startsTurn: startsTurn && i === 0,
      });
    });
  });

  return blocks;
}

/** Just the spoken lines, in order — what the stage scrolls through. */
function tpScriptLines(body, readers, options) {
  return tpParseScript(body, readers, options);
}

/* ── stats ────────────────────────────────────────────────────── */

/**
 * Totals plus a per-reader breakdown, so each person can see how
 * much they actually speak rather than only the combined figure.
 */
function tpScriptStats(body, readers) {
  const list = (readers && readers.length) ? readers : tpDefaultReaders();
  const blocks = tpParseScript(body, list);

  const per = new Map();
  list.forEach(r => per.set(r.id, { id: r.id, name: r.name, color: r.color, words: 0, lines: 0, seconds: 0 }));

  let words = 0, lines = 0, pauses = 0;

  blocks.forEach(b => {
    if (b.type === 'pause') { pauses += b.size; return; }
    const w = b.text.trim() ? b.text.trim().split(/\s+/).length : 0;
    words += w;
    lines += 1;
    const slot = per.get(b.readerId);
    if (slot) { slot.words += w; slot.lines += 1; }
  });

  per.forEach(slot => { slot.seconds = Math.round((slot.words / TP_WPM) * 60); });

  // Pauses add real time on stage; count roughly a beat each.
  const seconds = Math.round((words / TP_WPM) * 60) + pauses;

  return {
    words: words,
    lines: lines,
    pauses: pauses,
    seconds: seconds,
    perReader: Array.from(per.values()),
    speakingReaderIds: Array.from(per.values()).filter(s => s.lines > 0).map(s => s.id),
  };
}

/* ── colour safety ────────────────────────────────────────────── */

function tpHexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function tpRelativeLuminance(hex) {
  const c = tpHexToRgb(hex);
  if (!c) return 0;
  const f = v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

/** WCAG contrast ratio between two hex colours (1 … 21). */
function tpContrastRatio(a, b) {
  const la = tpRelativeLuminance(a), lb = tpRelativeLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/**
 * Is this colour readable as large text on the stage?
 * 3:1 is the WCAG AA threshold for large text, which script lines are.
 */
function tpIsReadableOnStage(hex, stageHex) {
  return tpContrastRatio(hex, stageHex || '#000000') >= 3;
}

/** Nudges a colour lighter until it clears the contrast threshold. */
function tpBrightenForStage(hex, stageHex) {
  const c = tpHexToRgb(hex);
  if (!c) return hex;
  let { r, g, b } = c;
  for (let i = 0; i < 24; i++) {
    const current = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    if (tpIsReadableOnStage(current, stageHex)) return current;
    r = Math.min(255, Math.round(r + (255 - r) * 0.18) + 6);
    g = Math.min(255, Math.round(g + (255 - g) * 0.18) + 6);
    b = Math.min(255, Math.round(b + (255 - b) * 0.18) + 6);
  }
  return '#ffffff';
}

/** Which active readers share a colour — the only cue for who speaks. */
function tpDuplicateColorGroups(readers, activeCount) {
  const active = (readers || []).slice(0, activeCount || (readers || []).length);
  const byColor = new Map();
  active.forEach(r => {
    const key = String(r.color || '').toLowerCase();
    if (!byColor.has(key)) byColor.set(key, []);
    byColor.get(key).push(r);
  });
  return Array.from(byColor.values()).filter(group => group.length > 1);
}

/** A palette colour not already taken by another active reader. */
function tpSuggestFreeColor(readers, activeCount, palette) {
  const pool = palette && palette.length ? palette : tpDefaultReaders().map(r => r.color);
  const taken = new Set((readers || []).slice(0, activeCount || (readers || []).length)
    .map(r => String(r.color || '').toLowerCase()));
  return pool.find(c => !taken.has(String(c).toLowerCase())) || pool[0];
}

/* ── undo history ─────────────────────────────────────────────── */

const TP_HISTORY_LIMIT = 12;

/**
 * Pushes a snapshot of the script body, newest last.
 * Identical consecutive snapshots are collapsed, and the list is
 * capped so localStorage does not grow without bound.
 */
function tpPushHistory(history, body) {
  const list = Array.isArray(history) ? history.slice() : [];
  const text = String(body == null ? '' : body);
  if (list.length && list[list.length - 1] === text) return list;
  list.push(text);
  while (list.length > TP_HISTORY_LIMIT) list.shift();
  return list;
}

/* ── conversion from the old four-box format ──────────────────── */

/**
 * Rebuilds a speaker-tagged body from the old per-reader textareas,
 * interleaving them exactly the way the old round-robin did so an
 * existing script reads in the same order after upgrading.
 */
function tpBodyFromLegacyTexts(texts, mode, readers) {
  const list = (readers && readers.length) ? readers : tpDefaultReaders();
  const count = Math.min(Math.max(parseInt(mode) || 1, 1), list.length);

  const buckets = [];
  for (let i = 1; i <= count; i++) {
    const raw = (texts && texts[i]) || '';
    buckets.push(raw.split('\n').map(l => l.trim()).filter(l => l.length > 0));
  }
  if (!buckets.length) return '';

  // Single reader: keep the text as written, no tags needed.
  if (count === 1) return ((texts && texts[1]) || '').trim();

  const rounds = Math.max.apply(null, buckets.map(b => b.length).concat([0]));
  const out = [];
  for (let r = 0; r < rounds; r++) {
    buckets.forEach((lines, idx) => {
      if (r < lines.length) out.push(list[idx].name + ': ' + lines[r]);
    });
  }
  return out.join('\n');
}

/* ── export / import text format ──────────────────────────────── */

/**
 * A .txt that can be read back by tpParseScriptFile, so downloading
 * and re-importing a multi-reader script keeps its readers.
 */
function tpScriptToFile(script) {
  const readers = (script.readers && script.readers.length) ? script.readers : tpDefaultReaders();
  const count = Math.min(Math.max(parseInt(script.mode) || 1, 1), readers.length);
  const head = ['# Teleprompt script', '# name: ' + (script.name || 'Untitled script')];
  for (let i = 0; i < count; i++) {
    head.push('# reader' + (i + 1) + ': ' + readers[i].name + ' | ' + readers[i].color);
  }
  head.push('');
  return head.join('\n') + (script.body || '');
}

/**
 * Parses a file written by tpScriptToFile. Plain .txt files without
 * the header still work — they simply become a one-reader script.
 */
function tpParseScriptFile(text, fallbackName) {
  const lines = String(text == null ? '' : text).split('\n');
  const readers = tpDefaultReaders();
  let name = fallbackName || 'Imported script';
  let mode = 1;
  let i = 0;
  let sawHeader = false;

  while (i < lines.length && /^\s*#/.test(lines[i])) {
    const line = lines[i];
    const nm = /^\s*#\s*name:\s*(.+)$/i.exec(line);
    const rd = /^\s*#\s*reader\s*(\d)\s*:\s*([^|]+)(?:\|\s*(#[0-9a-f]{6}))?\s*$/i.exec(line);
    if (nm) { name = nm[1].trim() || name; sawHeader = true; }
    if (rd) {
      const idx = parseInt(rd[1]) - 1;
      if (idx >= 0 && idx < readers.length) {
        readers[idx].name = rd[2].trim() || readers[idx].name;
        if (rd[3]) readers[idx].color = rd[3].trim();
        mode = Math.max(mode, idx + 1);
        sawHeader = true;
      }
    }
    i++;
  }

  // Drop one blank separator line after the header.
  if (sawHeader && i < lines.length && !lines[i].trim()) i++;

  const body = lines.slice(i).join('\n').replace(/\s+$/, '');

  // No header but speaker tags present? Recover the reader count.
  if (!sawHeader) {
    const tags = tpReaderTags(readers);
    let highest = 1;
    body.split('\n').forEach(l => {
      const m = /^([^:]{1,32}):\s*/.exec(l.trim());
      if (!m) return;
      const id = tags.get(tpNormalizeTag(m[1]));
      if (id) highest = Math.max(highest, id);
    });
    mode = highest;
  }

  return { name: name, body: body, readers: readers, mode: mode };
}
