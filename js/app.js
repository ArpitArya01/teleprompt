
// ── FONT PICKER ──
const fonts = [
  { name: 'Syne',            family: "'Syne', sans-serif",            preview: 'Aa', weight: '700' },
  { name: 'Playfair',        family: "'Playfair Display', serif",      preview: 'Aa', weight: '700' },
  { name: 'Bebas',           family: "'Bebas Neue', cursive",          preview: 'Aa', weight: '400' },
  { name: 'Oswald',          family: "'Oswald', sans-serif",           preview: 'Aa', weight: '600' },
  { name: 'Lora',            family: "'Lora', serif",                  preview: 'Aa', weight: '600' },
  { name: 'Rajdhani',        family: "'Rajdhani', sans-serif",         preview: 'Aa', weight: '700' },
  { name: 'Righteous',       family: "'Righteous', cursive",           preview: 'Aa', weight: '400' },
  { name: 'Abril Fatface',   family: "'Abril Fatface', cursive",       preview: 'Aa', weight: '400' },
  { name: 'Space Grotesk',   family: "'Space Grotesk', sans-serif",    preview: 'Aa', weight: '700' },
  { name: 'Mono',            family: "'JetBrains Mono', monospace",    preview: 'Aa', weight: '500' },
];

let currentFont = fonts[0].family;

