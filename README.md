# Teleprompt

A teleprompter and reading-practice tool that runs entirely in the browser.
Write a script, scroll it on screen at a controlled pace, and keep a record of
how your practice runs are going.

No build step, no server, no dependencies. Open `index.html` and it works.

---

## Getting started

Double-click **`index.html`**. Everything is saved in your browser's
`localStorage`, so your scripts stay on this machine and nothing is uploaded.

The three pages are linked from the top bar:

| Page | File | What it does |
|---|---|---|
| Teleprompter | `index.html` | Write a script and read it on the scrolling stage |
| Library | `library.html` | Keep as many named scripts as you like |
| Report | `report.html` | See how your practice runs are going |

---

## Writing a script

Scripts are written top to bottom in one box. Three rules:

**1. Tag a line to set the speaker.**

```
Alice: Good morning everyone.
Alice: I can keep talking for as long as I like.
Bob: Then I answer.
Alice: And back to me.
```

A reader answers to their **name**, their **letter** (`A:`–`D:`) or their
**number** (`1:`–`4:`). A line with no tag continues whoever spoke last, so one
person can take as many turns in a row as they want.

A prefix that isn't one of your readers stays part of the line — `Note: breathe
here` reads as written.

**2. A blank line is a pause.**

```
Alice: That's the end of the first part.

Bob: And now the second.
```

Blank lines become real breathing room on stage, marked with a small `• • •`.

**3. Long paragraphs split themselves.**

Paste a paragraph and it's broken at sentence boundaries into lines that are
comfortable to read aloud (about 92 characters). Nothing is reworded, reordered
or lost — you never have to hand-wrap your script.

### Readers

Pick 1–4 readers in **Reader Mode**. Each gets an editable name and a colour,
and the Script Stats card shows how many words, lines and minutes each person
actually has. On stage, the speaker's name appears above each new turn.

The editor warns you — with a one-click fix — when:

- two readers share a colour, which would make them indistinguishable on stage
- a colour is too dark to read against the current background
- lines are tagged for a reader who is currently switched off

### Editing comfort

- **Size** cycles the box between Small, Medium and Large. Your choice is remembered.
- **Full screen** turns the whole window into the writing surface. `Esc` or **Done** to come back.
- The bottom-right corner of the box can be dragged to any height.
- **Save script** writes immediately; the badge shows **Saved** or **Unsaved**.
  Typing also autosaves after a short pause.
- **Undo** steps back through up to 12 saved versions. These are stored with the
  script, so a bad paste is recoverable even after a reload.

---

## Reading on stage

Press **Start Teleprompter**, wait out the 3-2-1 countdown, and the script
scrolls upward. The line in the centre is highlighted.

### Controls

| Control | What it does |
|---|---|
| **Edit** | Back to the editor |
| **Play / Pause** | Start or stop scrolling |
| **Restart** | Jump to the top and read again |
| **Scroll** | Drag to any point in the script |
| **Speed** | Words-per-minute pace |
| **Full** | Browser fullscreen |
| **Jump** | Click any line to go straight to it |
| **Loop** | Automatically start over when the script ends |
| **Mirror** | Flip horizontally, for glass teleprompter rigs |

Scrolling the mouse wheel over the stage also seeks, and clicking the stage
toggles play.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `↑` `↓` | Speed up / slow down |
| `R` | Restart from the top |
| `L` | Loop on / off |
| `J` | Jump mode |
| `M` | Mirror flip |
| `F` | Fullscreen |
| `E` | Back to editing |
| `Ctrl`/`Cmd` + `S` | Save the script |
| `Ctrl`/`Cmd` + `Shift` + `Z` | Undo to the last saved version |
| `Esc` | Leave full-screen writing |

---

## Library

Every script is a named card showing its word count, line count, estimated
reading time and reader colours.

- **New script** / **Rename** / **Duplicate** / **Delete** (delete asks first)
- Search by name *or* by what's written inside
- Sort by Recent, A–Z or Longest
- **Download** a script as `.txt` — the file keeps a small header with your
  reader names and colours, so importing it again rebuilds the same
  multi-reader script
- **Import .txt** accepts several files at once. Files written by this app come
  back exactly as they were; a plain text file becomes a one-reader script
- **Export backup** writes a single JSON file containing every script and your
  whole practice history

---

## Report

Each read-through is recorded when you finish it, loop, or go back to editing.

- **Your last run** — time read versus the estimate, pace in words per minute,
  words read, how far you got, pauses and rewinds, plus a plain-English verdict
- **All time** — totals, average and best pace, completion rate
- **Reading pace** — a bar chart of your last 12 runs so you can see progress
- **History** — every run, with per-row delete, and **Export CSV**

Runs shorter than 3 seconds are discarded so an accidental Start doesn't skew
your numbers. If you stop part-way, only the portion you actually read is
counted rather than the whole script.

---

## Appearance

The sun icon in the top bar opens the theme panel.

- **Background** — stage colour, gradient wallpapers, page background, and the
  blur and opacity of the editor panel
- **UI Colors** — accent, sidebar and sidebar-text colours, plus eight complete
  presets

The **Stage Background** card in the editor sets the backdrop behind your script.
Your theme is saved and restored on every page.

---

## Project layout

```
index.html              teleprompter page
library.html            script library
report.html             session report

