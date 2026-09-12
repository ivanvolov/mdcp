#!/usr/bin/env tsx
/**
 * Cross-scenario summary.
 *
 * Reads every per-scenario log pair under bench/logs/ and prints the comparison
 * table that goes into BENCHMARK.md. Wall clock and total agent tokens come from
 * the agent runs themselves and are supplied here as recorded constants, since
 * they are measured outside this process.
 */
import fs from "node:fs";
import path from "node:path";

interface Row {
  kind?: string;
  boundary?: boolean;
  mcpTool: string;
  argsBytes: number;
  resultBytes: number;
  durationMs: number;
}

const LOGS = path.join(process.cwd(), "bench/logs");

function read(file: string): Row[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

const tokens = (bytes: number) => Math.round(bytes / 4);

/** Cost the provider actually processes: every turn re-reads the transcript so far. */
function processed(surfaceTokens: number, calls: Row[]) {
  let carried = surfaceTokens;
  let total = 0;
  for (const c of calls) {
    total += carried;
    carried += tokens(c.argsBytes + c.resultBytes);
  }
  return total;
}

// Tool-surface cost carried on every turn. The baseline grows with the catalog;
// mdcp's is one execute description regardless of how many tools sit behind it.
const SURFACE = { baseline: 1_480, mdcp: 1_360 };

interface Scenario {
  name: string;
  files: { baseline: string; mdcp: string };
  /** measured outside this process, from the agent runs */
  wallMs?: { baseline: number; mdcp: number };
  agentTokens?: { baseline: number; mdcp: number };
}

const SCENARIOS: Scenario[] = [
  {
    name: "1. DCA buy (1 leg)",
    files: { baseline: "scenario1/baseline.jsonl", mdcp: "scenario1/mdcp.jsonl" },
    wallMs: { baseline: 72_452, mdcp: 59_597 },
    agentTokens: { baseline: 57_429, mdcp: 59_626 },
  },
  {
    name: "2. Index basket (5 legs)",
    files: { baseline: "scenario2-baseline.jsonl", mdcp: "scenario2-mdcp.jsonl" },
    wallMs: { baseline: 144_466, mdcp: 64_151 },
    agentTokens: { baseline: 62_779, mdcp: 61_124 },
  },
  {
    name: "3. Venue scan (20 tiers)",
    files: { baseline: "s3-venue/baseline.jsonl", mdcp: "s3-venue/mdcp.jsonl" },
    wallMs: { baseline: 543_809, mdcp: 328_310 },
    agentTokens: { baseline: 77_532, mdcp: 70_231 },
  },
  {
    name: "4. Copy-trade (3 mirrors)",
    files: { baseline: "s4-copytrade/baseline.jsonl", mdcp: "s4-copytrade/mdcp.jsonl" },
    wallMs: { baseline: 190_295, mdcp: 116_203 },
    agentTokens: { baseline: 71_365, mdcp: 64_279 },
  },
];

const ratio = (a: number, b: number) => (b === 0 ? "—" : `${(a / b).toFixed(2)}x`);
const pad = (s: string | number, n: number) => String(s).padEnd(n);

console.log(
  pad("scenario", 26) +
    pad("round-trips", 18) +
    pad("hidden ops", 13) +
    pad("context tokens", 22) +
    pad("wall clock", 20) +
    "agent tokens",
);
console.log("-".repeat(115));

for (const scenario of SCENARIOS) {
  const b = read(path.join(LOGS, scenario.files.baseline));
  const m = read(path.join(LOGS, scenario.files.mdcp));
  if (b.length === 0 && m.length === 0) {
    console.log(pad(scenario.name, 26) + "(not run yet)");
    continue;
  }

  const bCalls = b.filter((r) => r.boundary);
  const mCalls = m.filter((r) => r.boundary);
  const mInner = m.filter((r) => !r.boundary && !r.kind);

  const bCtx = processed(tokens(SURFACE.baseline), bCalls);
  const mCtx = processed(tokens(SURFACE.mdcp), mCalls);

  const wall = scenario.wallMs
    ? `${(scenario.wallMs.baseline / 1000).toFixed(0)}s/${(scenario.wallMs.mdcp / 1000).toFixed(0)}s ${ratio(scenario.wallMs.baseline, scenario.wallMs.mdcp)}`
    : "—";
  const agent = scenario.agentTokens
    ? `${scenario.agentTokens.baseline}/${scenario.agentTokens.mdcp} ${ratio(scenario.agentTokens.baseline, scenario.agentTokens.mdcp)}`
    : "—";

  console.log(
    pad(scenario.name, 26) +
      pad(`${bCalls.length} -> ${mCalls.length}  ${ratio(bCalls.length, mCalls.length)}`, 18) +
      pad(String(mInner.length), 13) +
      pad(`${bCtx} -> ${mCtx}  ${ratio(bCtx, mCtx)}`, 22) +
      pad(wall, 20) +
      agent,
  );
}

console.log(
  "\nround-trips = calls that crossed the model boundary (each one costs a full inference)",
);
console.log(
  "hidden ops  = chain calls mdcp made inside the sandbox that never entered the transcript",
);