function buildFontGrid() {
  const grid = document.getElementById('fontGrid');
  grid.innerHTML = '';
  fonts.forEach((f, i) => {
    const btn = document.createElement('button');
    btn.className = 'font-btn' + (i === 0 ? ' active' : '');
    btn.innerHTML = `
      <span class="font-btn-preview" style="font-family:${f.family};font-weight:${f.weight}">${f.preview}</span>
      <span class="font-btn-name">${f.name}</span>
    `;
    btn.onclick = () => {
      document.querySelectorAll('.font-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFont = f.family;
      // Update all existing tp-lines
      document.querySelectorAll('.tp-line').forEach(el => el.style.fontFamily = currentFont);
      if (launched) rebuildLines(true);
    };
    grid.appendChild(btn);
  });
}
buildFontGrid();

// ── BACKGROUND PARTICLES ──
(function() {
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      o: Math.random() * 0.4 + 0.1,
    });
  }

  function drawParticles() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(124,111,255,${p.o})`;
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
    });
    requestAnimationFrame(drawParticles);
  }
  drawParticles();
})();

// ── STATE ──
const MAX_READERS = 4;
let mode = 1;
let readers = tpDefaultReaders();
let fontSize = 36;
let speed = 50;
let running = false;
let launched = false;
let looping = false;
let currentY = 0;
let pausedAt = 0;
let totalScroll = 0;
let startTime = null;
let animId = null;

const stageEl      = document.getElementById('stage');
const track        = document.getElementById('scrollTrack');
const progressFill = document.getElementById('progressFill');
const playIcon     = document.getElementById('playIcon');
const playLabel    = document.getElementById('playLabel');
const controlsBar  = document.getElementById('controlsBar');
const stageHint    = document.getElementById('stageHint');
const pauseBadge   = document.getElementById('pauseBadge');
const completeScreen = document.getElementById('completeScreen');

// ── COLOR PALETTES ──
const palette = ['#4FC3F7','#FFD54F','#A5D6A7','#F48FB1','#CE93D8','#FFFFFF','#FF8A65','#80DEEA','#69ff91','#ffb347','#ff6b9d','#7c6fff'];

/** The readers this script is actually using. */
function activeReaders() {
  return readers.slice(0, Math.min(mode, readers.length));
}

function readerById(id) {
  return readers.find(r => r.id === id) || readers[0];
}

/** The stage's own background colour, for contrast checks. */
function stageBackdropHex() {
  const inline = (stageEl.style.background || '').trim();
  const m = /^#([0-9a-fA-F]{6})$/.exec(inline);
  if (m) return inline;
  const rgb = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(inline);
  if (rgb) {
    return '#' + [rgb[1], rgb[2], rgb[3]]
      .map(v => parseInt(v).toString(16).padStart(2, '0')).join('');
  }
  return '#121022';   // the default dusk stage is dark
}

/**
 * Builds the reader chips: letter tag, editable name, speaking share and
 * colour picker. Replaces the old four reader cards.
 */
function renderReaders() {
  const wrap = document.getElementById('readersList');
  if (!wrap) return;

  const stats = tpScriptStats(scriptBodyValue(), activeReaders());
  const perId = new Map(stats.perReader.map(p => [p.id, p]));
  const dupes = tpDuplicateColorGroups(readers, mode);
  const dupeIds = new Set();
  dupes.forEach(g => g.forEach(r => dupeIds.add(r.id)));

  wrap.innerHTML = '';
  activeReaders().forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'reader-chip' + (dupeIds.has(r.id) ? ' has-warning' : '');

    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.style.background = r.color;
    tag.textContent = TP_READER_LETTERS[i];
    tag.title = 'Start a line with "' + TP_READER_LETTERS[i] + ':" or "' + r.name + ':"';

    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'reader-name';
    name.value = r.name;
    name.maxLength = 24;
    name.setAttribute('aria-label', 'Name for reader ' + (i + 1));
    name.addEventListener('input', () => setReaderName(r.id, name.value));

    const stat = document.createElement('span');
    stat.className = 'chip-stat';
    const p = perId.get(r.id);
    stat.textContent = p ? p.words + 'w · ' + tpFormatDuration(p.seconds) : '0w · 0:00';

    const color = document.createElement('input');
    color.type = 'color';
    color.className = 'reader-color';
    color.value = /^#[0-9a-fA-F]{6}$/.test(r.color) ? r.color : '#ffffff';
    color.title = 'Text colour for ' + r.name;
    color.setAttribute('aria-label', 'Colour for ' + r.name);
    color.addEventListener('input', () => setReaderColor(r.id, color.value));

    row.appendChild(tag);
    row.appendChild(name);
    row.appendChild(stat);
    row.appendChild(color);
    wrap.appendChild(row);
  });

  // Mode 1 needs no speaker tags at all; multi-reader mode explains them.
  const how = document.getElementById('scriptHowTo');
  if (how) {
    how.innerHTML = mode === 1
      ? 'Write top to bottom. Blank line = pause. Long paragraphs split automatically.'
      : 'Tag lines with <code>' + tpEscape(activeReaders()[0].name) +
        ':</code> or <code>A:</code>. Untagged lines continue the same speaker.';
  }

  renderScriptWarnings(stats, dupes);
}

function setReaderName(id, value) {
  const r = readerById(id);
  if (!r) return;
  r.name = String(value || '').trim() || ('Reader ' + id);
  if (launched) rebuildLines(true);
  markUnsaved();
  updateWordCount();
}

/** Single entry point for changing a reader's text colour. */
function setReaderColor(id, hex) {
  const r = readerById(id);
  if (!r) return;
  r.color = hex;
  if (launched) rebuildLines(true);
  renderReaders();
  markUnsaved();
}

/**
 * Surfaces the three things that used to fail silently:
 * two readers sharing a colour, a colour too dark to read on the
 * stage, and lines tagged for a reader that the current mode hides.
 */
function renderScriptWarnings(stats, dupes) {
  const box = document.getElementById('scriptWarnings');
  if (!box) return;
  box.innerHTML = '';

  const add = (html, actionLabel, onAction) => {
    const el = document.createElement('div');
    el.className = 'warn';
    el.innerHTML = html;
    if (actionLabel) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = actionLabel;
      b.addEventListener('click', onAction);
      el.appendChild(b);
    }
    box.appendChild(el);
  };

  // 1. duplicate colours — colour is the only on-stage cue
  dupes.forEach(group => {
    const names = group.map(r => tpEscape(r.name)).join(' and ');
    add('<span><b>' + names + '</b> share the same colour, so you will not be able to tell them apart on stage.</span>',
      'Fix colours', () => {
        group.slice(1).forEach(r => { r.color = tpSuggestFreeColor(readers, mode, palette); });
        renderReaders();
        if (launched) rebuildLines(true);
        markUnsaved();
      });
  });

  // 2. unreadable colour against the stage
  const backdrop = stageBackdropHex();
  activeReaders().forEach(r => {
    if (tpIsReadableOnStage(r.color, backdrop)) return;
    add('<span><b>' + tpEscape(r.name) + '</b>\u2019s colour is too dark for this background (' +
        tpContrastRatio(r.color, backdrop) + ':1) and will be hard to read.</span>',
      'Brighten', () => {
        r.color = tpBrightenForStage(r.color, backdrop);
        renderReaders();
        if (launched) rebuildLines(true);
        markUnsaved();
      });
  });

  // 3. lines tagged for a reader the current mode hides
  if (mode < MAX_READERS) {
    const hidden = tpScriptStats(scriptBodyValue(), readers)
      .perReader.filter(p => p.id > mode && p.lines > 0);
    if (hidden.length) {
      const names = hidden.map(p => tpEscape(p.name)).join(', ');
      const needed = Math.max.apply(null, hidden.map(p => p.id));
      add('<span><b>' + names + '</b> ' + (hidden.length === 1 ? 'has' : 'have') +
          ' tagged lines but ' + (hidden.length === 1 ? 'is' : 'are') +
          ' switched off, so those lines are read by ' + tpEscape(readers[0].name) + '.</span>',
        'Use ' + needed + ' readers', () => setMode(needed));
    }
  }
}

// ── MODE ──
function setMode(m) {
  mode = Math.min(MAX_READERS, Math.max(1, parseInt(m) || 1));
  for (let i = 1; i <= MAX_READERS; i++) {
    const btn = document.getElementById('mode' + i + 'Btn');
    if (btn) btn.classList.toggle('active', mode === i);
  }
  // Nothing is hidden any more — the script is one body of text, so changing
  // the reader count can't look like it threw your writing away.
  renderReaders();
  updateWordCount();
  if (launched) rebuildLines(true);
}

// ── SLIDERS ──
function updateFont() {
  fontSize = parseInt(document.getElementById('fontSlider').value);
  document.getElementById('fontVal').textContent = fontSize + 'px';
  if (launched) rebuildLines(true);
}
function updateSpeed() {
  speed = parseInt(document.getElementById('speedSlider').value);
  document.getElementById('speedValLeft').textContent = speed;
  document.getElementById('speedCtrl').value = speed;
  document.getElementById('speedNum').textContent = speed;
  if (running) { pausedAt = currentY; startTime = null; }
}
function syncSpeed(v) {
  speed = parseInt(v);
  document.getElementById('speedNum').textContent = speed;
  document.getElementById('speedSlider').value = speed;
  document.getElementById('speedValLeft').textContent = speed;
  if (running) { pausedAt = currentY; startTime = null; }
}

// ── GET LINES ──
/** Current text of the single script editor. */
function scriptBodyValue() {
  const el = document.getElementById('scriptBody');
  return el ? el.value : '';
}

/**
 * The stage blocks for the current script.
 * Order now comes straight from what you wrote, so a reader can take
 * as many consecutive turns as they like, blank lines survive as
 * pauses, and long paragraphs arrive pre-split.
 */
function getLines() {
  return tpParseScript(scriptBodyValue(), activeReaders());
}

// ── BUILD LINES ──
function rebuildLines(preservePosition) {
  cancelAnimationFrame(animId);
  animId = null;
  const wasRunning = running;
  running = false;

  const savedRatio = (preservePosition && totalScroll > 0) ? currentY / totalScroll : 0;
  const stageH = stageEl.offsetHeight;

  track.innerHTML = '';

  const lead = document.createElement('div');
  lead.style.cssText = `height:${stageH}px;flex-shrink:0;`;
  track.appendChild(lead);

  const blocks = getLines();
  const multi = mode > 1;

  if (blocks.length === 0) {
    const msg = document.createElement('div');
    msg.style.cssText = 'color:rgba(255,255,255,.25);font-size:18px;text-align:center;padding:48px 0;width:100%;font-weight:600;letter-spacing:.04em;';
    msg.textContent = 'No script yet — add text on the left.';
    track.appendChild(msg);
  } else {
    blocks.forEach(b => {
      // A blank line in the script becomes real breathing room, with a
      // visible marker so you know a pause is coming.
      if (b.type === 'pause') {
        const gap = document.createElement('div');
        gap.className = 'tp-pause';
        gap.style.height = Math.round(fontSize * 0.9 * b.size) + 'px';
        gap.innerHTML = '<i></i><i></i><i></i>';
        track.appendChild(gap);
        return;
      }

      const reader = readerById(b.readerId);

      // Name the speaker at the start of each turn — colour alone leaves
      // a reader guessing once the editor is out of sight.
      if (multi && b.startsTurn) {
        const label = document.createElement('div');
        label.className = 'tp-speaker';
        label.style.color = reader.color;
        label.style.fontSize = Math.max(11, Math.round(fontSize * 0.34)) + 'px';
        label.textContent = reader.name;
        track.appendChild(label);
      }

      const div = document.createElement('div');
      div.className = 'tp-line';
      div.style.color = reader.color;
      div.style.fontSize = fontSize + 'px';
      div.style.fontFamily = currentFont;
      div.textContent = b.text;
      if (highlightMode) div.classList.add('clickable');
      div.addEventListener('click', () => {
        if (!launched || !highlightMode) return;
        jumpToLine(div);
      });
      track.appendChild(div);
    });
  }

  const trail = document.createElement('div');
  trail.style.cssText = `height:${stageH}px;flex-shrink:0;`;
  track.appendChild(trail);

  totalScroll = track.scrollHeight - stageH;

  if (preservePosition && savedRatio > 0) {
    currentY = Math.round(savedRatio * totalScroll);
    pausedAt = currentY;
  } else {
    currentY = 0;
    pausedAt = 0;
  }
  startTime = null;
  applyScroll();

  if (wasRunning) {
    running = true;
    setPlayUI(true);
    animId = requestAnimationFrame(animate);
  }
}

function applyScroll() {
  track.style.transform = `translateY(-${currentY}px)`;
  const pct = totalScroll > 0 ? (currentY / totalScroll) * 100 : 0;
  progressFill.style.width = Math.round(pct) + '%';
  if (!isScrubbing && typeof scrubBar !== 'undefined' && scrubBar) {
    scrubBar.value = pct;
    if (scrubPct) scrubPct.textContent = Math.round(pct) + '%';
  }
  highlightActiveLine();
}

// ── ACTIVE LINE HIGHLIGHT ──
let lastActiveEl = null;
function highlightActiveLine() {
  if (!launched) return;
  const stageH = stageEl.offsetHeight;
  const centerY = currentY + stageH / 2;
  const lines = track.querySelectorAll('.tp-line');
  let closestEl = null, closestDist = Infinity, closestIdx = -1;
  lines.forEach((el, i) => {
    const elTop = el.offsetTop;
    const elMid = elTop + el.offsetHeight / 2;
    const dist = Math.abs(elMid - centerY);
    if (dist < closestDist) { closestDist = dist; closestEl = el; closestIdx = i; }
  });
  if (closestEl !== lastActiveEl) {
    if (lastActiveEl) lastActiveEl.classList.remove('active-line');
    if (closestEl && closestDist < fontSize * 1.5) {
      closestEl.classList.add('active-line');
    }
    lastActiveEl = closestEl;
  }
}

function setPlayUI(playing) {
  if (playing) {
    playIcon.innerHTML = '<rect x="1" y="1" width="4" height="11"/><rect x="8" y="1" width="4" height="11"/>';
    playLabel.textContent = 'Pause';
    pauseBadge.classList.remove('visible');
  } else {
    playIcon.innerHTML = '<path d="M2 1.5l9 5-9 5V1.5z"/>';
    playLabel.textContent = 'Play';
  }
}

// ── COUNTDOWN ──
let countdownActive = false;

function runCountdown(callback) {
  const overlay = document.getElementById('countdownOverlay');
  const numEl   = document.getElementById('countdownNum');
  const ringEl  = document.getElementById('countdownRing');
  countdownActive = true;
  overlay.classList.add('active');

  let count = 3;
  function tick() {
    numEl.textContent = count;
    // restart animations
    numEl.classList.remove('pop');
    ringEl.classList.remove('spin');
    void numEl.offsetWidth;
    numEl.classList.add('pop');
    ringEl.classList.add('spin');

    if (count > 1) {
      count--;
      setTimeout(tick, 900);
    } else {
      setTimeout(() => {
        overlay.classList.remove('active');
        countdownActive = false;
        callback();
      }, 900);
    }
  }
  tick();
}

// ── LAUNCH ──
function launchStage() {
  launched = true;
  completeScreen.classList.remove('visible');
  stageHint.style.display = 'none';
  controlsBar.style.display = 'flex';

  // Show voice indicator (voice is always on by default)

  rebuildLines(false);

  // Flash animation
  const overlay = document.getElementById('launchOverlay');
  const flash   = document.getElementById('launchFlash');
  overlay.classList.add('active');
  flash.style.animation = 'none';
  flash.offsetHeight;
  flash.style.animation = 'launchFlash 0.6s ease-out forwards';
  setTimeout(() => {
    overlay.classList.remove('active');
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.classList.remove('fade-out'), 600);
  }, 300);

  // Countdown then play
  setTimeout(() => {
    runCountdown(() => startPlay());
  }, 200);
}

// ── HIGHLIGHT / JUMP MODE ──
let highlightMode = false;

function toggleHighlightMode() {
  highlightMode = !highlightMode;
  const btn = document.getElementById('highlightBtn');
  const hint = document.getElementById('jumpHint');
  if (btn) btn.classList.toggle('active', highlightMode);
  if (hint) hint.classList.toggle('visible', highlightMode);
  setLineClickable(highlightMode);
  if (highlightMode && running) {
    running = false;
    cancelAnimationFrame(animId);
    pausedAt = currentY;
    setPlayUI(false);
    pauseBadge.classList.add('visible');
  }
}

function setLineClickable(on) {
  track.querySelectorAll('.tp-line').forEach(el => {
    el.classList.toggle('clickable', on);
  });
}

function jumpToLine(lineEl) {
  const stageH = stageEl.offsetHeight;
  const lineTop = lineEl.offsetTop;
  const lineMid = lineEl.offsetHeight / 2;
  // we want this line at center: currentY = lineTop + lineMid - stageH/2
  const target = Math.max(0, Math.min(lineTop + lineMid - stageH / 2, totalScroll));

  // Animate scroll jump
  const from = currentY;
  const dist = target - from;
  const dur  = Math.min(600, Math.max(200, Math.abs(dist) * 0.8));
  const t0   = performance.now();

  function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

  cancelAnimationFrame(animId);
  function jumpAnim(now) {
    const p = Math.min(1, (now - t0) / dur);
    currentY = from + dist * easeInOut(p);
    pausedAt = currentY;
    applyScroll();
    if (p < 1) {
      animId = requestAnimationFrame(jumpAnim);
    } else {
      currentY = target;
      pausedAt = target;
      applyScroll();
      // flash the line
      lineEl.classList.add('jump-target');
      setTimeout(() => lineEl.classList.remove('jump-target'), 500);
    }
  }
  animId = requestAnimationFrame(jumpAnim);
}

// ── PLAY / PAUSE ──
function startPlay() {
  if (currentY >= totalScroll) {
    currentY = 0; pausedAt = 0; startTime = null;
    applyScroll();
    completeScreen.classList.remove('visible');
  }
  running = true;
  setPlayUI(true);
  startTime = null;
  animId = requestAnimationFrame(animate);
}

function animate(ts) {
  if (!running) return;
  if (!startTime) startTime = ts - (pausedAt / speed) * 1000;
  currentY = ((ts - startTime) / 1000) * speed;
  if (currentY >= totalScroll) {
    currentY = totalScroll;
    applyScroll();

    if (looping) {
      // Seamlessly jump back to the top and keep rolling.
      endSession(true);          // bank the lap that just finished
      currentY = 0;
      pausedAt = 0;
      startTime = null;
      applyScroll();
      beginSession();            // and start timing the next one
      animId = requestAnimationFrame(animate);
      return;
    }

    running = false;
    setPlayUI(false);
    endSession(true);
    // Show completion screen
    setTimeout(() => completeScreen.classList.add('visible'), 300);
    return;
  }
  applyScroll();
  animId = requestAnimationFrame(animate);
}

/**
 * Jump back to the top and play again without leaving the stage.
 * Previously the only way to re-read a script was "Edit Script" -> Start.
 */
function restartPlay() {
  if (!launched) return;
  cancelAnimationFrame(animId);
  animId = null;
  running = false;
  completeScreen.classList.remove('visible');
  pauseBadge.classList.remove('visible');
  currentY = 0;
  pausedAt = 0;
  startTime = null;
  resetTimer();
  // Pick up any script/colour/font edits made since the last run.
  rebuildLines(false);
  startPlay();
}

function toggleLoop() {
  looping = !looping;
  const btn = document.getElementById('loopBtn');
  if (btn) btn.classList.toggle('active', looping);
  showSavedToast(looping ? 'Loop on ↻' : 'Loop off');
  // If the script already finished, turning loop on starts it over.
  if (looping && launched && !running) restartPlay();
}

function togglePlay() {
  if (!launched) return;
  if (running) {
    running = false;
    cancelAnimationFrame(animId);
    pausedAt = currentY;
    setPlayUI(false);
    pauseBadge.classList.add('visible');
  } else {
    pauseBadge.classList.remove('visible');
    startPlay();
  }
}

// ── RESET ──
function resetStage() {
  running = false;
  cancelAnimationFrame(animId);
  animId = null;
  launched = false;
  track.innerHTML = '';
  currentY = 0; pausedAt = 0; totalScroll = 0; startTime = null;
  progressFill.style.width = '0%';
  controlsBar.style.display = 'none';
  stageHint.style.display = 'flex';
  pauseBadge.classList.remove('visible');
  completeScreen.classList.remove('visible');
  setPlayUI(false);
  const sb = document.getElementById('scrubBar');
  const sp = document.getElementById('scrubPct');
  if (sb) sb.value = 0;
  if (sp) sp.textContent = '0%';
}

// ── KEYBOARD ──
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'Space' && launched) { e.preventDefault(); if (highlightMode) { toggleHighlightMode(); } else { togglePlay(); } }
  // Arrow keys to nudge speed
  if (e.code === 'ArrowUp' && launched) {
    speed = Math.min(160, speed + 5);
    syncSpeed(speed);
  }
  if (e.code === 'ArrowDown' && launched) {
    speed = Math.max(10, speed - 5);
    syncSpeed(speed);
  }
});

// ── TAP STAGE ──
stageEl.addEventListener('click', e => {
  if (!launched || e.target.closest('.controls-bar') || e.target.closest('.complete-screen')) return;
  if (highlightMode && e.target.classList.contains('tp-line')) return;
  if (highlightMode) { toggleHighlightMode(); return; }
  togglePlay();
});

// ── SCRUB BAR ──
let isScrubbing = false;
const scrubBar = document.getElementById('scrubBar');
const scrubPct = document.getElementById('scrubPct');

function scrubTo(val) {
  if (!launched || totalScroll === 0) return;
  isScrubbing = true;
  const wasRunning = running;
  if (running) {
    running = false;
    cancelAnimationFrame(animId);
  }
  currentY = (val / 100) * totalScroll;
  pausedAt = currentY;
  startTime = null;
  applyScroll();
  scrubPct.textContent = Math.round(val) + '%';
  // Resume if was running
  if (wasRunning) {
    setTimeout(() => {
      isScrubbing = false;
      running = true;
      setPlayUI(true);
      animId = requestAnimationFrame(animate);
    }, 100);
  } else {
    isScrubbing = false;
  }
}



// ── WHEEL SCROLL ON STAGE ──
stageEl.addEventListener('wheel', e => {
  if (!launched) return;
  e.preventDefault();
  const wasRunning = running;
  if (running) {
    running = false;
    cancelAnimationFrame(animId);
  }
  currentY = Math.max(0, Math.min(totalScroll, currentY + e.deltaY * 1.5));
  pausedAt = currentY;
  startTime = null;
  applyScroll();
  if (wasRunning) {
    running = true;
    setPlayUI(true);
    animId = requestAnimationFrame(animate);
  }
}, { passive: false });

// ── FULLSCREEN ──
let isFullscreen = false;
const fsIcon = document.getElementById('fsIcon');
const fsLabel = document.getElementById('fsLabel');
const fsBtnLabel = document.getElementById('fsBtnLabel');
const fullscreenTopBtn = document.getElementById('fullscreenTopBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');

function toggleFullscreen() {
  if (!isFullscreen) {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
  }
}

document.addEventListener('fullscreenchange', updateFsUI);
document.addEventListener('webkitfullscreenchange', updateFsUI);
document.addEventListener('mozfullscreenchange', updateFsUI);

function updateFsUI() {
  isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
  const exitSVG = '<path d="M4 1v3H1M8 1v3h3M4 11v-3H1M8 11v-3h3"/>';
  const enterSVG = '<path d="M1 1h3.5V2.5H2.5V5H1zm5.5 0H10v3.5H8.5V2.5H6.5zm-5.5 6H2.5v1.5H5V10H1zm7.5 0H10V10H6.5V8.5H8.5z"/>';
  if (fsIcon) fsIcon.innerHTML = isFullscreen ? exitSVG : enterSVG;
  if (fsLabel) fsLabel.textContent = isFullscreen ? 'Exit Full' : 'Fullscreen';
  if (fsBtnLabel) fsBtnLabel.textContent = isFullscreen ? 'Exit' : 'Full';
  if (fullscreenTopBtn) fullscreenTopBtn.classList.toggle('active', isFullscreen);
  if (fullscreenBtn) fullscreenBtn.classList.toggle('active', isFullscreen);
}

// ── BACKGROUND COLOR & WALLPAPER ──
const bgColors = [
  '#000000','#0a0a1a','#0d1117','#0f1923',
  '#1a0a2e','#0a1a2e','#0a2e1a','#2e1a0a',
  '#1a1a1a','#ffffff','#1a0000','#001a1a',
];
const wallpapers = [
  { label:'Stars',   css:'radial-gradient(ellipse at 20% 50%,#1a0a3e 0%,#000 60%),url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'%3E%3Ccircle cx=\'10\' cy=\'20\' r=\'1\' fill=\'white\' opacity=\'.6\'/%3E%3Ccircle cx=\'50\' cy=\'80\' r=\'.8\' fill=\'white\' opacity=\'.5\'/%3E%3Ccircle cx=\'90\' cy=\'30\' r=\'1.2\' fill=\'white\' opacity=\'.7\'/%3E%3Ccircle cx=\'140\' cy=\'60\' r=\'.9\' fill=\'white\' opacity=\'.4\'/%3E%3Ccircle cx=\'170\' cy=\'10\' r=\'1\' fill=\'white\' opacity=\'.6\'/%3E%3Ccircle cx=\'30\' cy=\'150\' r=\'.8\' fill=\'white\' opacity=\'.5\'/%3E%3Ccircle cx=\'120\' cy=\'140\' r=\'1\' fill=\'white\' opacity=\'.6\'/%3E%3Ccircle cx=\'160\' cy=\'120\' r=\'.7\' fill=\'white\' opacity=\'.4\'/%3E%3Ccircle cx=\'80\' cy=\'170\' r=\'1.1\' fill=\'white\' opacity=\'.5\'/%3E%3Ccircle cx=\'190\' cy=\'180\' r=\'.9\' fill=\'white\' opacity=\'.6\'/%3E%3C/svg%3E")' },
  { label:'Sunset',  css:'linear-gradient(160deg,#0f0c29,#302b63,#24243e)' },
  { label:'Ocean',   css:'linear-gradient(180deg,#0f2027,#203a43,#2c5364)' },
  { label:'Forest',  css:'linear-gradient(160deg,#0f1e0f,#1a3a1a,#0d2b0d)' },
  { label:'Fire',    css:'linear-gradient(160deg,#1a0000,#3a0a00,#1a0a00)' },
  { label:'Aurora',  css:'linear-gradient(160deg,#001a2e,#003322,#1a0033,#000d1a)' },
];

const stageEl2 = document.getElementById('stage');

function buildBgSwatches() {
  const wrap = document.getElementById('bgSwatches');
  bgColors.forEach((c, i) => {
    const s = document.createElement('div');
    s.className = 'bg-swatch' + (i === 0 ? ' active' : '');
    s.style.background = c;
    s.style.border = c === '#ffffff' ? '2px solid #555' : '';
    s.title = c;
    s.onclick = () => {
      document.querySelectorAll('.bg-swatch').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.wp-thumb').forEach(x => x.classList.remove('active'));
      s.classList.add('active');
      stageEl2.style.background = c;
      stageEl2.style.backgroundSize = '';
      saveTheme();
    };
    wrap.appendChild(s);
  });

  // Custom color picker
  const picker = document.getElementById('bgCustomColor');
  picker.oninput = () => {
    document.querySelectorAll('.bg-swatch').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.wp-thumb').forEach(x => x.classList.remove('active'));
    stageEl2.style.background = picker.value;
    saveTheme();
  };
}

function buildWpGrid() {
  const grid = document.getElementById('wpGrid');
  wallpapers.forEach(wp => {
    const t = document.createElement('div');
    t.className = 'wp-thumb';
    t.title = wp.label;
    t.style.background = wp.css;
    t.onclick = () => {
      document.querySelectorAll('.bg-swatch').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.wp-thumb').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      stageEl2.style.background = wp.css;
      stageEl2.style.backgroundSize = 'cover';
      saveTheme();
    };
    grid.appendChild(t);
  });
}

function resetBg() {
  document.querySelectorAll('.bg-swatch').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.wp-thumb').forEach(x => x.classList.remove('active'));
  document.querySelector('.bg-swatch').classList.add('active');
  stageEl2.style.background = '#000000';
  stageEl2.style.backgroundSize = '';
  saveTheme();
}

buildBgSwatches();
buildWpGrid();

// F key shortcut for fullscreen
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'KeyF') toggleFullscreen();
  if (e.code === 'KeyM') toggleMirror();
  if (e.code === 'KeyR' && launched) restartPlay();   // restart from the top
  if (e.code === 'KeyE' && launched) resetStage();    // back to editing
  if (e.code === 'KeyL' && launched) toggleLoop();
  if (e.code === 'KeyJ' && launched) toggleHighlightMode();
});

// ── MIRROR MODE ──
let mirrored = false;
function toggleMirror() {
  mirrored = !mirrored;
  stageEl.classList.toggle('mirrored', mirrored);
  const btn = document.getElementById('mirrorBtn');
  if (btn) btn.classList.toggle('active', mirrored);
}

// ── WORD COUNT & READING TIME ──
function updateWordCount() {
  const stats = tpScriptStats(scriptBodyValue(), activeReaders());

  const wcWords = document.getElementById('wcWords');
  const wcLines = document.getElementById('wcLines');
  const wcTime  = document.getElementById('wcTime');
  if (wcWords) wcWords.textContent = stats.words;
  // "Lines" now means on-screen lines, which is what actually scrolls past.
  if (wcLines) wcLines.textContent = stats.lines;
  if (wcTime)  wcTime.textContent = tpFormatDuration(stats.seconds);

  renderPerReaderStats(stats);
  return stats;
}

/** The combined total hides how long any one reader actually speaks. */
function renderPerReaderStats(stats) {
  const box = document.getElementById('perReaderStats');
  if (!box) return;
  box.innerHTML = '';

  // Only worth showing when more than one person is reading.
  if (mode < 2) return;

  stats.perReader.forEach(p => {
    const share = stats.words > 0 ? Math.round((p.words / stats.words) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'per-reader-row';
    row.innerHTML = '<i></i><span class="nm"></span><span class="vals"></span>';
    const dot = row.querySelector('i');
    dot.style.background = p.color;
    dot.style.color = p.color;
    row.querySelector('.nm').textContent = p.name;
    row.querySelector('.vals').textContent =
      p.words + 'w · ' + p.lines + 'L · ' + tpFormatDuration(p.seconds) + ' · ' + share + '%';
    box.appendChild(row);
  });
}

(function wireScriptEditor() {
  const area = document.getElementById('scriptBody');
  if (!area) return;

  area.addEventListener('input', () => {
    updateWordCount();
    renderReaders();
    markUnsaved();
    if (launched) scheduleLiveRebuild();
  });
})();

/* ── save state badge ────────────────────────────────────────────
   Nothing is written to storage until you ask for it, so the badge
   under the box is the single source of truth: Unsaved means the
   text on screen is newer than the copy in the library. */

/** True when the editor holds changes that are not in storage yet. */
let scriptDirty = false;

function markUnsaved() {
  scriptDirty = true;
  const b = document.getElementById('saveState');
  if (b) {
    b.textContent = 'Unsaved';
    b.classList.add('dirty');
    b.title = 'Press “Save script” (or Ctrl+S) to keep these changes';
  }
  const btn = document.getElementById('saveNowBtn');
  if (btn) btn.classList.add('needs-save');
}

function markSaved() {
  scriptDirty = false;
  const b = document.getElementById('saveState');
  if (b) {
    b.textContent = 'Saved';
    b.classList.remove('dirty');
    b.title = 'This script matches what is stored';
  }
  const btn = document.getElementById('saveNowBtn');
  if (btn) btn.classList.remove('needs-save');
}

/**
 * The one and only write of the script you are editing.
 * Called from the Save button, Ctrl+S, and the unsaved-changes guard —
 * never on a timer, so nothing is stored until you ask for it.
 */
function saveScriptNow() {
  if (!activeScriptId) return;

  // Snapshot the version being replaced, so Undo returns to it.
  const previous = tpGetActiveScript();
  if (previous && previous.body !== scriptBodyValue()) {
    const next = tpPushHistory(previous.history, previous.body);
    if (next !== previous.history) tpUpdateScript(activeScriptId, { history: next });
  }

  saveScripts();
  refreshUndoButton();
  markSaved();
  showSavedToast('Saved to “' + activeScriptName() + '” ✓');
}

/* ── make a new script without leaving the editor ─────────────── */

function createNewScript() {
  // Switching away would drop whatever is in the box, so ask first.
  guardUnsaved('Starting a new script', () => {
    openNameModal('New script', suggestScriptName('Untitled script'), name => {
      const created = tpAddScript(tpMakeScript(name, '', mode, readers));
      activeScriptId = created.id;
      tpSetActiveScript(created.id);

      const area = document.getElementById('scriptBody');
      if (area) { area.value = ''; area.focus(); }

      renderCurrentScriptName();
      renderReaders();
      updateWordCount();
      refreshUndoButton();
      markSaved();
      if (launched) rebuildLines(false);
      showSavedToast('“' + name + '” created — start typing');
    });
  });
}

/* ── editor size: three steps, remembered between visits ──────── */

const EDITOR_SIZE_KEY = 'tp_editor_size';
const EDITOR_SIZES = [
  { key: 's', label: 'Small' },
  { key: 'm', label: 'Medium' },
  { key: 'l', label: 'Large' },
];
let editorSizeIndex = 1;

function applyEditorSize() {
  const wrap = document.getElementById('scriptEditor');
  const label = document.getElementById('sizeLabel');
  if (!wrap) return;
  EDITOR_SIZES.forEach(s => wrap.classList.remove('size-' + s.key));
  const size = EDITOR_SIZES[editorSizeIndex];
  wrap.classList.add('size-' + size.key);
  if (label) label.textContent = size.label;
  // Clear any height the user dragged, so the step actually shows.
  const area = document.getElementById('scriptBody');
  if (area) area.style.height = '';
  lsSet(EDITOR_SIZE_KEY, size.key);
}

function cycleEditorSize() {
  editorSizeIndex = (editorSizeIndex + 1) % EDITOR_SIZES.length;
  applyEditorSize();
}

/* ── focus mode: write across the whole window ────────────────── */

let focusWriting = false;
let focusAnchor = null;

/**
 * .card uses backdrop-filter, and ANY ancestor with a filter becomes the
 * containing block for position:fixed descendants — which pinned the
 * "full screen" editor to the card instead of the viewport. So the editor
 * is moved to <body> while focus mode is on, and put back afterwards.
 * Reparenting keeps the textarea's value and its event listeners.
 */
function toggleFocusWriting(force) {
  const wrap = document.getElementById('scriptEditor');
  const area = document.getElementById('scriptBody');
  if (!wrap) return;

  const next = (typeof force === 'boolean') ? force : !focusWriting;
  if (next === focusWriting) return;
  focusWriting = next;

  if (focusWriting) {
    // Leave a marker so the editor returns to exactly the same spot.
    focusAnchor = document.createElement('div');
    focusAnchor.className = 'script-editor-anchor';
    wrap.parentNode.insertBefore(focusAnchor, wrap);
    document.body.appendChild(wrap);
  } else if (focusAnchor && focusAnchor.parentNode) {
    focusAnchor.parentNode.insertBefore(wrap, focusAnchor);
    focusAnchor.remove();
    focusAnchor = null;
  }

  document.body.classList.toggle('focus-writing', focusWriting);
  wrap.classList.toggle('focus-mode', focusWriting);

  const title = document.getElementById('focusTitle');
  if (title) {
    const script = tpGetActiveScript();
    title.textContent = script ? script.name : 'Writing';
  }

  const btn = document.getElementById('focusBtn');
  if (btn) btn.classList.toggle('active', focusWriting);

  if (focusWriting) {
    if (area) { area.style.height = ''; area.focus(); }
  } else {
    // Still unsaved on purpose — closing the writing surface is not a save.
    applyEditorSize();
  }
}

(function wireScriptToolbar() {
  const newBtn   = document.getElementById('newScriptBtn');
  const saveBtn  = document.getElementById('saveNowBtn');
  const sizeBtn  = document.getElementById('sizeBtn');
  const focusBtn = document.getElementById('focusBtn');
  const closeBtn = document.getElementById('focusCloseBtn');

  if (newBtn)   newBtn.addEventListener('click', createNewScript);
  if (saveBtn)  saveBtn.addEventListener('click', saveScriptNow);
  if (sizeBtn)  sizeBtn.addEventListener('click', cycleEditorSize);
  if (focusBtn) focusBtn.addEventListener('click', () => toggleFocusWriting());
  if (closeBtn) closeBtn.addEventListener('click', () => toggleFocusWriting(false));

  // Restore the size the user last chose.
  const saved = lsGet(EDITOR_SIZE_KEY);
  const idx = EDITOR_SIZES.findIndex(s => s.key === saved);
  if (idx >= 0) editorSizeIndex = idx;
  applyEditorSize();

  document.addEventListener('keydown', e => {
    // Ctrl/Cmd+S saves instead of opening the browser's save dialog.
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
      e.preventDefault();
      saveScriptNow();
      return;
    }
    if (e.key === 'Escape' && focusWriting) {
      e.preventDefault();
      toggleFocusWriting(false);
    }
  });
})();

/** Rebuilding on every keystroke while live would stutter; coalesce it. */
let liveRebuildTimer = null;
function scheduleLiveRebuild() {
  clearTimeout(liveRebuildTimer);
  liveRebuildTimer = setTimeout(() => { if (launched) rebuildLines(true); }, 350);
}

updateWordCount();

// ── ELAPSED TIMER ──
let timerInterval = null;
let timerSeconds = 0;
const stageTimerEl = document.getElementById('stageTimer');

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (running) {
      timerSeconds++;
      const m = Math.floor(timerSeconds / 60);
      const s = timerSeconds % 60;
      if (stageTimerEl) stageTimerEl.textContent = `${m}:${String(s).padStart(2,'0')}`;
    }
  }, 1000);
  if (stageTimerEl) stageTimerEl.classList.add('active');
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerSeconds = 0;
  if (stageTimerEl) { stageTimerEl.textContent = '0:00'; stageTimerEl.classList.remove('active'); }
}

// Patch launchStage to start timer
const _origLaunch = launchStage;
// Patch resetStage to stop timer
const _origReset = resetStage;

// ── TOPBAR BADGE ──
/** "#69ff91" -> "105,255,145". Returns null for anything else. */
function hexToRgbParts(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
}

function setTopbarBadge(text, color) {
  const b = document.getElementById('topbarBadge');
  if (!b) return;
  b.textContent = text;

  if (!color) {
    // fall back to the stylesheet
    b.style.color = '';
    b.style.borderColor = '';
    b.style.background = '';
    return;
  }
  // Tint the border and fill, but keep the text at full strength so it stays
  // legible. (The old code string-replaced ")" and so produced a solid fill
  // in the same colour as the text — an invisible label.)
  const rgb = hexToRgbParts(color);
  b.style.color = color;
  b.style.borderColor = rgb ? 'rgba(' + rgb + ',0.5)' : color;
  b.style.background = rgb ? 'rgba(' + rgb + ',0.14)' : 'transparent';
}

// Observe running state changes to update badge and timer
const _origSetPlayUI = setPlayUI;
setPlayUI = function(playing) {
  _origSetPlayUI(playing);
  if (playing) {
    setTopbarBadge('● Live', '#69ff91');
    if (stageTimerEl) stageTimerEl.classList.add('active');
    if (!timerInterval) startTimer();
  } else {
    if (launched) {
      setTopbarBadge('⏸ Paused', '#ffb347');
      if (stageTimerEl) stageTimerEl.classList.remove('active');
    }
  }
};

const _origResetStage = resetStage;
resetStage = function() {
  _origResetStage();
  resetTimer();
  setTopbarBadge('Ready');
  mirrored = false;
  stageEl.classList.remove('mirrored');
  const mb = document.getElementById('mirrorBtn');
  if (mb) mb.classList.remove('active');
};

// ── UI THEME ENGINE ──

// Tab switcher
function switchTab(tab) {
  document.getElementById('tabBgContent').style.display = tab === 'bg' ? 'block' : 'none';
  document.getElementById('tabUiContent').style.display = tab === 'ui' ? 'block' : 'none';
  document.getElementById('tabBg').style.background = tab === 'bg' ? 'var(--accent)' : 'transparent';
  document.getElementById('tabBg').style.color = tab === 'bg' ? '#fff' : 'var(--muted)';
  document.getElementById('tabUi').style.background = tab === 'ui' ? 'var(--accent)' : 'transparent';
  document.getElementById('tabUi').style.color = tab === 'ui' ? '#fff' : 'var(--muted)';
}

// ── BACKGROUND TAB ──
const pageSolids = [
  '#07070f','#000000','#0d0d0d','#111111',
  '#0a0a2e','#0d1b2a','#1a0a2e','#0a2e1a',
  '#2e0a0a','#1a1a1a','#f5f5f5','#fff8f0',
  '#e8f4ff','#fdf0ff','#fff3e0','#e8fff0',
];
const pageGrads = [
  { label:'Nebula',  css:'linear-gradient(135deg,#0a0015,#1a0033,#000a1a)' },
  { label:'Aurora',  css:'linear-gradient(135deg,#001a2e,#003322,#1a0033)' },
  { label:'Dusk',    css:'linear-gradient(135deg,#1a0a00,#2e1a0a,#0a0a1a)' },
  { label:'Ocean',   css:'linear-gradient(135deg,#000d1a,#001a33,#000a0a)' },
  { label:'Forest',  css:'linear-gradient(135deg,#000a00,#0a1a0a,#001a08)' },
  { label:'Fire',    css:'linear-gradient(135deg,#1a0000,#2e0800,#0a0000)' },
  { label:'Galaxy',  css:'linear-gradient(135deg,#050010,#0a0025,#00050a)' },
  { label:'Rose',    css:'linear-gradient(135deg,#1a0010,#2e0020,#0a000a)' },
  { label:'Mint',    css:'linear-gradient(135deg,#001a10,#003322,#000a08)' },
  { label:'Storm',   css:'linear-gradient(135deg,#0a0a14,#14141e,#080810)' },
  { label:'Sunrise', css:'linear-gradient(135deg,#1a0800,#2e1400,#1a0a00)' },
  { label:'Ice',     css:'linear-gradient(135deg,#001020,#00182e,#001828)' },
  { label:'Violet',  css:'linear-gradient(135deg,#0d001a,#1a0033,#0a000d)' },
  { label:'Copper',  css:'linear-gradient(135deg,#1a0800,#331a00,#1a0800)' },
  { label:'Teal',    css:'linear-gradient(135deg,#001a1a,#003333,#001a1a)' },
  { label:'Blood',   css:'linear-gradient(135deg,#1a0000,#330000,#1a0000)' },
  { label:'Ivory',   css:'linear-gradient(135deg,#1a1a10,#2e2e1a,#1a1a0a)' },
  { label:'Cobalt',  css:'linear-gradient(135deg,#00001a,#000033,#00001a)' },
];

let pageBgPanelOpen = false;

function togglePageBgPanel() {
  pageBgPanelOpen = !pageBgPanelOpen;
  const panel = document.getElementById('pageBgPanel');
  panel.style.display = pageBgPanelOpen ? 'block' : 'none';
  const btn = document.getElementById('pageBgBtn');
  if (btn) btn.style.background = pageBgPanelOpen ? 'rgba(255,107,157,0.18)' : 'rgba(255,107,157,0.07)';
}

function applyPageBg(type, value) {
  if (type === 'color') {
    document.body.style.background = value;
    document.body.style.backgroundSize = '';
    const h = document.getElementById('pageBgHex');
    const c = document.getElementById('pageBgColor');
    if (h) h.value = value;
    if (c) c.value = value;
    clearPageSwatchActive();
  } else if (type === 'gradient') {
    document.body.style.background = value;
    document.body.style.backgroundSize = 'cover';
    clearPageSwatchActive();
  }
}

function onHexInput(val) {
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    document.body.style.background = val;
    const c = document.getElementById('pageBgColor');
    if (c) c.value = val;
    clearPageSwatchActive();
    saveTheme();
  }
}

function resetPageBg() {
  document.body.style.background = '';
  document.body.style.backgroundSize = '';
  const c = document.getElementById('pageBgColor');
  const h = document.getElementById('pageBgHex');
  if (c) c.value = '#07070f';
  if (h) h.value = '#07070f';
  clearPageSwatchActive();
  const first = document.querySelector('.page-solid-swatch');
  if (first) first.style.outline = '2.5px solid #fff';
}

function clearPageSwatchActive() {
  document.querySelectorAll('.page-solid-swatch,.page-grad-swatch').forEach(s => s.style.outline = 'none');
}

function updatePanelBlur(v) {
  document.getElementById('panelBlurVal').textContent = v + 'px';
  document.querySelectorAll('.editor-panel,.topbar').forEach(el => {
    el.style.backdropFilter = `blur(${v}px)`;
  });
}

function updatePanelOpacity(v) {
  document.getElementById('panelOpacityVal').textContent = v + '%';
  const alpha = (v / 100).toFixed(2);
  document.querySelector('.editor-panel').style.background = `rgba(17,17,24,${alpha})`;
}

function buildPageSwatches() {
  const solidWrap = document.getElementById('pageSolidSwatches');
  if (!solidWrap) return;
  pageSolids.forEach((c, i) => {
    const s = document.createElement('div');
    s.className = 'page-solid-swatch';
    s.style.cssText = `width:26px;height:26px;border-radius:8px;background:${c};cursor:pointer;border:2px solid rgba(255,255,255,0.1);transition:transform .15s,outline .1s;flex-shrink:0;`;
    if (i === 0) s.style.outline = '2.5px solid #fff';
    s.title = c;
    s.onmouseover = () => s.style.transform = 'scale(1.2)';
    s.onmouseout  = () => s.style.transform = 'scale(1)';
    s.onclick = () => { clearPageSwatchActive(); s.style.outline = '2.5px solid #fff'; applyPageBg('color', c); };
    solidWrap.appendChild(s);
  });

  const gradWrap = document.getElementById('pageGradSwatches');
  if (!gradWrap) return;
  pageGrads.forEach(g => {
    const s = document.createElement('div');
    s.className = 'page-grad-swatch';
    s.style.cssText = `height:44px;border-radius:9px;background:${g.css};cursor:pointer;border:2px solid transparent;transition:transform .15s,outline .1s;position:relative;overflow:hidden;`;
    s.title = g.label;
    s.innerHTML = `<span style="position:absolute;bottom:4px;left:0;right:0;text-align:center;font-size:8px;font-weight:700;letter-spacing:.06em;color:rgba(255,255,255,0.7);text-transform:uppercase;">${g.label}</span>`;
    s.onmouseover = () => s.style.transform = 'scale(1.05)';
    s.onmouseout  = () => s.style.transform = 'scale(1)';
    s.onclick = () => { clearPageSwatchActive(); s.style.outline = '2.5px solid var(--accent)'; applyPageBg('gradient', g.css); };
    gradWrap.appendChild(s);
  });
}
buildPageSwatches();

// ── UI COLORS TAB ──
const accentColors = ['#7c6fff','#ff6b9d','#00e5ff','#69ff91','#ffb347','#ff4757','#ffd32a','#05c46b','#ff5e57','#0fbcf9','#cd84f1','#ffdd59'];
const sidebarColors = ['#0f0f1c','#0d1117','#1a0a2e','#0a1a2e','#0a2e1a','#1a0a0a','#1a1a1a','#000000','#0f1923','#1a0f00','#ffffff','#f0f4ff'];
const textColors = ['#eeeef8','#ffffff','#c0c0e0','#a0a0c0','#ffecb3','#b2ebf2','#c8e6c9','#f8bbd0','#000000','#1a1a2e','#2d3436','#636e72'];

const fullThemes = [
  { label:'Dark Purple', bg:'#07070f', accent:'#7c6fff', sidebar:'#0f0f1c', text:'#eeeef8' },
  { label:'Midnight Blue', bg:'#040d1a', accent:'#00e5ff', sidebar:'#071525', text:'#e0f7fa' },
  { label:'Rose Gold', bg:'#1a080e', accent:'#ff6b9d', sidebar:'#1f0d14', text:'#fce4ec' },
  { label:'Forest', bg:'#050f05', accent:'#69ff91', sidebar:'#0a1a0a', text:'#e8f5e9' },
  { label:'Amber', bg:'#110900', accent:'#ffb347', sidebar:'#1a1000', text:'#fff8e1' },
  { label:'Light', bg:'#f0f4ff', accent:'#7c6fff', sidebar:'#ffffff', text:'#1a1a2e' },
  { label:'Slate', bg:'#0f1117', accent:'#00e5ff', sidebar:'#161b22', text:'#e6edf3' },
  { label:'Blood', bg:'#0d0000', accent:'#ff4757', sidebar:'#1a0000', text:'#fff0f0' },
];

function applyAccent(hex) {
  document.documentElement.style.setProperty('--accent', hex);
  // derive glow
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.4)`);
  const picker = document.getElementById('accentColorPicker');
  if (picker) picker.value = hex;
}

