#!/usr/bin/env tsx
/**
 * Scaling sweep: how the baseline/mdcp gap grows with task size.
 *
 * Task: sweep N Messari standardized subgraphs (same EXCHANGE schema across
 * protocols AND chains — the standardization is what makes one query pattern
 * work on all of them) and report protocol daily volume + top pools.
 *
 * Both arms perform IDENTICAL upstream work per target — search (discovery),
 * schema fetch, financials query, pools query — all served live by the Graph
 * gateway through the unmodified official subgraph-mcp. The only variable is
 * where the results land:
 *
 *   baseline: every call is a boundary crossing; all payloads enter the
 *             transcript (4N round-trips)
 *   mdcp:     one execute() program; payloads stay in the sandbox, only the
 *             compact aggregate crosses (1 round-trip)
 *
 * Deterministic on purpose: no model in the loop, so the curves measure the
 * interaction shape itself, not agent temperament. The real-agent anchor for
 * these curves is scenario 5 (N=3) and scenario 7 (N=10).
 */
import fs from "node:fs";
import path from "node:path";
import { ensureGraphTools } from "../src/graphUpstream.js";
import { TOOL_BY_PATH, jsonSafe } from "../src/tools.js";
import { execute } from "../src/sandbox.js";
import { bytesOf } from "../src/instrument.js";

/** Verified healthy on the network 2026-09-13 (probe: bench/logs/s6-graph-sweep). */
const TARGETS = [
  { kw: "uniswap v3 ethereum", name: "Uniswap V3 Ethereum" },
  { kw: "sushiswap ethereum", name: "Sushiswap Ethereum" },
  { kw: "curve finance ethereum", name: "Curve Finance Ethereum" },
  { kw: "uniswap v3 arbitrum", name: "Uniswap V3 Arbitrum" },
  { kw: "uniswap v3 base", name: "Uniswap V3 Base" },
  { kw: "uniswap v3 polygon", name: "Uniswap V3 Polygon" },
  { kw: "uniswap v3 optimism", name: "Uniswap V3 Optimism" },
  { kw: "uniswap v3 bsc", name: "Uniswap V3 BSC" },
  { kw: "sushiswap arbitrum", name: "Sushiswap Arbitrum" },
  { kw: "pancakeswap v3 bsc", name: "Pancakeswap V3 BSC" },
] as const;

const FIN_Q = `{ protocols(first: 1) { name schemaVersion } financialsDailySnapshots(first: 1, orderBy: timestamp, orderDirection: desc) { dailyVolumeUSD totalValueLockedUSD } }`;
const POOLS_Q = `{ liquidityPools(first: 50, orderBy: cumulativeVolumeUSD, orderDirection: desc) { name totalValueLockedUSD cumulativeVolumeUSD inputTokens { symbol } } }`;

const Ns = [1, 2, 3, 4, 6, 8, 10];

/** Same surface constants as bench/analyze.ts. */
const BASELINE_SURFACE_TOKENS = 295; // 9 tool schemas ≈ 1,180 bytes
const MDCP_SURFACE_TOKENS = 330; // execute description ≈ 1,320 bytes
const tokens = (bytes: number) => Math.round(bytes / 4);

/**
 * Cumulative context: an agent re-reads the whole transcript on every turn, so
 * processed tokens grow quadratically with boundary crossings (see analyze.ts).
 */
function cumulative(surface: number, perCallBytes: number[]) {
  let carried = surface;
  let processed = 0;
  for (const bytes of perCallBytes) {
    processed += carried;
    carried += tokens(bytes);
  }
  return { processedTokens: processed, finalContextTokens: carried };
}

async function call(name: string, args: unknown) {
  const tool = TOOL_BY_PATH.get(name);
  if (!tool) throw new Error(`missing tool ${name}`);
  const result = jsonSafe(await tool.invoke(args));
  return { result, bytes: bytesOf(args) + bytesOf(result) };
}

