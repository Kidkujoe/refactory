#!/usr/bin/env node
/*
 * refactory-load-lessons.js — SessionStart hook (silent, fail-open).
 *
 * 1. Injects ONLY the "## Lessons" section of .refactory/learnings.md into context,
 *    so distilled lessons reliably reach the agent (raw session log is NOT injected).
 * 2. v1.11.0 — AUTO-ARCHIVE: if the session log has grown past 15 entries, the oldest
 *    entries are mechanically moved to .refactory/archive/learnings-archive.md, keeping
 *    the 15 most recent live. This is pure data movement (no judgment, no behavior
 *    change), which is exactly why it's safe to automate — the distill nudge fired for
 *    weeks and nothing acted on it; mechanical steps stick, advisory ones don't.
 *    Safety: archive is appended FIRST and verified before learnings.md is rewritten;
 *    on any doubt, nothing is touched (fail-open, move-not-delete).
 * 3. v1.11.0 — TERSENESS BUDGET: warns when the Lessons list drifts past ~12 bullets or
 *    a lesson runs over 2 lines ("once it's long enough to skim past, it has stopped
 *    working"). Advisory — wording is judgment, so it stays human.
 * 4. [PROMOTE] nudge now points at the `/refactor promote` command, which generates a
 *    ready-to-approve skill edit so approval is the only remaining effort.
 * 5. v1.15.0 — STALENESS AUTO-TRIGGER: flags any Lesson that names a repo-relative file path
 *    which no longer exists ("still true?" re-audit signal, feeding `/refactor review`). It
 *    only flags backticked tokens that look like real paths (contain "/" and a file
 *    extension), so prose like `git status` is never flagged. Advisory only — it surfaces a
 *    review candidate, never edits or removes a lesson. Fail-open like everything else here.
 * 6. v1.15.0 — REPURPOSE-NOT-DUPLICATE (Level 1, word-overlap): flags a live Lesson that
 *    strongly overlaps a PARKED lesson in .refactory/archive/retired-lessons.md, so a
 *    recurring idea gets repurposed (re-audition) instead of silently re-added as a fresh
 *    duplicate. Word-overlap only; semantic/meaning matching is the agent's job at
 *    `/refactor review` (read inline, or via a read-only subagent if the archive is large).
 *    Conservative threshold to stay quiet — a noisy flag is worse than none. Advisory,
 *    fail-open; never edits or moves a lesson.
 */
const fs = require("fs");
const path = require("path");

const KEEP_RECENT = 15;
const LESSONS_CAP = 2000; // v1.16.0 — max chars of Lessons injected into context (trust-surface + focus)

/* v1.16.0 — cap the injected Lessons section. It is prepended to the agent's context every
 * session, so an unbounded list both costs tokens and (per the plugin's own rule) stops working
 * once it's long enough to skim past. Truncate at a line boundary and point at /refactor review. */
function capLessons(lessons) {
  if (lessons.length <= LESSONS_CAP) return lessons;
  const cut = lessons.lastIndexOf("\n", LESSONS_CAP);
  const head = lessons.slice(0, cut > 0 ? cut : LESSONS_CAP).trimEnd();
  return head + "\n\n(…Lessons truncated at ~" + LESSONS_CAP +
    " chars — too long to stay sharp; run `/refactor review` to distill.)";
}

function readStdin() { try { return fs.readFileSync(0, "utf8"); } catch { return ""; } }

function findLog(startDir) {
  let dir = startDir;
  for (let i = 0; i < 8 && dir; i++) {
    const p = path.join(dir, ".refactory", "learnings.md");
    try { if (fs.existsSync(p)) return p; } catch {}
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function extractLessons(md) {
  const lines = md.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+Lessons\b/i.test(lines[i])) { start = i; break; }
  }
  if (start === -1) return "";
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    out.push(lines[i]);
  }
  const body = out.join("\n").replace(/<!--[\s\S]*?-->/g, "").trim();
  const meaningful = body.split("\n").slice(1).some((l) => l.trim().length > 3);
  return meaningful ? body : "";
}

/* Parse the YYYY-MM-DD date out of a "### " entry header; null if the header carries none. */
function entryDate(headerLine) {
  const m = headerLine.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return m ? m[1] : null;
}