function applySidebarColor(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  document.documentElement.style.setProperty('--bg', hex);
  document.documentElement.style.setProperty('--surface', `rgb(${Math.min(r+8,255)},${Math.min(g+8,255)},${Math.min(b+8,255)})`);
  document.documentElement.style.setProperty('--surface2', `rgb(${Math.min(r+16,255)},${Math.min(g+16,255)},${Math.min(b+16,255)})`);
  document.querySelector('.editor-panel').style.background = `rgba(${r},${g},${b},0.92)`;
  const picker = document.getElementById('sidebarColorPicker');
  if (picker) picker.value = hex;
}

function applyTextColor(hex) {
  document.documentElement.style.setProperty('--text', hex);
  const picker = document.getElementById('textColorPicker');
  if (picker) picker.value = hex;
}

function applyFullTheme(t) {
  applyPageBg('color', t.bg);
  applyAccent(t.accent);
  applySidebarColor(t.sidebar);
  applyTextColor(t.text);
}

function resetUIColors() {
  applyAccent('#7c6fff');
  applySidebarColor('#0f0f1c');
  applyTextColor('#eeeef8');
}

function buildUIColorPickers() {
  // Accent presets
  const aWrap = document.getElementById('accentPresets');
  if (aWrap) accentColors.forEach(c => {
    const s = makeSwatch(c, () => applyAccent(c));
    aWrap.appendChild(s);
  });

  // Sidebar presets
  const sWrap = document.getElementById('sidebarPresets');
  if (sWrap) sidebarColors.forEach(c => {
    const s = makeSwatch(c, () => applySidebarColor(c));
    sWrap.appendChild(s);
  });

  // Text presets
  const tWrap = document.getElementById('textColorPresets');
  if (tWrap) textColors.forEach(c => {
    const s = makeSwatch(c, () => applyTextColor(c));
    tWrap.appendChild(s);
  });

  // Full themes
  const thWrap = document.getElementById('themePresets');
  if (thWrap) fullThemes.forEach(t => {
    const btn = document.createElement('button');
    btn.style.cssText = `padding:10px 8px;border-radius:9px;border:1px solid rgba(255,255,255,0.1);background:linear-gradient(135deg,${t.bg},${t.sidebar});cursor:pointer;color:${t.text};font-family:'Syne',sans-serif;font-size:11px;font-weight:700;letter-spacing:.03em;transition:transform .15s,box-shadow .15s;text-align:center;`;
    btn.textContent = t.label;
    btn.onmouseover = () => { btn.style.transform='scale(1.04)'; btn.style.boxShadow=`0 0 12px rgba(124,111,255,0.3)`; };
    btn.onmouseout  = () => { btn.style.transform='scale(1)'; btn.style.boxShadow='none'; };
    btn.onclick = () => applyFullTheme(t);
    thWrap.appendChild(btn);
  });
}

