#!/usr/bin/env node
/*
 * refactory-verify.js — hook self-test (v1.13.0).
 *
 * The enforcement has historically been "verified by construction" — tested where it was
 * built, never on the machine it runs on. This script closes most of that gap: it spins up
 * a throwaway .refactory fixture in a temp dir and feeds each hook the exact situations it
 * must respond to, reporting PASS/FAIL per check on THIS machine (this Node, this OS, these
 * paths).
 *
 * Honest residual it cannot cover: whether the host agent (Claude Code) HONORS a deny/block.
 * That needs one 30-second live test: arm a refactor, leave the net pending, ask for a source
 * edit — you should be blocked. This script verifies everything up to that boundary.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const HOOKS = __dirname;
const results = [];
function check(name, ok, detail) { results.push({ name, ok, detail: detail || "" }); }

function runHook(script, input, cwd) {
  const r = spawnSync(process.execPath, [path.join(HOOKS, script)], {
    input: JSON.stringify(input), cwd, encoding: "utf8", timeout: 15000,
  });
  let out = null;
  try { out = JSON.parse(r.stdout || "null"); } catch { out = null; }
  return { code: r.status, out, raw: r.stdout || "", err: r.stderr || "" };
}

function freshDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "refactory-verify-"));
  fs.mkdirSync(path.join(d, ".refactory"), { recursive: true });
  return d;
}
function write(d, rel, content) { fs.writeFileSync(path.join(d, rel), content); }
function sleep(ms) { const end = Date.now() + ms; while (Date.now() < end) {} }

function main() {
  // ---------- 1. PreToolUse gate ----------
  {
    const d = freshDir();
    write(d, ".refactory/guard.json", JSON.stringify({ net: "pending", target: "src/page.tsx" }));
    const deny = runHook("refactory-gate.js", {
      tool_name: "Edit", tool_input: { file_path: path.join(d, "src/page.tsx") }, cwd: d,
    }, d);
    const denied = deny.out && ((deny.out.hookSpecificOutput || {}).permissionDecision === "deny" ||
                                deny.out.decision === "deny" || deny.out.decision === "block");
    check("gate: denies source edit while net pending", !!denied,
          denied ? "" : "no deny in output: " + deny.raw.slice(0, 120));

    const testEdit = runHook("refactory-gate.js", {
      tool_name: "Edit", tool_input: { file_path: path.join(d, "src/page.test.tsx") }, cwd: d,
    }, d);
    const testAllowed = !testEdit.out || (!testEdit.out.decision &&
      !(testEdit.out.hookSpecificOutput || {}).permissionDecision ||
      (testEdit.out.hookSpecificOutput || {}).permissionDecision === "allow");
    check("gate: allows TEST-file edit while pending (so the net can be built)", testAllowed);

    write(d, ".refactory/guard.json", JSON.stringify({ net: "green", surface: "none" }));
    const after = runHook("refactory-gate.js", {
      tool_name: "Edit", tool_input: { file_path: path.join(d, "src/page.tsx") }, cwd: d,
    }, d);
    const allowed = !after.out || (!after.out.decision &&
      (!(after.out.hookSpecificOutput || {}).permissionDecision ||
       (after.out.hookSpecificOutput || {}).permissionDecision === "allow"));
    check("gate: allows source edit once net is resolved", allowed);
  }

  // ---------- 2. Stop hook ----------
  {
    const d = freshDir();
    // ledger missing -> block
    write(d, ".refactory/guard.json", JSON.stringify({ net: "green", surface: "none" }));
    const b1 = runHook("refactory-ledger-check.js", { stop_hook_active: false }, d);
    check("stop: blocks finishing when the ledger wasn't persisted",
          !!(b1.out && b1.out.decision === "block" && /learnings\.md/.test(b1.out.reason || "")));

    // net green without surface -> net-depth block
    sleep(30);
    write(d, ".refactory/learnings.md", "## Lessons\n- l.\n\n## Session log\n### t\n- Surfaced: none\n");
    sleep(30);
    write(d, ".refactory/guard.json", JSON.stringify({ net: "green" }));
    sleep(30);
    write(d, ".refactory/learnings.md", "## Lessons\n- l.\n\n## Session log\n### t\n- Surfaced: none\n");
    const b2 = runHook("refactory-ledger-check.js", { stop_hook_active: false }, d);
    check("stop: blocks green net with no mutation-surface inventory (net-depth)",
          !!(b2.out && b2.out.decision === "block" && /NET-DEPTH/.test(b2.out.reason || "")));

    // clean close-out -> allow + dashboard regenerated
    write(d, ".refactory/guard.json", JSON.stringify({ net: "green", surface: "none" }));
    sleep(30);
    write(d, ".refactory/learnings.md", "## Lessons\n- l.\n\n## Session log\n### t\n- Surfaced: none\n");
    const b3 = runHook("refactory-ledger-check.js", { stop_hook_active: false }, d);
    const allowedClean = !b3.out || !b3.out.decision;
    check("stop: allows a complete close-out", allowedClean);
    check("stop: regenerates the dashboard on a clean close-out",
          fs.existsSync(path.join(d, ".refactory/dashboard.html")));

    // loop guard
    write(d, ".refactory/guard.json", JSON.stringify({ net: "green" }));
    const b4 = runHook("refactory-ledger-check.js", { stop_hook_active: true }, d);
    check("stop: never loops (stop_hook_active honored)", !b4.out || !b4.out.decision);
  }

  // ---------- 3. SessionStart lessons injection ----------
  {
    const d = freshDir();
    write(d, ".refactory/learnings.md", "# x\n\n## Lessons\n- verify-me lesson.\n\n## Session log\n### t\n- ok\n");
    const r = runHook("refactory-load-lessons.js", {}, d);
    const ctx = r.out && r.out.hookSpecificOutput && r.out.hookSpecificOutput.additionalContext;
    check("sessionstart: injects the Lessons section into context",
          !!(ctx && ctx.includes("verify-me lesson")));
  }

  // ---------- 4. Dashboard generator ----------
  {
    const d = freshDir();
    write(d, ".refactory/learnings.md", "# x\n\n## Lessons\n- l.\n\n## Session log\n### 2026-01-01 s\n- Net: green\n");
    let ok = false;
    try { ok = !!require("./refactory-dashboard.js").generate(path.join(d, ".refactory")).htmlPath; } catch {}
    check("dashboard: generates from project data", ok && fs.existsSync(path.join(d, ".refactory/dashboard.html")));
  }

  // ---------- report ----------
  const pass = results.filter((r) => r.ok).length;
  console.log("refactory self-test — " + pass + "/" + results.length + " checks passed on this machine\n");
  for (const r of results) {
    console.log((r.ok ? "  PASS  " : "  FAIL  ") + r.name + (r.ok || !r.detail ? "" : "\n         " + r.detail));
  }
  console.log("\nWhat this proves: the hook scripts respond correctly in THIS environment (Node " +
              process.version + ", " + os.platform() + ").");
  console.log("What it cannot prove: that the host agent honors a deny/block. One live test remains:");
  console.log("  arm a refactor, leave the net pending, ask for a source edit — you should be blocked.");
  process.exit(pass === results.length ? 0 : 1);
}
main();
