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

  // ---------- 5. Session-log ordering (v1.16.0 — order-agnostic archive + selection) ----------
  {
    const mkEntry = (dt) => "### " + dt + " — s\n- x\n";
    const mkLog = (entries) => "# refactory learnings\n\n## Lessons\n- l.\n\n## Session log\n" + entries.join("\n") + "\n";
    const dates = [];
    for (let n = 1; n <= 17; n++) dates.push("2026-01-" + String(n).padStart(2, "0"));
    const oldest2 = [dates[0], dates[1]];      // must be archived
    const newest = dates[dates.length - 1];    // must stay live
    const readLive = (d) => fs.readFileSync(path.join(d, ".refactory/learnings.md"), "utf8");
    const readArch = (d) => { const p = path.join(d, ".refactory/archive/learnings-archive.md"); return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : ""; };

    // (a) oldest-first log (append order): oldest entries at the top
    {
      const d = freshDir();
      write(d, ".refactory/learnings.md", mkLog(dates.map(mkEntry)));
      runHook("refactory-load-lessons.js", {}, d);
      const live = readLive(d), arch = readArch(d);
      check("archive (oldest-first log): moves the 2 oldest by date",
            oldest2.every((dt) => arch.includes(dt) && !live.includes(dt)));
      check("archive (oldest-first log): keeps the newest live", live.includes(newest));
    }
    // (b) newest-first log (prepend order): oldest entries at the BOTTOM — the old file-order
    //     assumption would have archived the newest here; date-keying must still pick the oldest.
    {
      const d = freshDir();
      write(d, ".refactory/learnings.md", mkLog(dates.slice().reverse().map(mkEntry)));
      runHook("refactory-load-lessons.js", {}, d);
      const live = readLive(d), arch = readArch(d);
      check("archive (newest-first log): still moves the 2 oldest by date, not by position",
            oldest2.every((dt) => arch.includes(dt) && !live.includes(dt)));
      check("archive (newest-first log): never archives the newest entry", live.includes(newest));
    }
    // (c) ledger-check selects "this session's" entry as the newest by date, not the last in file
    {
      const d = freshDir();
      write(d, ".refactory/guard.json", JSON.stringify({ net: "green", surface: "none" }));
      sleep(30);
      write(d, ".refactory/learnings.md",
        "## Lessons\n- l.\n\n## Session log\n" +
        "### 2026-02-02 — s\n- Surfaced: none\n\n" +
        "### 2026-02-01 — s\n- Surfaced: a real bug\n");   // older entry, last-in-file
      const r = runHook("refactory-ledger-check.js", { stop_hook_active: false }, d);
      check("stop (newest-first log): reads the NEWEST entry (none), ignores the older last-in-file bug",
            !r.out || !r.out.decision);
    }
  }

  // ---------- 6. Gate exemption holes (v1.16.0 — #4a/#4b/#4c) ----------
  {
    const d = freshDir();
    write(d, ".refactory/guard.json", JSON.stringify({ net: "pending", target: "x" }));
    const isDeny = (r) => r.out && (r.out.hookSpecificOutput || {}).permissionDecision === "deny";
    const gate = (file, tool) => runHook("refactory-gate.js",
      { tool_name: tool || "Edit", tool_input: tool === "NotebookEdit"
        ? { notebook_path: path.join(d, file) } : { file_path: path.join(d, file) }, cwd: d }, d);

    // 4a — MDX is executable source now, so it is gated while pending
    check("gate #4a: denies .mdx edit while pending (MDX is source, not prose)",
          isDeny(gate("src/Page.mdx")));
    check("gate #4a: still allows .md edit while pending (real prose)",
          !isDeny(gate("NOTES.md")));
    // 4b — 'playwright'/'e2e' only exempt as path segments, not substrings
    check("gate #4b: denies playwright-app/src/main.ts (substring, not a test path)",
          isDeny(gate("playwright-app/src/main.ts")));
    check("gate #4b: allows tests/e2e/login.spec.ts (e2e as a real dir segment)",
          !isDeny(gate("tests/e2e/login.spec.ts")));
    check("gate #4b: allows e2e/flow.ts (leading e2e/ segment)",
          !isDeny(gate("e2e/flow.ts")));
    // 4c — NotebookEdit target (notebook_path) is gated like any source
    check("gate #4c: denies NotebookEdit on a source .ipynb while pending",
          isDeny(gate("src/analysis.ipynb", "NotebookEdit")));
  }

  // ---------- 7. Option-D instrumentation (v1.16.0 — #3) ----------
  {
    const d = freshDir();
    write(d, ".refactory/guard.json", JSON.stringify({ net: "green", surface: "none",
      decision: "d", deferred: ["app/state/cache.ts", "app/state/**"] }));
    sleep(30);
    write(d, ".refactory/learnings.md", "## Lessons\n- l.\n\n## Session log\n### 2026-03-01 — s\n- Surfaced: none\n");
    runHook("refactory-ledger-check.js", { stop_hook_active: false }, d);
    let ev = "";
    try { ev = fs.readFileSync(path.join(d, ".refactory/events.log"), "utf8"); } catch {}
    const closeout = ev.split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .find((o) => o && o.action === "closeout");
    check("closeout event records the decision letter (D)", !!(closeout && closeout.decision === "D"));
    check("closeout event records the deferred-file count", !!(closeout && closeout.deferred === 2));
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