function makeSwatch(c, fn) {
  const s = document.createElement('div');
  s.style.cssText = `width:22px;height:22px;border-radius:6px;background:${c};cursor:pointer;border:2px solid rgba(255,255,255,0.12);transition:transform .15s;flex-shrink:0;`;
  s.title = c;
  s.onmouseover = () => s.style.transform = 'scale(1.25)';
  s.onmouseout  = () => s.style.transform = 'scale(1)';
  s.onclick = fn;
  return s;
}
buildUIColorPickers();

// Close panel on outside click
document.addEventListener('click', e => {
  if (!pageBgPanelOpen) return;
  const panel = document.getElementById('pageBgPanel');
  const btn   = document.getElementById('pageBgBtn');
  if (!panel.contains(e.target) && !btn.contains(e.target)) {
    pageBgPanelOpen = false;
    panel.style.display = 'none';
    if (btn) btn.style.background = 'rgba(255,107,157,0.07)';
  }
});

// ── PERSISTENCE LAYER ──
// Scripts now live in the library (see js/storage.js); this key is theme-only.
const THEME_KEY  = 'tp_theme_v2';

function lsSet(key, val) {
  try { localStorage.setItem(key, val); return true; }
  catch(e) { console.error('[TP] localStorage.setItem failed:', e); return false; }
}
function lsGet(key) {
  try { return localStorage.getItem(key); }
  catch(e) { console.error('[TP] localStorage.getItem failed:', e); return null; }
}