/* v1.11.0 — mechanical archive of old session-log entries. Returns count archived (0 if none).
 * v1.16.0 — ORDER-AGNOSTIC: the documented format is "newest first" but nothing forces the
 * agent to prepend vs append, so this no longer assumes file order. It keys off each entry's
 * ### YYYY-MM-DD date and archives the OLDEST by date, keeping the KEEP_RECENT newest live —
 * correct whether entries are appended (oldest-first) or prepended (newest-first). Fail-safe:
 * an entry whose header has no parseable date is NEVER archived (we don't move what we can't
 * order), so a malformed/undated header degrades to "kept", never to "wrong entry moved". */
function autoArchive(logPath, md) {
  // Locate the "## Session log" section; entries are "### " blocks inside it.
  const lines = md.split(/\r?\n/);
  let secStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+Session log\b/i.test(lines[i])) { secStart = i; break; }
  }
  if (secStart === -1) return 0; // unexpected shape — touch nothing

  // Section ends at the next "## " heading or EOF.
  let secEnd = lines.length;
  for (let i = secStart + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) { secEnd = i; break; }
  }

  // Collect entry boundaries (### headings) within the section, with each entry's parsed date.
  const starts = [];
  for (let i = secStart + 1; i < secEnd; i++) {
    if (/^###\s+/.test(lines[i])) starts.push(i);
  }
  if (starts.length <= KEEP_RECENT) return 0;
  const entries = starts.map((s, idx) => ({
    start: s,
    end: idx + 1 < starts.length ? starts[idx + 1] : secEnd, // exclusive
    date: entryDate(lines[s]),
  }));

  // Rank oldest-first BY DATE. Undated entries sort last (sentinel "9999-…") so they're never
  // selected for archiving; ties break on file order for stability.
  const cutCount = entries.length - KEEP_RECENT;
  const ranked = entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const da = a.e.date || "9999-99-99", db = b.e.date || "9999-99-99";
      return da < db ? -1 : da > db ? 1 : a.i - b.i;
    });
  const toArchive = ranked.slice(0, cutCount).map((r) => r.e).filter((e) => e.date);
  if (!toArchive.length) return 0; // nothing datable to archive — keep everything

  // Write the archive in chronological order (readable history), independent of file order.
  toArchive.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start - b.start));
  const archived = toArchive.map((e) => lines.slice(e.start, e.end).join("\n").trimEnd()).join("\n");
  if (!archived) return 0;

  // 1) Append to the archive FIRST (move-not-delete: data exists in two places before one).
  const dir = path.join(path.dirname(logPath), "archive");
  const archivePath = path.join(dir, "learnings-archive.md");
  const stamp = new Date().toISOString().slice(0, 10);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const header = fs.existsSync(archivePath) ? "" : "# refactory learnings — archived session-log entries\n\n";
    fs.appendFileSync(archivePath,
      header + "<!-- auto-archived " + stamp + " (" + toArchive.length + " entries, oldest by date) -->\n" + archived + "\n\n");
    // verify the write landed before touching the source
    const check = fs.readFileSync(archivePath, "utf8");
    if (!check.includes(archived.slice(0, 200))) return 0;
  } catch { return 0; } // archive failed — leave learnings.md untouched

  // 2) Only now rewrite learnings.md without the archived entries (they may be non-contiguous).
  try {
    const drop = new Set();
    for (const e of toArchive) for (let i = e.start; i < e.end; i++) drop.add(i);
    fs.writeFileSync(logPath, lines.filter((_, i) => !drop.has(i)).join("\n"));
  } catch { return 0; } // rewrite failed — worst case is duplication, never loss
  return toArchive.length;
}

/* v1.11.0 — terseness budget on the Lessons section. Returns a warning string or "". */
function tersenessCheck(lessons) {
  const lines = lessons.split("\n").slice(1); // drop the heading
  let bullets = 0, curLines = 0, curChars = 0, overlong = 0;
  const close = () => { if (bullets > 0 && (curLines > 2 || curChars > 200)) overlong++; };
  for (const l of lines) {
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      close();
      bullets++; curLines = 1; curChars = l.length;
    } else if (l.trim() && bullets > 0) {
      curLines++; curChars += l.length;
    }
  }
  close();
  const warns = [];
  if (bullets > 12) warns.push(bullets + " lessons (budget ~12) — distill: merge overlapping ones, prune superseded ones");
  if (overlong > 0) warns.push(overlong + " lesson(s) over 2 lines — rewrite as terse imperatives; once a lesson is long enough to skim past, it has stopped working");
  return warns.join("; ");
}