css/
  styles.css            stage and teleprompter machinery
  pages.css             shared page components
  shell.css             app shell, cards, editor, theme

js/
  script-model.js       script parsing, paragraph splitting, stats, contrast
  storage.js            localStorage: library, sessions, theme
  app.js                teleprompter page
  library.js            library page
  report.js             report page

_legacy/
  teleprompter-original.html    the original single-file version
```

### How the pieces fit

`script-model.js` is the core and has no DOM dependencies. It turns script text
into a list of stage blocks:

```js
tpParseScript(body, readers)
// → [ { type:'line', readerId, text, startsTurn }, { type:'pause', size }, … ]
```

Everything else builds on that — `app.js` renders the blocks to the stage,
`storage.js` uses it for word counts, and `library.js` uses it for previews.

Scripts must load in order on every page, because `storage.js` depends on the
model:

```html
<script src="js/script-model.js"></script>
<script src="js/storage.js"></script>
<script src="js/app.js"></script>
```

### Stored data

| Key | Contents |
|---|---|
| `tp_library_v1` | All scripts and which one is active |
| `tp_sessions_v1` | Practice run history (capped at 200) |
| `tp_theme_v2` | Colours, backgrounds, panel blur and opacity |
| `tp_editor_size` | Your chosen editor height |
| `tp_script_v2` | Retired single-script slot, kept as a migration backup |

A script record looks like this:

```js
{
  id: 's_m1x2…',
  name: 'Opening speech',
  mode: 2,                                  // how many readers are active
  readers: [ { id: 1, name: 'Alice', color: '#4FC3F7' }, … ],
  body: 'Alice: Good morning.\nBob: Hello.',
  history: [ … ],                           // up to 12 previous versions
  createdAt, updatedAt
}
```

Older records that stored one textarea per reader are upgraded automatically on
load, folded into a single tagged body that reads in exactly the same order.

---

## Browser support

Any current Chrome, Edge, Firefox or Safari. Uses `localStorage`,
`requestAnimationFrame`, `ResizeObserver` and the Fullscreen API.

Nothing leaves your browser — there is no network request beyond the Google
Fonts stylesheet.

---

## Known limits

- Storage is per-browser and per-machine. Use **Export backup** to move your
  scripts somewhere else.
- `localStorage` is a few megabytes, which is thousands of scripts but not
  unlimited. Version history is capped at 12 entries per script and run history
  at 200 entries.
- The stage backdrop is a CSS gradient rather than a photograph.
- Reading-time estimates assume about 130 words per minute, which is a typical
  speaking pace but not yours specifically. The Report page shows your real
  measured pace.
