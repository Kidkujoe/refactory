#!/usr/bin/env node
/*
 * DISABLED BY DEFAULT as of v1.9.0 — not wired into hooks.json.
 *
 * This always-on duplicate-block detector was removed from the active hook set after three
 * independent real-world sessions reported it as pure noise: it fired on nearly every edit
 * (legitimate test setup, fixtures, parallel handler structure, files mid-edit) and never once
 * surfaced something actionable. A high-frequency, low-precision advisory channel trains the
 * reader to ignore it — worse than no channel at all. Kept here only as a reference.
 *
 * A worthy replacement would be: on-demand (not fire-on-every-edit), precise (real duplicated
 * LOGIC, not a mechanical 6-consecutive-line text match), suppressed in test files, and gated by
 * an "is this actually extractable / would extraction improve readability?" check before surfacing.
 */
/*
 * refactory-watch.js — flag-only refactoring watcher (conservative edition).
 *
 * Runs as a PostToolUse hook after file edits. It NEVER edits code, NEVER blocks
 * (always exits 0), and stays SILENT unless it finds a strong, specific signal.
 *
 * Design note: an earlier version fired generic "file is long / possible duplication"
 * notes on almost every edit, which trained users to ignore it. A flag that fires
 * always is worthless. So this version reports exactly one thing — a genuinely
 * duplicated block of consecutive lines (real copy-paste) — and says nothing
 * otherwise. A flag here is a credible prompt to consider the refactory skill; it is
 * never an instruction to change code without the usual net-first, ask-first flow.
 */

const fs = require("fs");
const path = require("path");

const CODE_EXT = new Set([
  "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "py", "rb", "go", "rs", "java", "kt", "swift",
  "c", "h", "cpp", "cc", "hpp", "cs", "php", "scala",
]);

const WINDOW = 6; // consecutive lines that must match to count as a duplicated block

function readStdin() {
  try { return fs.readFileSync(0, "utf8"); } catch { return ""; }
}

function collectPaths(input) {
  const paths = new Set();
  const ti = input && input.tool_input ? input.tool_input : {};
  if (typeof ti.file_path === "string") paths.add(ti.file_path);
  if (Array.isArray(ti.files)) {
    for (const f of ti.files) if (f && typeof f.file_path === "string") paths.add(f.file_path);
  }
  return [...paths];
}

function ext(p) {
  const m = /\.([a-z0-9]+)$/i.exec(p);
  return m ? m[1].toLowerCase() : "";
}

// Returns a short message if the file contains a duplicated block, else null.
function findDuplicateBlock(path) {
  let text;
  try {
    const stat = fs.statSync(path);
    if (stat.size > 600 * 1024) return null;
    text = fs.readFileSync(path, "utf8");
  } catch {
    return null;
  }

  // Keep only substantive lines (drop blanks, lone braces, comments, imports) so we
  // don't flag boilerplate as "duplication."
  const raw = text.split(/\r?\n/);
  const lines = [];
  for (const l of raw) {
    const t = l.trim();
    if (t.length < 8) continue;
    if (/^[)\]}{;,]+$/.test(t)) continue;
    if (/^(import|from|#include|using|package|use)\b/.test(t)) continue;
    if (/^(\/\/|\/\*|\*|#|--)/.test(t)) continue;
    lines.push(t);
  }
  if (lines.length < WINDOW * 2) return null;

  // Hash every window of WINDOW consecutive substantive lines; a window seen twice
  // (non-overlapping) is a real duplicated block.
  const seen = new Map();
  for (let i = 0; i + WINDOW <= lines.length; i++) {
    const key = lines.slice(i, i + WINDOW).join("\n");
    if (seen.has(key)) {
      if (i - seen.get(key) >= WINDOW) {
        return `a block of ${WINDOW}+ consecutive lines is duplicated — likely Extract Function / Pull Up Method`;
      }
    } else {
      seen.set(key, i);
    }
  }
  return null;
}

function main() {
  let input = {};
  try { input = JSON.parse(readStdin() || "{}"); } catch { process.exit(0); }

  const paths = collectPaths(input).filter(
    (p) => CODE_EXT.has(ext(p)) && !/node_modules|\.min\.|dist\//.test(p)
  );
  if (paths.length === 0) process.exit(0);

  // D1: while a guarded refactor is armed, transient duplication mid-extraction
  // (the copy that exists before you delete the original) is expected, not a
  // smell. Stay silent so the watcher doesn't flag the user's own in-progress move.
  for (const p of paths) {
    let dir = path.dirname(p);
    for (let i = 0; i < 8 && dir; i++) {
      try { if (fs.existsSync(path.join(dir, ".refactory", "guard.json"))) process.exit(0); } catch {}
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  const reports = [];
  for (const p of paths) {
    const f = findDuplicateBlock(p);
    if (f) reports.push(`${p}: ${f}`);
  }
  if (reports.length === 0) process.exit(0); // silence is the default

  const note =
    "refactory (flag-only): " + reports.join(" | ") +
    ". This is a heuristic hint, not a verdict — if relevant, mention it to the user and " +
    "apply the refactory skill (net first, ask first). Do not refactor automatically.";

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: note },
  }));
  process.exit(0);
}

main();