// ── THEME SAVE / LOAD ──
function saveTheme() {
  const s = document.documentElement.style;
  const stageEl3 = document.getElementById('stage');
  // Don't save base64 wallpapers (too large for localStorage) — only CSS backgrounds
  const pageBg = document.body.style.background || '';
  const stageBg = (stageEl3 ? stageEl3.style.background : '') || '';
  const theme = {
    pageBg:       pageBg.startsWith('url("data:') ? '' : pageBg,
    pageBgSize:   document.body.style.backgroundSize || '',
    stageBg:      stageBg.startsWith('url("data:') ? '' : stageBg,
    stageBgSize:  stageEl3 ? stageEl3.style.backgroundSize || '' : '',
    accent:       s.getPropertyValue('--accent').trim() || '',
    accentGlow:   s.getPropertyValue('--accent-glow').trim() || '',
    bg:           s.getPropertyValue('--bg').trim() || '',
    surface:      s.getPropertyValue('--surface').trim() || '',
    surface2:     s.getPropertyValue('--surface2').trim() || '',
    text:         s.getPropertyValue('--text').trim() || '',
    panelBg:      document.querySelector('.editor-panel')?.style.background || '',
    panelBlur:    document.getElementById('panelBlurSlider')?.value || '20',
    panelOpacity: document.getElementById('panelOpacitySlider')?.value || '90',
  };
  const ok = lsSet(THEME_KEY, JSON.stringify(theme));
  showSavedToast(ok ? 'Theme saved ✓' : '⚠ Theme save failed');
}