/* v1.12.0 — mechanical archive of old CLOSED backlog items. Open items are never touched.
 * Same rules as the learnings archive: pure data movement, move-not-delete (archive written
 * and verified first), entries moved WHOLE — never stripped or summarized, because the
 * archive is searchable history (a past bug in a file is a risk signal for its next fixer). */
function archiveBacklog(rdir) {
  const KEEP_CLOSED = 10;
  const blPath = path.join(rdir, "backlog.md");
  let md = "";
  try { md = fs.readFileSync(blPath, "utf8"); } catch { return 0; }
  const lines = md.split(/\r?\n/);
  // An item = its bullet line plus following indented/continuation lines until the next bullet/heading/blank-then-bullet.
  const items = []; // {start, end(excl), closed}
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*-\s*\[(x| )\]/i.test(lines[i])) {
      let end = i + 1;
      while (end < lines.length && !/^\s*-\s*\[(x| )\]/i.test(lines[end]) && !/^#/.test(lines[end])) end++;
      items.push({ start: i, end, closed: /^\s*-\s*\[x\]/i.test(lines[i]) });
      i = end - 1;
    }
  }
  const closed = items.filter((it) => it.closed);
  if (closed.length <= KEEP_CLOSED) return 0;
  const toMove = closed.slice(0, closed.length - KEEP_CLOSED); // oldest first (file order)
  const movedText = toMove.map((it) => lines.slice(it.start, it.end).join("\n").trimEnd()).join("\n");

  const dir = path.join(rdir, "archive");
  const archivePath = path.join(dir, "backlog-archive.md");
  const stamp = new Date().toISOString().slice(0, 10);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const header = fs.existsSync(archivePath) ? "" : "# refactory backlog — archived closed items\n\n";
    fs.appendFileSync(archivePath, header + "<!-- auto-archived " + stamp + " (" + toMove.length + " closed items) -->\n" + movedText + "\n\n");
    const check = fs.readFileSync(archivePath, "utf8");
    if (!check.includes(movedText.slice(0, 120))) return 0;
  } catch { return 0; }
  try {
    const drop = new Set();
    for (const it of toMove) for (let i = it.start; i < it.end; i++) drop.add(i);
    fs.writeFileSync(blPath, lines.filter((_, i) => !drop.has(i)).join("\n"));
  } catch { return 0; }
  return toMove.length;
}

/* v1.15.0 — staleness auto-trigger (advisory, fail-open). Returns a warning string or "".
 * Flags Lessons that name a repo-relative file path which no longer exists. Conservative on
 * purpose: only a single path-like backticked token (no spaces) that contains "/" AND ends in
 * a file extension is checked, so commands and bare names are never false-flagged. */
function stalenessCheck(lessons, repoRoot) {
  const missing = new Set();
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(lessons)) !== null) {
    const tok = m[1].trim();
    if (!/^[\w.\-/]+$/.test(tok)) continue;   // single path-like token, no spaces
    if (!tok.includes("/")) continue;          // require a path, not a bare name/command
    if (!/\.\w{1,5}$/.test(tok)) continue;     // require a file extension
    try { if (!fs.existsSync(path.join(repoRoot, tok))) missing.add(tok); } catch {}
  }
  if (!missing.size) return "";
  const list = [...missing].slice(0, 5).join(", ");
  return missing.size + " lesson path(s) no longer exist (" + list +
    ") — re-audit those lessons (still true? demote/retire if stale; run `/refactor review`)";
}

