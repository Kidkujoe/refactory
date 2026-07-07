#!/usr/bin/env node
/*
 * refactory-ledger-check.js — Stop hook (opt-in, loop-safe).
 *
 * Only acts while a guarded refactor is armed (.refactory/guard.json exists). When the agent
 * tries to finish a turn, it collects ALL unmet close-out conditions and blocks ONCE with a
 * combined message (loop-safe via stop_hook_active). Conditions:
 *   1. Ledger persisted to learnings.md this session.
 *   2. Surfaced bugs logged to backlog.md (not left in prose).
 *   3. Net-depth (v1.10.0): when net=green, a mutation-surface inventory must exist and the
 *      net must assert on the whole stated surface. The hook checks coverage of what you
 *      LISTED — it cannot verify the list is COMPLETE (that's the judgment that fails; the
 *      message says so). Pure behavior-preserving moves set surface:"none".
 *   4. Reviews-read (v1.10.0, best-effort): a fixed backlog item referencing a PR should carry
 *      a "reviewed" note — a green check is not a review.
 * Fail-open on any error.
 */
const fs = require("fs");
const path = require("path");

function readStdin() { try { return fs.readFileSync(0, "utf8"); } catch { return ""; } }
function allow() { process.exit(0); }
function block(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}

function findRefactoryDir(startDir) {
  let dir = startDir;
  for (let i = 0; i < 8 && dir; i++) {
    const d = path.join(dir, ".refactory");
    try { if (fs.existsSync(path.join(d, "guard.json"))) return d; } catch {}
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function asArray(x) { return Array.isArray(x) ? x.map((s) => String(s).trim().toLowerCase()).filter(Boolean) : null; }

/* v1.16.0 — ORDER-AGNOSTIC "this session's entry". The session log may be written newest-first
 * (prepend) or oldest-first (append); the previous lastIndexOf("\n### ") assumed append and so
 * picked the OLDEST entry under a newest-first log. Select the entry with the newest ### date
 * instead. Fail-safe: if no entry carries a parseable YYYY-MM-DD, fall back to the last entry in
 * file order (the old behavior), so undated logs behave exactly as before. */
function currentEntry(md) {
  const lines = md.split(/\r?\n/);
  const idxs = [];
  for (let i = 0; i < lines.length; i++) if (/^###\s+/.test(lines[i])) idxs.push(i);
  if (!idxs.length) return md;
  let bestIdx = null, bestDate = null;
  for (const i of idxs) {
    const m = lines[i].match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (m && (bestDate === null || m[1] >= bestDate)) { bestDate = m[1]; bestIdx = i; }
  }
  if (bestIdx === null) bestIdx = idxs[idxs.length - 1]; // no dates -> last in file order
  let end = lines.length;
  for (let i = bestIdx + 1; i < lines.length; i++) if (/^###\s+/.test(lines[i]) || /^##\s+/.test(lines[i])) { end = i; break; }
  return lines.slice(bestIdx, end).join("\n");
}

/* v1.13.0 — enforcement observability: append one JSON line per block to .refactory/events.log
 * (local telemetry, git-ignored). The dashboard reads it, so the friction is measured, not
 * guessed — gates that never earn their keep can be tuned or cut from evidence. Fail-open. */
function logEvent(rdir, ev) {
  try {
    fs.appendFileSync(path.join(rdir, "events.log"),
      JSON.stringify(Object.assign({ ts: new Date().toISOString() }, ev)) + "\n");
  } catch { /* never block on telemetry */ }
}

/* v1.13.0 — "show me, don't tell me": each item the agent CLAIMS the net asserts on must at
 * least appear in some test file. A mention is not proof of a real assertion (heuristic, not
 * a guarantee) — but it converts pure self-attestation into a checkable claim: you cannot
 * claim "the net asserts on sectionToggles" when no test file even contains that string.
 * Bounded and fail-open: caps on files walked and bytes read; no test files found → skip. */
function assertedInTests(projectRoot, asserted) {
  const SKIP = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", "out", ".refactory"]);
  const testFiles = [];
  const stack = [projectRoot];
  let walked = 0;
  while (stack.length && walked < 800 && testFiles.length < 120) {
    const dir = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      walked++;
      if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.startsWith(".")) stack.push(path.join(dir, e.name)); }
      else if (/\.(test|spec)\.[jt]sx?$|_test\.(py|go|rb)$|test_.*\.py$/i.test(e.name) ||
               /__tests__/.test(dir)) testFiles.push(path.join(dir, e.name));
    }
  }
  if (!testFiles.length) return { skipped: true, missing: [] };
  let corpus = "";
  for (const f of testFiles.slice(0, 60)) {
    try { const st = fs.statSync(f); if (st.size < 262144) corpus += fs.readFileSync(f, "utf8").toLowerCase() + "\n"; } catch {}
  }
  return { skipped: false, missing: asserted.filter((a) => !corpus.includes(a)) };
}

function main() {
  let input = {};
  try { input = JSON.parse(readStdin() || "{}"); } catch { return allow(); }

  if (input.stop_hook_active === true) return allow(); // already nudged once; don't loop

  const rdir = findRefactoryDir(process.cwd());
  if (!rdir) return allow(); // not armed

  const guard = path.join(rdir, "guard.json");
  const log = path.join(rdir, "learnings.md");
  const backlog = path.join(rdir, "backlog.md");

  let g = {};
  try { g = JSON.parse(fs.readFileSync(guard, "utf8")); } catch { g = {}; }
  const net = String(g.net || "pending").toLowerCase();

  // B3: still at the net-decision gate — nothing has happened yet, don't demand close-out.
  if (net === "pending") return allow();

  let guardMtime = 0, logMtime = -1, backlogMtime = -1;
  try { guardMtime = fs.statSync(guard).mtimeMs; } catch { return allow(); }
  try { logMtime = fs.statSync(log).mtimeMs; } catch { logMtime = -1; }
  try { backlogMtime = fs.statSync(backlog).mtimeMs; } catch { backlogMtime = -1; }

  const violations = [];

  // 1. Ledger persisted this session?
  if (logMtime < guardMtime) {
    violations.push(
      "LEDGER: .refactory/learnings.md wasn't updated this session. Append this session's discipline " +
      "ledger (net status, behavior preserved, moves, two-hats, where you stopped, surfaced), noting " +
      "better/worse vs the last entry."
    );
  } else {
    // 2. Surfaced bugs logged to backlog? Only the LAST session-log entry (this session's)
    // counts — matching anywhere in the file would false-block forever on old entries
    // whose bugs were already logged in their own sessions (latent bug fixed in v1.12.0).
    try {
      const md = fs.readFileSync(log, "utf8");
      const lastEntry = currentEntry(md); // this session's entry = newest by date (order-agnostic)
      const m = lastEntry.match(/surfaced[^:\n]*:\s*(.+)/i);
      if (m) {
        const v = m[1].trim().toLowerCase();
        const empty = !v || v.startsWith("<") || v.includes("if any") ||
          ["none", "none.", "n/a", "na", "-", "(none)", "nothing", "no", "no bugs"].includes(v);
        if (!empty && backlogMtime < guardMtime) {
          violations.push(
            "BACKLOG: the ledger surfaced bugs but they're not in .refactory/backlog.md this session. " +
            "Add each as its own item (stable ID + risk band + blast-radius, status: open), then offer " +
            "the fix phase (\"/refactor fix\"). Don't leave surfaced bugs in prose — they rot there."
          );
        }
      }
    } catch { /* ignore */ }
  }

  // 3. Net-depth: only when claiming a real net (green). accepted-risk already logged "no/limited net".
  if (net === "green") {
    const surfaceRaw = g.surface;
    const surfaceNone = surfaceRaw === "none" || (Array.isArray(surfaceRaw) && surfaceRaw.length === 0);
    const surface = asArray(surfaceRaw);
    const asserted = asArray(g.asserted) || [];
    if (surfaceRaw === undefined || surfaceRaw === null) {
      violations.push(
        "NET-DEPTH: net is green but no mutation-surface inventory is recorded. In guard.json set " +
        "\"surface\" to the list of everything this operation writes (every field, store, side-effect) " +
        "and \"asserted\" to what the net actually checks — or \"surface\":\"none\" for a pure " +
        "behavior-preserving move with no mutated state. Net-first without net-depth is a trap: a " +
        "shallow green net ships bugs while feeling safe. NOTE: the hook only checks you covered what " +
        "you LISTED — it cannot tell if your surface list is complete, so enumerate adversarially " +
        "(other stores? rollback paths? persisted prefs? snapshot/restore?)."
      );
    } else if (!surfaceNone && surface) {
      const missing = surface.filter((s) => !asserted.includes(s));
      if (missing.length) {
        violations.push(
          "NET-DEPTH: the operation mutates [" + surface.join(", ") + "] but the net only asserts on [" +
          asserted.join(", ") + "]. Uncovered: [" + missing.join(", ") + "] — these can break while the " +
          "net stays green. Assert on the full surface, or record why an item is intentionally excluded."
        );
      } else if (asserted.length) {
        // v1.13.0: cross-check the CLAIM against the actual test files (show me, don't tell me).
        try {
          const probe = assertedInTests(path.dirname(rdir), asserted);
          if (!probe.skipped && probe.missing.length) {
            violations.push(
              "NET-EVIDENCE: guard.json claims the net asserts on [" + probe.missing.join(", ") + "] but " +
              "no test file even mentions " + (probe.missing.length > 1 ? "them" : "it") + ". A claimed " +
              "assertion with no trace in the tests is self-attestation, not coverage — add the real " +
              "assertion(s), or correct the inventory to what the net actually checks."
            );
          }
        } catch { /* fail open */ }
      }
    }
  }

  // 4. Reviews-read (best-effort): a fixed item citing a PR but with no "review" note, updated this session.
  try {
    if (backlogMtime >= guardMtime) {
      const bl = fs.readFileSync(backlog, "utf8");
      const offender = bl.split(/\r?\n/).some((line) =>
        /\[x\]/i.test(line) && /\bpr\b|pr\s*#|pull request/i.test(line) && !/review/i.test(line));
      if (offender) {
        violations.push(
          "REVIEWS: a fixed backlog item cites a PR but has no record its review threads were read. A " +
          "green check is not a review — pull the threads (e.g. gh pr view --json reviews), triage each " +
          "finding, and note \"reviewed: ...\" on the item before finishing."
        );
      }
    }
  } catch { /* ignore */ }

  if (violations.length) {
    logEvent(rdir, { hook: "stop", action: "block",
      conditions: violations.map((v) => v.split(":")[0]) });
    return block(
      "Guarded refactor close-out is incomplete (" + violations.length + " item(s)). Address all before " +
      "finishing, then you can stop:\n\n- " + violations.join("\n\n- ") +
      "\n\nWhen the whole refactor is complete, clear the guard by deleting .refactory/guard.json."
    );
  }

  // v1.16.0 (#3): one close-out event per guarded session recording the decision letter and how
  // many files were deferred (option D). This is the evidence base for whether hybrid/D refactors
  // are common enough to ever justify building scope enforcement — measure before we build.
  logEvent(rdir, { hook: "stop", action: "closeout", net,
    decision: (g.decision ? String(g.decision).toUpperCase() : null),
    deferred: Array.isArray(g.deferred) ? g.deferred.length : 0 });

  // v1.12.0: close-out is complete — regenerate the dashboard snapshot (fail-open; the
  // dashboard is a derived, git-ignored artifact, so refreshing it here means it's current
  // whenever a guarded session actually finishes, without anyone remembering to run it).
  try { require("./refactory-dashboard.js").generate(rdir); } catch { /* never block on this */ }

  return allow();
}
try { main(); } catch { allow(); }