function loadSavedTheme() {
  const raw = lsGet(THEME_KEY);
  if (!raw) { console.log('[TP] No saved theme found'); return; }
  let t;
  try { t = JSON.parse(raw); } catch(e) { console.error('[TP] Theme parse error', e); return; }
  console.log('[TP] Restoring theme:', t);
  const root = document.documentElement;
  const stageEl3 = document.getElementById('stage');

  // Page background (sidebar/UI bg)
  const pageBg = t.pageBg || t.bgStyle || ''; // fallback for old saves
  if (pageBg) {
    document.body.style.background = pageBg;
    document.body.style.backgroundSize = t.pageBgSize || t.bgSize || '';
  }

  // Stage background
  if (stageEl3 && t.stageBg) {
    stageEl3.style.background = t.stageBg;
    stageEl3.style.backgroundSize = t.stageBgSize || '';
  }

  if (t.accent)  {
    root.style.setProperty('--accent', t.accent);
    if (t.accentGlow) root.style.setProperty('--accent-glow', t.accentGlow);
  }
  if (t.bg)       root.style.setProperty('--bg', t.bg);
  if (t.surface)  root.style.setProperty('--surface', t.surface);
  if (t.surface2) root.style.setProperty('--surface2', t.surface2);
  if (t.text)     root.style.setProperty('--text', t.text);
  if (t.panelBg)  { const ep = document.querySelector('.editor-panel'); if (ep) ep.style.background = t.panelBg; }
  if (t.panelBlur) {
    const sl = document.getElementById('panelBlurSlider'), vl = document.getElementById('panelBlurVal');
    if (sl) sl.value = t.panelBlur;
    if (vl) vl.textContent = t.panelBlur + 'px';
    document.querySelectorAll('.editor-panel,.topbar').forEach(el => el.style.backdropFilter = `blur(${t.panelBlur}px)`);
  }
  if (t.panelOpacity) {
    const sl = document.getElementById('panelOpacitySlider'), vl = document.getElementById('panelOpacityVal');
    if (sl) sl.value = t.panelOpacity;
    if (vl) vl.textContent = t.panelOpacity + '%';
  }
  const ap = document.getElementById('accentColorPicker');  if (ap && t.accent) ap.value = t.accent;
  const sp = document.getElementById('sidebarColorPicker'); if (sp && t.bg)     sp.value = t.bg;
  const tp2= document.getElementById('textColorPicker');    if (tp2 && t.text)  tp2.value = t.text;
  const bc = document.getElementById('pageBgColor');
  if (bc && pageBg && !pageBg.startsWith('url(') && !pageBg.startsWith('linear')) {
    bc.value = pageBg;
    const bh = document.getElementById('pageBgHex'); if (bh) bh.value = pageBg;
  }
  showSavedToast('Theme restored ✓');
}