/* v1.15.0 — pull individual bullet texts out of a markdown list (continuation lines folded in). */
function bulletTexts(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let cur = null;
  for (const l of lines) {
    const m = l.match(/^\s*[-*]\s+(.*)$/);
    if (m) { if (cur !== null) out.push(cur); cur = m[1]; }
    else if (cur !== null && l.trim() && !/^#/.test(l)) { cur += " " + l.trim(); }
    else if (cur !== null) { out.push(cur); cur = null; }
  }
  if (cur !== null) out.push(cur);
  return out;
}

const DEDUP_STOP = new Set(
  "the a an to of in on for and or is are be it its with that this you your do as at by from will not no can a's".split(" "));
function dedupToks(s) {
  return new Set((s.toLowerCase().match(/[a-z0-9']+/g) || []).filter((w) => w.length >= 3 && !DEDUP_STOP.has(w)));
}
function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const uni = a.size + b.size - inter;
  return { j: uni ? inter / uni : 0, inter };
}

/* v1.15.0 — repurpose-not-duplicate (Level 1, advisory, fail-open). Flags a LIVE lesson that
 * strongly overlaps a PARKED lesson in .refactory/archive/retired-lessons.md. Conservative:
 * needs Jaccard >= 0.4 AND >= 3 shared significant words, so only a genuine reworded repeat
 * trips it. Returns a nudge string or "". */
function dedupCheck(lessons, rdir) {
  let parked = "";
  try { parked = fs.readFileSync(path.join(rdir, "archive", "retired-lessons.md"), "utf8"); } catch { return ""; }
  const parkedBullets = bulletTexts(parked).map((t) => dedupToks(t)).filter((s) => s.size >= 3);
  if (!parkedBullets.length) return "";
  const live = bulletTexts(lessons).map((t) => ({ t, set: dedupToks(t) })).filter((x) => x.set.size >= 3);
  const hits = [];
  for (const L of live) {
    for (const P of parkedBullets) {
      const { j, inter } = jaccard(L.set, P);
      if (j >= 0.4 && inter >= 3) { hits.push(L.t.slice(0, 45).trim()); break; }
    }
  }
  if (!hits.length) return "";
  return hits.length + " live lesson(s) closely match a parked one (" + hits.slice(0, 3).join("; ") +
    ") — repurpose the parked lesson (re-audition) instead of keeping a duplicate; run `/refactor review`";
}

function main() {
  readStdin(); // consume so the hook doesn't hang
  const logPath = findLog(process.cwd());
  if (!logPath) process.exit(0);
  let md = "";
  try { md = fs.readFileSync(logPath, "utf8"); } catch { process.exit(0); }

  // Auto-archive BEFORE extracting, so the injected view reflects the cleaned file.
  let archivedCount = 0, backlogArchived = 0;
  try { archivedCount = autoArchive(logPath, md); } catch { archivedCount = 0; }
  try { backlogArchived = archiveBacklog(path.dirname(logPath)); } catch { backlogArchived = 0; }
  if (archivedCount > 0) {
    try { md = fs.readFileSync(logPath, "utf8"); } catch { /* keep old md */ }
  }

  const lessons = extractLessons(md);
  if (!lessons) process.exit(0);

  const entryCount = (md.match(/^###\s+/gm) || []).length;
  const promoteCount = (md.match(/\[PROMOTE\]/g) || []).length;
  const nudges = [];
  if (archivedCount > 0) nudges.push("auto-archived " + archivedCount + " old session-log entries to .refactory/archive/ (the " + KEEP_RECENT + " most recent stay live)");
  if (backlogArchived > 0) nudges.push("auto-archived " + backlogArchived + " old CLOSED backlog items to .refactory/archive/ (open items are never archived)");
  if (entryCount >= 8) nudges.push(entryCount + " live session-log entries — a distillation pass is due (promote recurring patterns into Lessons, prune superseded entries)");
  if (promoteCount > 0) nudges.push(promoteCount + " lesson(s) tagged [PROMOTE] — run `/refactor promote` to turn them into a ready-to-approve skill edit");
  const terse = tersenessCheck(lessons);
  if (terse) nudges.push(terse);
  const stale = stalenessCheck(lessons, path.dirname(path.dirname(logPath)));
  if (stale) nudges.push(stale);
  const dup = dedupCheck(lessons, path.dirname(logPath));
  if (dup) nudges.push(dup);

  const note =
    "refactory has accumulated lessons for this project (from past refactoring sessions). " +
    "Treat these as standing guidance for any refactoring this session, alongside the skill's " +
    "discipline:\n\n" + capLessons(lessons) +
    (nudges.length ? "\n\n(housekeeping: " + nudges.join(". ") + ".)" : "");

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: note },
  }));
  process.exit(0);
}
try { main(); } catch { process.exit(0); }
