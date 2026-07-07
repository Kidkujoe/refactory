#!/usr/bin/env node
/*
 * refactory-dashboard.js — discipline dashboard generator (v1.12.0).
 *
 * Reads a project's .refactory/ data (learnings.md, archive/, backlog.md, guard.json) and
 * produces (a) a terminal summary and (b) a self-contained interactive dashboard.html
 * (embedded JSON + vanilla JS; time filtering; click-through to raw entries; staleness banner).
 *
 * Governing principle: measure DISCIPLINE, never "quality". There is deliberately no
 * composite score anywhere — a single "refactor health: 87%" number would recreate the
 * vanity-metric trap the tool exists to prevent (see SUCCESS_CRITERIA.md).
 *
 * Provenance honesty (vocabulary borrowed from graphify's EXTRACTED/INFERRED tags):
 *   - "extracted" = read from a structured <!-- refactory-data --> block. Solid.
 *   - "inferred"  = pattern-matched from free-text prose. Approximate (~80%).
 * Every number on the dashboard is one click from the raw entries that produced it.
 *
 * Usable two ways: CLI (`node refactory-dashboard.js [dir]`) or required as a module
 * (the Stop hook calls generate() fail-open after a successful close-out).
 */
const fs = require("fs");
const path = require("path");

/* ---------- locate ---------- */
function findRefactoryDir(startDir) {
  let dir = startDir;
  for (let i = 0; i < 8 && dir; i++) {
    const d = path.join(dir, ".refactory");
    try { if (fs.existsSync(d) && fs.statSync(d).isDirectory()) return d; } catch {}
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
function readSafe(p) { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } }

/* ---------- parse one session entry ---------- */
function parseEntry(heading, body, archived) {
  const e = {
    title: heading.replace(/^###\s+/, "").trim(),
    date: null, archived: !!archived, provenance: "inferred",
    net: null, net_kind: null, net_first: null, self_grade: null,
    gate_stop: null, two_hats: null, moves: [], raw: (heading + "\n" + body).trim(),
  };
  const dm = e.title.match(/\d{4}-\d{2}-\d{2}/);
  if (dm) e.date = dm[0];

  // Structured block first (provenance: extracted)
  const sb = body.match(/<!--\s*refactory-data([\s\S]*?)-->/i);
  if (sb) {
    e.provenance = "extracted";
    for (const line of sb[1].split(/\r?\n/)) {
      const m = line.match(/^\s*([a-z_]+)\s*:\s*(.+?)\s*$/i);
      if (!m) continue;
      const k = m[1].toLowerCase(), v = m[2].trim().toLowerCase();
      if (k === "net") e.net = v;
      else if (k === "net_kind") e.net_kind = v;
      else if (k === "net_first") e.net_first = v.startsWith("y");
      else if (k === "self_grade") e.self_grade = v;
      else if (k === "two_hats") e.two_hats = v;
      else if (k === "gate_stop") e.gate_stop = v.startsWith("y");
      else if (k === "moves") e.moves = m[2].split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  // Tolerant prose inference for anything the block didn't provide
  const t = body;
  if (e.net == null) {
    const m = t.match(/\bnet\b[^:\n]*:\s*\**\s*(green|accepted-risk|accepted risk|none|pending)/i);
    if (m) e.net = m[1].toLowerCase().replace(" ", "-");
    else if (/paused at (the )?gate/i.test(t)) e.net = "pending";
  }
  if (e.net_kind == null) {
    if (/grep/i.test(t) && /not a (behavior )?net|aren'?t nets|source-text/i.test(t)) e.net_kind = null; // mentions the lesson, not this net
    else if (/characteri[sz]ation|behavior net|render net|unit (net|test)|jsdom|\d+\s*tests?/i.test(t)) e.net_kind = "behavior";
  }
  if (e.self_grade == null) {
    const m = t.match(/\b(vs|versus) last entry[^:\n]*:?\s*\**\s*(better|worse|same|neutral|mixed)/i) ||
              t.match(/\b(better|worse)\s+than\s+(the\s+)?last\b/i);
    if (m) { const g = (m[2] || m[1]).toLowerCase(); e.self_grade = g === "same" || g === "mixed" ? "neutral" : g; }
  }
  if (e.gate_stop == null) e.gate_stop = /paused at (the )?gate|stopped at the (no-net )?gate|gate (fired|blocked|stop)/i.test(t);
  if (e.two_hats == null) {
    if (/two-?hats?[^.\n]*violat/i.test(t)) e.two_hats = "violated";
    else if (/two-?hats?[^:\n]*:?\s*\**\s*(held|kept|separate|yes)/i.test(t)) e.two_hats = "held";
  }
  if (!e.moves.length) {
    const m = t.match(/\bmoves?\s*:\s*(.+)/i);
    if (m) e.moves = m[1].split(/[,;]/).map((s) => s.replace(/\(.*?\)/g, "").trim()).filter((s) => s && s.length < 60).slice(0, 8);
  }
  return e;
}

function parseSessionLog(md, archived) {
  const out = [];
  if (!md) return out;
  const lines = md.split(/\r?\n/);
  let cur = null, buf = [];
  const flush = () => { if (cur) out.push(parseEntry(cur, buf.join("\n"), archived)); cur = null; buf = []; };
  for (const l of lines) {
    if (/^###\s+/.test(l)) { flush(); cur = l; }
    else if (cur) {
      if (/^##\s+/.test(l)) { flush(); }
      else buf.push(l);
    }
  }
  flush();
  return out;
}

function parseLessons(md) {
  const lessons = [];
  const lines = md.split(/\r?\n/);
  let inSec = false, cur = null;
  for (const l of lines) {
    if (/^##\s+Lessons\b/i.test(l)) { inSec = true; continue; }
    if (inSec && /^##\s+/.test(l)) break;
    if (!inSec) continue;
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) { if (cur) lessons.push(cur); cur = { text: l.replace(/^\s*([-*]|\d+\.)\s+/, ""), lines: 1 }; }
    else if (cur && l.trim()) { cur.text += " " + l.trim(); cur.lines++; }
  }
  if (cur) lessons.push(cur);
  return lessons.map((x) => ({ text: x.text.replace(/<!--[\s\S]*?-->/g, "").trim(), lines: x.lines,
    promote: /\[PROMOTE\]/.test(x.text), overlong: x.lines > 2 || x.text.length > 200 }));
}

function parseBacklog(md) {
  const items = { open: 0, fixed: 0, byRisk: {} };
  if (!md) return items;
  for (const l of md.split(/\r?\n/)) {
    if (/^\s*-\s*\[ \]/.test(l)) {
      items.open++;
      const m = l.match(/risk\s*:?\s*(HIGH|MEDIUM|LOW)/i);
      const r = m ? m[1].toUpperCase() : "UNBANDED";
      items.byRisk[r] = (items.byRisk[r] || 0) + 1;
    } else if (/^\s*-\s*\[x\]/i.test(l)) items.fixed++;
  }
  return items;
}

function parseEvents(rdir) {
  const out = { gateDenies: 0, stopBlocks: 0, byCondition: {}, recent: [] };
  const raw = readSafe(path.join(rdir, "events.log"));
  if (!raw) return out;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.hook === "gate" && e.action === "deny") out.gateDenies++;
    if (e.hook === "stop" && e.action === "block") {
      out.stopBlocks++;
      for (const c of e.conditions || []) out.byCondition[c] = (out.byCondition[c] || 0) + 1;
    }
    out.recent.push(e);
  }
  out.recent = out.recent.slice(-20);
  return out;
}

/* ---------- collect ---------- */
function collect(rdir) {
  const learnMd = readSafe(path.join(rdir, "learnings.md"));
  const archMd = readSafe(path.join(rdir, "archive", "learnings-archive.md"));
  const backlogMd = readSafe(path.join(rdir, "backlog.md"));
  const backlogArchMd = readSafe(path.join(rdir, "archive", "backlog-archive.md"));
  let guard = null;
  try { guard = JSON.parse(readSafe(path.join(rdir, "guard.json")) || "null"); } catch { guard = null; }

  const sessions = parseSessionLog(archMd, true).concat(parseSessionLog(learnMd, false));
  const lessons = parseLessons(learnMd);
  const backlog = parseBacklog(backlogMd);
  const backlogArchived = parseBacklog(backlogArchMd).fixed;
  const liveEntries = sessions.filter((s) => !s.archived).length;

  return {
    generatedAt: new Date().toISOString(),
    project: path.basename(path.dirname(rdir)),
    sessions, lessons, backlog, backlogArchived, liveEntries,
    events: parseEvents(rdir),
    promotePending: lessons.filter((l) => l.promote).length,
    guardArmed: !!guard, guardNet: guard ? guard.net || null : null,
    counts: summarize(sessions),
  };
}

function summarize(sessions) {
  const c = { total: sessions.length, extracted: 0, inferred: 0,
    net: { green: 0, "accepted-risk": 0, none: 0, pending: 0, unknown: 0 },
    grades: { better: 0, worse: 0, neutral: 0, unknown: 0 },
    gateStops: 0, twoHatsViolations: 0, twoHatsHeld: 0 };
  for (const s of sessions) {
    c[s.provenance]++;
    c.net[s.net && c.net[s.net] !== undefined ? s.net : "unknown"]++;
    c.grades[s.self_grade && c.grades[s.self_grade] !== undefined ? s.self_grade : "unknown"]++;
    if (s.gate_stop) c.gateStops++;
    if (s.two_hats === "violated") c.twoHatsViolations++;
    if (s.two_hats === "held") c.twoHatsHeld++;
  }
  return c;
}

/* ---------- terminal summary ---------- */
function terminal(d) {
  const c = d.counts;
  const L = [];
  L.push("refactory dashboard — " + d.project + "  (generated " + d.generatedAt.slice(0, 16).replace("T", " ") + ")");
  L.push("(no overall score, by design — discipline is measured, quality is judged; see SUCCESS_CRITERIA.md)");
  L.push("");
  L.push("NET DISCIPLINE   " + c.total + " sessions: green " + c.net.green + " | accepted-risk " + c.net["accepted-risk"] +
         " | none " + c.net.none + " | pending " + c.net.pending + " | unknown " + c.net.unknown);
  L.push("LOOP HEALTH      live log " + d.liveEntries + "/15 | lessons " + d.lessons.length + "/~12 (" +
         d.lessons.filter((l) => l.overlong).length + " overlong) | [PROMOTE] pending " + d.promotePending +
         " | archived sessions " + (c.total - d.liveEntries));
  L.push("HONESTY & GATES  self-grade better " + c.grades.better + " / worse " + c.grades.worse +
         " (worse>0 is healthy) | gate stops " + c.gateStops + " | two-hats violations " + c.twoHatsViolations);
  L.push("BACKLOG          open " + d.backlog.open + " (" + Object.entries(d.backlog.byRisk).map(([k, v]) => k + ":" + v).join(" ") +
         ") | fixed live " + d.backlog.fixed + " | fixed archived " + d.backlogArchived);
  L.push("DATA PROVENANCE  extracted (solid) " + c.extracted + " | inferred from prose (approximate) " + c.inferred);
  L.push("ENFORCEMENT      gate denies " + d.events.gateDenies + " | stop blocks " + d.events.stopBlocks +
         (Object.keys(d.events.byCondition).length ? " (" + Object.entries(d.events.byCondition).map(([k, v]) => k + ":" + v).join(" ") + ")" : "") +
         " — blocks firing means the brakes are working; zero forever means they're untested");
  if (d.guardArmed) L.push("GUARD            armed (net: " + d.guardNet + ")");
  return L.join("\n");
}

/* ---------- HTML ---------- */
function html(d) {
  const json = JSON.stringify(d).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>refactory — ${d.project}</title>
<style>
body{font-family:system-ui,Segoe UI,sans-serif;margin:0;background:#f6f7f9;color:#1d2733}
header{background:#16323f;color:#fff;padding:14px 22px}
header h1{margin:0;font-size:18px} header .sub{opacity:.75;font-size:12px;margin-top:4px}
.note{background:#fff8e1;border-left:4px solid #e0a800;padding:8px 14px;font-size:12.5px}
.stale{background:#fdecea;border-left:4px solid #c0392b;padding:8px 14px;font-size:13px;display:none}
.filters{padding:10px 22px}.filters button{margin-right:6px;padding:4px 12px;border:1px solid #b9c4cc;background:#fff;border-radius:4px;cursor:pointer}
.filters button.on{background:#16323f;color:#fff;border-color:#16323f}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px;padding:6px 22px 22px}
.panel{background:#fff;border:1px solid #dde3e8;border-radius:8px;padding:14px}
.panel h2{margin:0 0 10px;font-size:13.5px;text-transform:uppercase;letter-spacing:.4px;color:#3c5667}
.bar{display:flex;height:16px;border-radius:4px;overflow:hidden;margin:6px 0}
.bar div{height:100%}.kv{font-size:13px;margin:3px 0}.kv b{font-weight:600}
.g{background:#2e8b57}.a{background:#e0a800}.r{background:#c0392b}.p{background:#9aa7b0}.u{background:#d4dade}
.badge{display:inline-block;font-size:10.5px;padding:1px 7px;border-radius:9px;margin-left:6px;vertical-align:middle}
.b-ex{background:#dcefe2;color:#1e6b3a}.b-in{background:#eee3c8;color:#7a5d00}
.red{color:#c0392b;font-weight:600}.ok{color:#2e8b57;font-weight:600}
.sub2{font-size:11.5px;color:#5b6c79;margin:-6px 0 10px;font-style:italic}
.gloss{margin:0 22px 8px;background:#fff;border:1px solid #dde3e8;border-radius:8px;font-size:13px}
.gloss summary{padding:10px 14px;cursor:pointer;font-weight:600;color:#3c5667}
.gloss .gbody{padding:0 18px 14px}.gloss dt{font-weight:600;margin-top:8px}.gloss dd{margin:2px 0 0 0;color:#3c4a55}
table{width:100%;border-collapse:collapse;font-size:12.5px}
td,th{padding:5px 8px;border-bottom:1px solid #eef1f4;text-align:left;vertical-align:top}
details{margin:0}summary{cursor:pointer}pre{white-space:pre-wrap;background:#f3f5f7;padding:8px;border-radius:5px;font-size:11.5px;max-height:300px;overflow:auto}
.sessions{padding:0 22px 30px}.sessions .panel{overflow-x:auto}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}
.lesson{font-size:12.5px;margin:5px 0;padding-left:10px;border-left:3px solid #cfd8de}
.lesson.over{border-left-color:#e0a800}
</style></head><body>
<header><h1>refactory — ${d.project}</h1>
<div class="sub">Generated <span id="gen"></span> · <span id="scount"></span> sessions · guard: ${d.guardArmed ? "armed (" + d.guardNet + ")" : "not armed"}</div></header>
<div class="stale" id="stale"></div>
<div class="note"><b>No overall score, by design.</b> Discipline is measured; quality is judged by humans (SUCCESS_CRITERIA.md). Numbers tagged <span class="badge b-ex">extracted</span> come from structured data (solid); <span class="badge b-in">inferred</span> were pattern-matched from prose (approximate). Every number is one click from its raw entries below.</div>
<div class="filters">Range:
<button data-f="all" class="on">All time</button><button data-f="10">Last 10 sessions</button><button data-f="30">Last 30 days</button></div>
<details class="gloss"><summary>What am I looking at? (plain-English guide — no jargon required)</summary><div class="gbody"><dl>
<dt>What is refactory?</dt><dd>A safety discipline for cleaning up code with AI. Its one promise: the code does exactly what it did before the cleanup. This page shows whether that discipline was actually followed, session by session — it is a report card on <i>process</i>, not a grade on the code.</dd>
<dt>Safety net ("net")</dt><dd>A test that proves the cleanup didn't change what the code does. <b>green</b> = a real test passed before and after (the goal). <b>accepted-risk</b> = there was no test, and the human explicitly agreed to proceed anyway — an honest recorded decision, not a failure. <b>none</b> = code was changed with no test and no recorded decision (the bad one). <b>pending</b> = the session stopped at the decision point and changed nothing.</dd>
<dt>Two hats</dt><dd>The core rule: cleaning code and changing what it does are two different jobs, never mixed in one change. A "violation" means a behaviour change was smuggled into a cleanup — should be zero.</dd>
<dt>Gate stop</dt><dd>The tool refused to proceed without a safety decision, and the refusal was honoured instead of bulldozed. Stops are the brakes working — a good sign, not a problem.</dd>
<dt>Self-grade (better / worse)</dt><dd>At the end of each session the AI grades itself against the previous session. Some "worse" entries are <i>healthy</i> — a report card that's all A's means the grading is theatre.</dd>
<dt>Lessons & the live log</dt><dd>Lessons are short rules learned from past sessions, reloaded every session — kept deliberately few (~12) and short, because a long list stops being read. The "live log" is the recent session history; older entries are auto-filed to an archive. <b>[PROMOTE]</b> marks a lesson general enough to be folded into the tool itself, waiting for human approval.</dd>
<dt>Backlog</dt><dd>Bugs the cleanup <i>revealed</i>. The discipline is to write them down rather than quietly fix them mid-cleanup, then fix them properly one at a time afterwards. Open items are a to-do list, not a failure. Risk bands: HIGH = could silently corrupt data; LOW = cosmetic/contained.</dd>
<dt>extracted vs inferred</dt><dd>Where each number came from. <b>extracted</b> = read from structured data the tool recorded — solid. <b>inferred</b> = pattern-matched out of older free-text notes — approximate, roughly 80% reliable. Click any session row to see the raw text behind its numbers.</dd>
<dt>Enforcement events</dt><dd>refactory doesn't just advise — it can refuse: block an edit until a safety decision is made, or block "finished" until the close-out is complete. This panel counts how often those refusals actually happened. Refusals are the brakes doing their job, not errors.</dd>
<dt>Why is there no overall score?</dt><dd>Deliberate. Any single "health: 87%" number gets gamed and ends up rewarding worse work that scores better. Discipline is measured here; quality stays a human judgment.</dd>
</dl></div></details>
<div class="grid">
<div class="panel"><h2>Net discipline</h2><div class="sub2">Did each session prove the code still behaves the same? Mostly green is the goal.</div><div class="bar" id="netbar"></div><div id="netkv"></div></div>
<div class="panel"><h2>Loop health</h2><div class="sub2">Is the learning system being maintained, or silently piling up?</div><div id="loop"></div></div>
<div class="panel"><h2>Honesty &amp; gates</h2><div class="sub2">Is the self-reporting candid, and were the safety brakes respected?</div><div id="honesty"></div></div>
<div class="panel"><h2>Backlog</h2><div class="sub2">Bugs found during cleanups — written down, not quietly patched.</div><div id="backlog"></div></div>
<div class="panel"><h2>Enforcement</h2><div class="sub2">How often the safety brakes actually fired — measured, not guessed.</div><div id="enforce"></div></div>
</div>
<div class="grid"><div class="panel" style="grid-column:1/-1"><h2>Lessons (loaded every session — compliance is judgment, not machine-measured)</h2><div class="sub2">The short rules carried from past sessions into every new one.</div><div id="lessons"></div></div></div>
<div class="sessions"><div class="panel"><h2>Sessions (click to see the raw entry — the evidence behind every number)</h2><table id="tbl"><thead><tr><th>Date / title</th><th>Data</th><th>Net</th><th>Grade</th><th>Gate</th><th>Two hats</th><th>Moves</th></tr></thead><tbody></tbody></table></div></div>
<script>
const D=${json};
document.getElementById('gen').textContent=D.generatedAt.slice(0,16).replace('T',' ');
const ageDays=(Date.now()-new Date(D.generatedAt))/864e5;
if(ageDays>7){const s=document.getElementById('stale');s.style.display='block';
s.textContent='This snapshot is '+Math.floor(ageDays)+' days old — run /refactor dashboard to refresh.'}
function filt(mode){let ss=D.sessions.slice();
if(mode==='10')ss=ss.slice(-10);
if(mode==='30'){const cut=Date.now()-30*864e5;ss=ss.filter(s=>s.date&&new Date(s.date)>=cut)}
return ss}
function count(ss){const c={net:{green:0,'accepted-risk':0,none:0,pending:0,unknown:0},g:{better:0,worse:0,neutral:0,unknown:0},gate:0,viol:0,ex:0,inf:0};
for(const s of ss){c.net[s.net&&c.net[s.net]!==undefined?s.net:'unknown']++;
c.g[s.self_grade&&c.g[s.self_grade]!==undefined?s.self_grade:'unknown']++;
if(s.gate_stop)c.gate++;if(s.two_hats==='violated')c.viol++;s.provenance==='extracted'?c.ex++:c.inf++}return c}
function render(mode){const ss=filt(mode),c=count(ss);
document.getElementById('scount').textContent=ss.length;
const nb=document.getElementById('netbar');nb.innerHTML='';
const order=[['green','g'],['accepted-risk','a'],['none','r'],['pending','p'],['unknown','u']];
for(const[k,cls]of order){const n=c.net[k];if(!n)continue;const div=document.createElement('div');
div.className=cls;div.style.width=(100*n/Math.max(1,ss.length))+'%';div.title=k+': '+n;nb.appendChild(div)}
document.getElementById('netkv').innerHTML=order.map(([k,cls])=>'<div class="kv"><span class="dot '+cls+'"></span>'+k+': <b>'+c.net[k]+'</b></div>').join('')+'<div class="kv" style="margin-top:6px;color:#5b6c79">A real net green-before-and-after is the goal; accepted-risk is an honest recorded decision; none/unknown on a transforming session is the red flag.</div>';
document.getElementById('loop').innerHTML=
'<div class="kv">Live session log: <b class="'+(D.liveEntries>15?'red':'ok')+'">'+D.liveEntries+'</b> / 15 (auto-archived beyond)</div>'+
'<div class="kv">Lessons: <b class="'+(D.lessons.length>12?'red':'ok')+'">'+D.lessons.length+'</b> / ~12 budget, '+D.lessons.filter(l=>l.overlong).length+' overlong</div>'+
'<div class="kv">[PROMOTE] pending: <b class="'+(D.promotePending>0?'red':'ok')+'">'+D.promotePending+'</b>'+(D.promotePending>0?' — run /refactor promote':'')+'</div>'+
'<div class="kv">Archived sessions: <b>'+(D.sessions.length-D.liveEntries)+'</b></div>';
document.getElementById('honesty').innerHTML=
'<div class="kv">Self-grades — better: <b>'+c.g.better+'</b>, worse: <b>'+c.g.worse+'</b>, neutral: <b>'+c.g.neutral+'</b>, unrecorded: '+c.g.unknown+'</div>'+
'<div class="kv" style="color:#5b6c79">Some "worse" entries are a GOOD sign — an all-green ribbon means the self-grading is theatre.</div>'+
'<div class="kv">No-net gate stops honoured: <b>'+c.gate+'</b></div>'+
'<div class="kv">Two-hats violations: <b class="'+(c.viol?'red':'ok')+'">'+c.viol+'</b></div>'+
'<div class="kv">Data: <b>'+c.ex+'</b> extracted <span class="badge b-ex">solid</span> · <b>'+c.inf+'</b> inferred <span class="badge b-in">approx</span></div>';
document.getElementById('backlog').innerHTML=
'<div class="kv">Open bugs: <b>'+D.backlog.open+'</b> '+Object.entries(D.backlog.byRisk).map(([k,v])=>k+': '+v).join(', ')+'</div>'+
'<div class="kv">Fixed (live): <b>'+D.backlog.fixed+'</b> · Fixed (archived): <b>'+D.backlogArchived+'</b></div>'+
'<div class="kv" style="color:#5b6c79">Surfaced-not-silently-fixed is the discipline; open items are a to-do list, not a failure.</div>';
document.getElementById('enforce').innerHTML=
'<div class="kv">Edit-gate denies: <b>'+D.events.gateDenies+'</b> (source edit attempted before the safety decision)</div>'+
'<div class="kv">Finish blocked: <b>'+D.events.stopBlocks+'</b>'+(Object.keys(D.events.byCondition).length?' — '+Object.entries(D.events.byCondition).map(([k,v])=>k+': '+v).join(', '):'')+'</div>'+
'<div class="kv" style="color:#5b6c79">Blocks firing means the brakes are working and being tested. Zero everywhere can mean perfect discipline — or that enforcement never engaged. Run /refactor verify to check the machinery itself.</div>';
document.getElementById('lessons').innerHTML=D.lessons.length?D.lessons.map(l=>'<div class="lesson'+(l.overlong?' over':'')+'">'+esc(l.text)+(l.promote?' <span class="badge b-in">[PROMOTE]</span>':'')+(l.overlong?' <span class="badge b-in">overlong</span>':'')+'</div>').join(''):'<i>none yet</i>';
const tb=document.querySelector('#tbl tbody');tb.innerHTML='';
for(const s of ss.slice().reverse()){const tr=document.createElement('tr');
tr.innerHTML='<td><details><summary>'+esc(s.title)+(s.archived?' <span class="badge b-in">archived</span>':'')+'</summary><pre>'+esc(s.raw)+'</pre></details></td>'+
'<td><span class="badge '+(s.provenance==='extracted'?'b-ex':'b-in')+'">'+s.provenance+'</span></td>'+
'<td>'+(s.net||'—')+'</td><td>'+(s.self_grade||'—')+'</td><td>'+(s.gate_stop?'stop':'—')+'</td><td>'+(s.two_hats||'—')+'</td><td>'+esc((s.moves||[]).join(', '))+'</td>';
tb.appendChild(tr)}}
function esc(x){return String(x||'').replace(/[&<>]/g,t=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[t]))}
document.querySelectorAll('.filters button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.filters button').forEach(x=>x.classList.remove('on'));b.classList.add('on');render(b.dataset.f)});
render('all');
</script></body></html>`;
}

/* ---------- entry points ---------- */
function generate(rdir) {
  const d = collect(rdir);
  const out = path.join(rdir, "dashboard.html");
  fs.writeFileSync(out, html(d));
  return { data: d, htmlPath: out, summary: terminal(d) };
}

if (require.main === module) {
  const start = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const rdir = findRefactoryDir(start);
  if (!rdir) { console.log("refactory dashboard: no .refactory/ found from " + start); process.exit(0); }
  try {
    const r = generate(rdir);
    console.log(r.summary);
    console.log("\nHTML: " + r.htmlPath + "  (git-ignored; regenerated automatically at session close-out)");
  } catch (e) { console.log("refactory dashboard: failed to generate (" + e.message + ")"); process.exit(0); }
}
module.exports = { generate, findRefactoryDir };