function showSavedToast(msg) {
  let toast = document.getElementById('themeToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'themeToast';
    toast.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:999;background:rgba(124,111,255,0.18);border:1px solid rgba(124,111,255,0.4);border-radius:10px;padding:9px 16px;font-family:\'Syne\',sans-serif;font-size:12px;font-weight:700;color:var(--accent);letter-spacing:.04em;pointer-events:none;transition:opacity .4s;backdrop-filter:blur(12px);';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.style.opacity = '0', 2000);
}

// Patch all apply functions to auto-save
const _origApplyPageBg = applyPageBg;
applyPageBg = function(type, value) { _origApplyPageBg(type, value); saveTheme(); };

const _origApplyAccent = applyAccent;
applyAccent = function(hex) { _origApplyAccent(hex); saveTheme(); };

const _origApplySidebarColor = applySidebarColor;
applySidebarColor = function(hex) { _origApplySidebarColor(hex); saveTheme(); };

const _origApplyTextColor = applyTextColor;
applyTextColor = function(hex) { _origApplyTextColor(hex); saveTheme(); };

const _origUpdatePanelBlur = updatePanelBlur;
updatePanelBlur = function(v) { _origUpdatePanelBlur(v); saveTheme(); };

const _origUpdatePanelOpacity = updatePanelOpacity;
updatePanelOpacity = function(v) { _origUpdatePanelOpacity(v); saveTheme(); };

const _origResetPageBg2 = resetPageBg;
resetPageBg = function() { _origResetPageBg2(); saveTheme(); };

const _origResetUIColors2 = resetUIColors;
resetUIColors = function() { _origResetUIColors2(); saveTheme(); };

// Show save indicator in panel header on any change
function flashSaved() { showSavedToast('Theme saved ✓'); }
['applyPageBg','applyAccent','applySidebarColor','applyTextColor','updatePanelBlur','updatePanelOpacity'].forEach(fn => {
  // already patched above, toast shown via saveTheme
});

// Load theme on startup
loadSavedTheme();

/* ═══════════════════════════════════════════════════════════════
   SCRIPT PERSISTENCE — backed by the library in storage.js
   The page always edits whichever script the library marks active,
   so you can keep as many as you like instead of one shared slot.
   ═══════════════════════════════════════════════════════════════ */

let activeScriptId = null;

function saveScripts() {
  if (!activeScriptId) return;
  tpUpdateScript(activeScriptId, {
    body: scriptBodyValue(),
    mode: mode,
    readers: readers.map(r => ({ id: r.id, name: r.name, color: r.color })),
  });
}

function loadSavedScripts() {
  let script = tpGetActiveScript();

  // First ever visit (and nothing to migrate): keep the demo text on the page
  // and store it as the starting script so it is not lost.
  if (!script) {
    script = tpAddScript(tpMakeScript('My first script', scriptBodyValue(), mode, readers));
  }

  activeScriptId = script.id;
  readers = tpNormalizeReaders(script.readers);

  const area = document.getElementById('scriptBody');
  if (area && typeof script.body === 'string') area.value = script.body;

  setMode(script.mode || mode);   // also calls renderReaders + updateWordCount
  renderCurrentScriptName();
  refreshUndoButton();
  markSaved();
}

function renderCurrentScriptName() {
  const script = tpGetActiveScript();
  const name = script ? script.name : 'Untitled script';

  const elx = document.getElementById('currentScriptName');
  if (elx) elx.textContent = name;

  const focusTitle = document.getElementById('focusTitle');
  if (focusTitle) focusTitle.textContent = name;
}

/** The name of the script currently being edited. */
function activeScriptName() {
  const script = tpGetActiveScript();
  return script ? script.name : 'this script';
}

/**
 * "Untitled script", then "Untitled script 2", … so creating a script is
 * one Enter press instead of having to think of a name first.
 */
function suggestScriptName(base) {
  const taken = tpGetScripts().map(s => s.name.toLowerCase());
  if (!taken.includes(base.toLowerCase())) return base;
  for (let n = 2; n < 500; n++) {
    const candidate = base + ' ' + n;
    if (!taken.includes(candidate.toLowerCase())) return candidate;
  }
  return base;
}

/* ── undo history ─────────────────────────────────────────────────
   Each explicit save first files the version it is replacing, and the
   snapshots live with the script, so a bad paste is recoverable even
   after a reload — unlike the textarea's own Ctrl+Z. */

function refreshUndoButton() {
  const btn = document.getElementById('undoBtn');
  if (!btn) return;
  const script = tpGetActiveScript();
  const depth = script && Array.isArray(script.history) ? script.history.length : 0;
  btn.disabled = depth === 0;
  btn.title = depth === 0
    ? 'Nothing to undo yet'
    : 'Undo the last change (' + depth + ' saved ' + (depth === 1 ? 'version' : 'versions') + ')';
}

function undoScript() {
  const script = tpGetActiveScript();
  if (!script || !Array.isArray(script.history) || !script.history.length) return;

  const history = script.history.slice();
  const previous = history.pop();
  const area = document.getElementById('scriptBody');

  // Put the old version back in the box and drop it from the list. The
  // script itself is only rewritten when you save, like any other edit.
  if (area) area.value = previous;
  tpUpdateScript(activeScriptId, { history: history });
  markUnsaved();

  updateWordCount();
  renderReaders();
  if (launched) rebuildLines(true);
  refreshUndoButton();
  showSavedToast('Previous version restored — save to keep it');
}

(function wireUndo() {
  const btn = document.getElementById('undoBtn');
  if (btn) btn.addEventListener('click', undoScript);

  // Ctrl/Cmd+Shift+Z reverts to the last saved snapshot. Plain Ctrl+Z is
  // left alone so the textarea's native undo keeps working for typos.
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyZ') {
      e.preventDefault();
      undoScript();
    }
  });
})();

/* ── unsaved-changes guard ────────────────────────────────────────
   Nothing is saved on a timer. The cost of that is that leaving the
   page with unsaved text would throw the work away silently, so every
   exit route asks first: Save, Discard, or stay put. */

