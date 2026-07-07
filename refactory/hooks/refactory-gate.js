#!/usr/bin/env node
/*
 * refactory-gate.js — PreToolUse net-gate (opt-in, fail-open).
 *
 * Enforces the no-net gate HARD, but only while a guarded refactor is armed
 * (a `.refactory/guard.json` sentinel exists in the project). When not armed,
 * it does nothing, so normal coding is never blocked.
 *
 * While armed and the net decision is unresolved, it DENIES edits to source
 * files — forcing the agent to resolve the net question (write tests, or get
 * explicit user consent) before touching code. It always ALLOWS edits to
 * `.refactory/**` (so the gate can be answered) and to test files (so option
 * "write characterization tests first" works).
 *
 * Fail-open by design: any error or unrecognized state -> allow. A format
 * mismatch degrades to "no enforcement," never to "everything blocked."
 */
const fs = require("fs");
const path = require("path");

function readStdin() { try { return fs.readFileSync(0, "utf8"); } catch { return ""; } }
function allow() { process.exit(0); } // emit nothing -> default allow
function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

function findGuard(startDir) {
  // walk up to find a .refactory/guard.json
  let dir = startDir;
  for (let i = 0; i < 8 && dir; i++) {
    const g = path.join(dir, ".refactory", "guard.json");
    try { if (fs.existsSync(g)) return g; } catch {}
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const TEST_RX = /(\.test\.|\.spec\.|__tests__\/|_test\.|\/test_|\.cy\.|e2e\/|playwright)/i;
// Clearly-non-source files are never "behavior we must preserve" — docs, notes, plans, prose.
// The gate protects SOURCE; blocking these (e.g. NOTES.md at a single-file project's root) is
// pure friction with no safety value. Allow them regardless of arm state.
const NONSOURCE_RX = /\.(md|mdx|markdown|rst|txt|adoc)$/i;
const NONSOURCE_NAME_RX = /(^|[\\/])(NOTES|README|CHANGELOG|TODO|LICENSE|REFACTORING_PLAN)(\.[^.\\/]+)?$/i;

function main() {
  let input = {};
  try { input = JSON.parse(readStdin() || "{}"); } catch { return allow(); }

  const ti = input.tool_input || {};
  const filePath = typeof ti.file_path === "string" ? ti.file_path : "";
  if (!filePath) return allow();

  // never gate edits to the .refactory dir itself (the gate is answered there)
  if (/(^|[\\/])\.refactory[\\/]/.test(filePath)) return allow();
  // never gate test files — writing a net is the encouraged path
  if (TEST_RX.test(filePath)) return allow();
  // never gate clearly-non-source files (docs/notes/plans) — they aren't behavior under test
  if (NONSOURCE_RX.test(filePath) || NONSOURCE_NAME_RX.test(filePath)) return allow();

  const guardPath = findGuard(path.dirname(filePath) || process.cwd());
  if (!guardPath) return allow(); // not armed -> normal coding, no enforcement

  let net = "pending";
  try { net = (JSON.parse(fs.readFileSync(guardPath, "utf8")).net || "pending").toLowerCase(); } catch {}

  if (net === "green" || net === "accepted-risk") return allow();

  // v1.13.0 — enforcement observability: record the deny (local telemetry, fail-open),
  // so the dashboard can show how often the gate actually fires and on what.
  try {
    fs.appendFileSync(path.join(path.dirname(guardPath), "events.log"),
      JSON.stringify({ ts: new Date().toISOString(), hook: "gate", action: "deny",
        file: path.basename(filePath), net }) + "\n");
  } catch { /* never block on telemetry */ }

  return deny(
    "refactory guarded refactor is active and the safety net is unresolved (net: " + net + "). " +
    "Do NOT edit source yet. Present the user the structured net decision and wait for their pick: " +
    "A) write characterization/smoke tests first, B) accept the risk and proceed, C) don't refactor, " +
    "D) hybrid — refactor only the LOW/MEDIUM-risk band. Record the choice in .refactory/guard.json by " +
    "setting \"net\" to \"green\" (option A, tests now exist) or \"accepted-risk\" (option B), plus a " +
    "\"decision\" letter. Editing test files and .refactory/ is allowed in the meantime."
  );
}
try { main(); } catch { allow(); }
