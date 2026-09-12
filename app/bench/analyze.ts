#!/usr/bin/env tsx
/**
 * Turns the raw call logs into the comparison we report.
 *
 * The headline metric is deliberately NOT wall clock: in this harness each
 * boundary call pays a process start, while in a real agent it pays a model
 * inference — two very different constants. What transfers between the two is
 * the *count* of boundary crossings and the *bytes* that land in the
 * transcript, so those are what we measure.
 */
import fs from "node:fs";
import path from "node:path";

interface Row {
  kind?: string;
  server: string;
  mcpTool: string;
  innerTool?: string;
  argsBytes: number;
  resultBytes: number;
  durationMs: number;
  boundary?: boolean;
  surfaceBytes?: number;
  toolCount?: number;
}

function read(file: string): Row[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/** Rough token estimate. Byte counts are the measured quantity; this is a lens. */
const tokens = (bytes: number) => Math.round(bytes / 4);

function summarize(name: string, rows: Row[]) {
  const calls = rows.filter((r) => !r.kind);
  const boundary = calls.filter((r) => r.boundary);
  const inner = calls.filter((r) => !r.boundary);

  const payloadBytes = boundary.reduce(
    (sum, r) => sum + r.argsBytes + r.resultBytes,
    0,
  );
  const innerBytes = inner.reduce((sum, r) => sum + r.argsBytes + r.resultBytes, 0);
  const chainMs = calls.reduce((sum, r) => sum + r.durationMs, 0);

  return {
    arm: name,
    boundaryCalls: boundary.length,
    innerCalls: inner.length,
    transcriptBytes: payloadBytes,
    transcriptTokens: tokens(payloadBytes),
    hiddenInSandboxBytes: innerBytes,
    chainWorkMs: chainMs,
    byTool: boundary.map((r) => ({
      tool: r.mcpTool,
      bytes: r.argsBytes + r.resultBytes,
      ms: r.durationMs,
    })),
  };
}

const dir = path.join(process.cwd(), "bench/logs");
const baseline = summarize("baseline (tool-per-call)", read(path.join(dir, "baseline.jsonl")));
const mdcp = summarize("mdcp (code mode)", read(path.join(dir, "mdcp.jsonl")));

/**
 * Cumulative context cost.
 *
 * An agent loop re-sends the whole transcript on every turn, so the tokens the
 * provider actually processes grow quadratically with the number of turns. This
 * is where a per-tool loop really pays, and it is why counting only the final
 * transcript understates the gap.
 */
function cumulative(instructionsTokens: number, perCall: { bytes: number }[]) {
  let carried = instructionsTokens;
  let total = 0;
  for (const call of perCall) {
    total += carried; // the model re-reads everything so far, then acts
    carried += tokens(call.bytes);
  }
  return { processedTokens: total, finalContextTokens: carried };
}

// Instruction surface each arm carries: the capability documentation.
const BASELINE_SURFACE = 1_180; // 9 signatures + per-tool JSON schemas
const MDCP_SURFACE = 1_320; // one execute description embedding the same 9 signatures

const report = {
  baseline: {
    ...baseline,
    ...cumulative(tokens(BASELINE_SURFACE), baseline.byTool),
  },
  mdcp: {
    ...mdcp,
    ...cumulative(tokens(MDCP_SURFACE), mdcp.byTool),
  },
};

const ratio = (a: number, b: number) => (b === 0 ? null : +(a / b).toFixed(2));

console.log(JSON.stringify(report, null, 2));
console.log("\n=== headline ===");
console.log(
  `round-trips:        baseline ${report.baseline.boundaryCalls}  vs  mdcp ${report.mdcp.boundaryCalls}   (${ratio(report.baseline.boundaryCalls, report.mdcp.boundaryCalls)}x fewer)`,
);
console.log(
  `transcript tokens:  baseline ${report.baseline.transcriptTokens}  vs  mdcp ${report.mdcp.transcriptTokens}   (${ratio(report.baseline.transcriptTokens, report.mdcp.transcriptTokens)}x)`,
);
console.log(
  `context processed:  baseline ${report.baseline.processedTokens}  vs  mdcp ${report.mdcp.processedTokens}   (${ratio(report.baseline.processedTokens, report.mdcp.processedTokens)}x)`,
);
console.log(
  `data kept out of context by the sandbox: ${report.mdcp.hiddenInSandboxBytes} bytes`,
);