let guardOnLeave = null;

/**
 * Runs `proceed` only once it is safe to lose what is on screen.
 * Clean editor: runs straight away. Dirty editor: opens the dialog.
 */
function guardUnsaved(whatFor, proceed) {
  if (!scriptDirty) { proceed(); return; }

  const modal = document.getElementById('unsavedModal');
  if (!modal) {
    // No dialog on the page: never discard silently, save instead.
    saveScriptNow();
    proceed();
    return;
  }

  const msg = document.getElementById('unsavedMsg');
  if (msg) {
    msg.textContent = whatFor + ' will discard the changes you have made to “' +
      activeScriptName() + '”. Save them first?';
  }
  guardOnLeave = proceed;
  modal.classList.add('open');
  const saveBtn = document.getElementById('unsavedSaveBtn');
  if (saveBtn) saveBtn.focus();
}

function closeUnsavedModal() {
  const modal = document.getElementById('unsavedModal');
  if (modal) modal.classList.remove('open');
  guardOnLeave = null;
}

(function wireUnsavedGuard() {
  const modal = document.getElementById('unsavedModal');
  if (!modal) return;

  const run = () => { const fn = guardOnLeave; closeUnsavedModal(); if (fn) fn(); };

  const saveBtn = document.getElementById('unsavedSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', () => { saveScriptNow(); run(); });

  const discardBtn = document.getElementById('unsavedDiscardBtn');
  if (discardBtn) discardBtn.addEventListener('click', () => { markSaved(); run(); });

  const cancelBtn = document.getElementById('unsavedCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeUnsavedModal);

  modal.addEventListener('click', e => { if (e.target === modal) closeUnsavedModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeUnsavedModal();
  });

  // Following a link in the top bar is the usual way out of the page.
  document.querySelectorAll('a[href]:not([href^="#"])').forEach(a => {
    a.addEventListener('click', e => {
      if (!scriptDirty || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const href = a.getAttribute('href');
      guardUnsaved('Leaving this page', () => { window.location.href = href; });
    });
  });

  // Closing the tab or hitting reload: the browser's own confirm is the
  // only thing that can stop it.
  window.addEventListener('beforeunload', e => {
    if (!scriptDirty) return;
    e.preventDefault();
    e.returnValue = '';
    return '';
  });
})();

/* ── rename / save-as-new dialog ──────────────────────────────── */

let nameModalOnSave = null;

function openNameModal(title, currentName, onSave) {
  const modal = document.getElementById('nameModal');
  if (!modal) return;
  document.getElementById('nameModalTitle').textContent = title;
  const input = document.getElementById('nameInput');
  input.value = currentName || '';
  nameModalOnSave = onSave;
  modal.classList.add('open');
  input.focus();
  input.select();
}

function closeNameModal() {
  const modal = document.getElementById('nameModal');
  if (modal) modal.classList.remove('open');
  nameModalOnSave = null;
}

(function wireNameModal() {
  const modal = document.getElementById('nameModal');
  if (!modal) return;

  document.getElementById('nameCancelBtn').addEventListener('click', closeNameModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeNameModal(); });

  document.getElementById('nameSaveBtn').addEventListener('click', () => {
    const value = document.getElementById('nameInput').value.trim();
    if (!value) { document.getElementById('nameInput').focus(); return; }
    const fn = nameModalOnSave;
    closeNameModal();
    if (fn) fn(value);
  });

  document.getElementById('nameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('nameSaveBtn').click(); }
    if (e.key === 'Escape') closeNameModal();
  });

  // Two places open the rename dialog: the pencil in the name field and the
  // "Rename" chip below it.
  function openRename() {
    const script = tpGetActiveScript();
    openNameModal('Rename script', script ? script.name : '', name => {
      if (activeScriptId) tpUpdateScript(activeScriptId, { name: name });
      renderCurrentScriptName();
      showSavedToast('Renamed ✓');
    });
  }
  ['renameScriptBtn', 'renameScriptBtn2'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', openRename);
  });

  const saveAsBtn = document.getElementById('saveAsNewBtn');
  if (saveAsBtn) saveAsBtn.addEventListener('click', () => {
    const script = tpGetActiveScript();
    const suggested = (script ? script.name : 'Script') + ' (copy)';
    openNameModal('Save as a new script', suggested, name => {
      // The old script is left exactly as it was last saved; this text
      // becomes a separate script, which is now the one being edited.
      const created = tpAddScript(tpMakeScript(name, scriptBodyValue(), mode, readers));
      activeScriptId = created.id;
      tpSetActiveScript(created.id);
      renderCurrentScriptName();
      refreshUndoButton();
      markSaved();
      showSavedToast('Saved as “' + name + '” ✓');
    });
  });
})();

// Changing the reader count is a script change too — flag it, don't store it.
const _origSetMode = setMode;
setMode = function(m) { _origSetMode(m); markUnsaved(); };

/* ═══════════════════════════════════════════════════════════════
   SESSION TRACKING — feeds the Session Report page
   A "run" starts when you press Start and is recorded when you
   finish the script, loop round, or go back to editing.
   ═══════════════════════════════════════════════════════════════ */

const MIN_SESSION_SECONDS = 3;   // ignore accidental starts
let sessionRun = null;

function beginSession() {
  const script = tpGetActiveScript();
  sessionRun = {
    scriptId: activeScriptId,
    scriptName: script ? script.name : 'Untitled script',
    mode: mode,
    startedAt: Date.now(),
    pauseCount: 0,
    rewinds: 0,
    timerAtStart: timerSeconds,
  };
}

/**
 * Records the run that just happened. `completed` is forced true when the
 * script scrolled to the end; otherwise it is inferred from progress.
 */
function endSession(completed) {
  if (!sessionRun) return null;
  const run = sessionRun;
  sessionRun = null;   // guard against double-recording

  // timerSeconds only ticks while actually scrolling, so this is real reading time.
  const durationSec = Math.max(0, timerSeconds - run.timerAtStart);
  const progressPct = totalScroll > 0
    ? Math.min(100, Math.max(0, Math.round((currentY / totalScroll) * 100)))
    : 0;

  if (durationSec < MIN_SESSION_SECONDS) return null;

  const totalWords = tpScriptStats(scriptBodyValue(), activeReaders()).words;
  const isDone = completed === true || progressPct >= 99;
  const wordsRead = isDone ? totalWords : Math.round(totalWords * (progressPct / 100));
  const wpm = durationSec > 0 ? Math.round(wordsRead / (durationSec / 60)) : 0;

  return tpAddSession({
    scriptId: run.scriptId,
    scriptName: run.scriptName,
    mode: run.mode,
    startedAt: run.startedAt,
    durationSec: durationSec,
    estimatedSec: tpEstimateSeconds(totalWords),
    wpm: wpm,
    wordsRead: wordsRead,
    totalWords: totalWords,
    pauseCount: run.pauseCount,
    rewinds: run.rewinds,
    progressPct: isDone ? 100 : progressPct,
    completed: isDone,
  });
}

function countPause()  { if (sessionRun) sessionRun.pauseCount++; }
function countRewind() { if (sessionRun) sessionRun.rewinds++; }

/* ── hooks into the existing stage functions ──────────────────── */

const _origLaunchStage = launchStage;
launchStage = function() {
  // The stage reads the box directly, so an unsaved script still plays.
  _origLaunchStage();
  stageEl.classList.add('is-live');   // reveals the centre marker
  syncControlsHeight();   // the controls bar is only visible from now on
  beginSession();
};

const _origRestartPlay = restartPlay;
restartPlay = function() {
  if (!launched) return;
  endSession(false);      // bank whatever was read before the rewind
  _origRestartPlay();
  beginSession();
};

const _origResetStage2 = resetStage;
resetStage = function() {
  endSession(false);
  _origResetStage2();
  stageEl.classList.remove('is-live');
};

const _origTogglePlay = togglePlay;
togglePlay = function() {
  const wasRunning = running;
  _origTogglePlay();
  if (wasRunning && !running) countPause();
};

const _origScrubTo = scrubTo;
scrubTo = function(val) {
  _origScrubTo(val);
  countRewind();
};

// Count manual wheel scrubbing too (the wheel handler itself is anonymous).
stageEl.addEventListener('wheel', () => { if (launched) countRewind(); }, { passive: true });

/* ═══════════════════════════════════════════════════════════════
   LAYOUT MEASUREMENT
   The completion screen must sit above the controls bar. The bar's
   height depends on how many labels are showing, so measure it
   instead of hard-coding a number.
   ═══════════════════════════════════════════════════════════════ */

function syncControlsHeight() {
  if (!controlsBar) return;
  const h = controlsBar.offsetHeight;
  if (h > 0) stageEl.style.setProperty('--controls-h', (h + 6) + 'px');
}

if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(syncControlsHeight).observe(controlsBar);
} else {
  window.addEventListener('resize', syncControlsHeight);
}
syncControlsHeight();

// Record the run if the tab is closed mid-read instead of losing it.
window.addEventListener('pagehide', () => { endSession(false); });

/* ═══════════════════════════════════════════════════════════════
   STARTUP
   ═══════════════════════════════════════════════════════════════ */

// Pull the active script out of the library into the editor.
loadSavedScripts();

// Make sure only the reader cards for the active mode are visible.
// Nothing has been edited yet, so the badge goes back to Saved.
setMode(mode);
markSaved();