async function baselineArm(n: number) {
  const perCall: number[] = [];
  const t0 = Date.now();
  for (const t of TARGETS.slice(0, n)) {
    const s = await call("graph.search_subgraphs_by_keyword", { keyword: t.kw });
    perCall.push(s.bytes);
    const hit = (s.result as any).subgraphs?.find(
      (c: any) => c.metadata?.displayName === t.name,
    );
    const id = hit.id;
    for (const [tool, args] of [
      ["graph.get_schema_by_subgraph_id", { subgraph_id: id }],
      ["graph.execute_query_by_subgraph_id", { subgraph_id: id, query: FIN_Q }],
      ["graph.execute_query_by_subgraph_id", { subgraph_id: id, query: POOLS_Q }],
    ] as const) {
      perCall.push((await call(tool, args)).bytes);
    }
  }
  const wallMs = Date.now() - t0;
  const transcriptBytes = perCall.reduce((a, b) => a + b, 0);
  return {
    arm: "baseline",
    n,
    boundaryCalls: perCall.length,
    transcriptBytes,
    hiddenBytes: 0,
    wallMs,
    ...cumulative(BASELINE_SURFACE_TOKENS, perCall),
  };
}

function mdcpProgram(n: number) {
  const targets = JSON.stringify(TARGETS.slice(0, n));
  return `
const targets = ${targets};
const FIN_Q = ${JSON.stringify(FIN_Q)};
const POOLS_Q = ${JSON.stringify(POOLS_Q)};
const out = [];
for (const t of targets) {
  const s = await tools["graph.search_subgraphs_by_keyword"]({ keyword: t.kw });
  const hit = (s.subgraphs ?? []).find((c) => c.metadata?.displayName === t.name);
  if (!hit) { out.push({ target: t.name, error: "not_found" }); continue; }
  const id = hit.id;
  await tools["graph.get_schema_by_subgraph_id"]({ subgraph_id: id }); // same work as baseline
  const fin = await tools["graph.execute_query_by_subgraph_id"]({ subgraph_id: id, query: FIN_Q });
  const pools = await tools["graph.execute_query_by_subgraph_id"]({ subgraph_id: id, query: POOLS_Q });
  const p = fin?.data?.protocols?.[0] ?? {};
  const snap = fin?.data?.financialsDailySnapshots?.[0] ?? {};
  const top = (pools?.data?.liquidityPools ?? [])[0] ?? {};
  out.push({
    target: t.name, id, protocol: p.name,
    dailyVolumeUSD: snap.dailyVolumeUSD, tvlUSD: snap.totalValueLockedUSD,
    topPool: top.name, topPoolVolumeUSD: top.cumulativeVolumeUSD,
  });
}
out.sort((a, b) => Number(b.dailyVolumeUSD ?? 0) - Number(a.dailyVolumeUSD ?? 0));
return out;
`;
}

async function mdcpArm(n: number) {
  const code = mdcpProgram(n);
  const t0 = Date.now();
  const outcome = await execute(code);
  const wallMs = Date.now() - t0;
  if (outcome.status !== "ok") throw new Error(`mdcp arm failed at n=${n}: ${outcome.error}`);
  const resultBytes = bytesOf(JSON.stringify(outcome));
  const perCall = [bytesOf(code) + resultBytes];
  // Hidden bytes: replicate the baseline's measurement inside the sandbox is
  // already logged via instrument when BENCH_LOG is set; here we report the
  // boundary view, which is what the model pays for.
  return {
    arm: "mdcp",
    n,
    boundaryCalls: 1,
    transcriptBytes: perCall[0],
    wallMs,
    result: outcome.result,
    ...cumulative(MDCP_SURFACE_TOKENS, perCall),
  };
}

const rows: any[] = [];
await ensureGraphTools();
for (const n of Ns) {
  const b = await baselineArm(n);
  const m = await mdcpArm(n);
  rows.push(b, { ...m, result: undefined });
  console.error(
    `n=${n}: baseline ${b.boundaryCalls} calls / ${b.transcriptBytes} B / ${b.processedTokens} processed-tok  |  mdcp 1 call / ${m.transcriptBytes} B / ${m.processedTokens} processed-tok  (ratio ${(b.processedTokens / m.processedTokens).toFixed(1)}x)`,
  );
}

const outDir = path.join(process.cwd(), "bench/logs/s6-graph-sweep");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "sweep.json"), JSON.stringify(rows, null, 2));
const csv = [
  "n,arm,boundaryCalls,transcriptBytes,transcriptTokens,processedTokens,finalContextTokens,wallMs",
  ...rows.map(
    (r) =>
      `${r.n},${r.arm},${r.boundaryCalls},${r.transcriptBytes},${tokens(r.transcriptBytes)},${r.processedTokens},${r.finalContextTokens},${r.wallMs}`,
  ),
].join("\n");
fs.writeFileSync(path.join(outDir, "sweep.csv"), csv);
console.error(`wrote ${outDir}/sweep.{json,csv}`);
process.exit(0);
