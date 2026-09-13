/**
 * Cross-system probe: The Graph -> Hedera HTS, one program.
 *
 * This is the composition case executor.sh's headline number actually measures
 * (1,640 tools -> 1). The single-service Hedera round (BENCHMARK.md §4) was the
 * degenerate case: one well-documented service, nothing for a gateway to
 * collapse. Here two independent systems must be *joined*, and the join is
 * where a per-tool agent pays — every Graph result it wants to act on has to
 * cross into model context, get re-typed into a Hedera script, and cross back.
 *
 * Scenario — "tokenized market snapshot": rank N DEX protocols by latest daily
 * volume via Messari standardized subgraphs, then mint an HTS token on Hedera
 * testnet whose name, symbol and initial supply are *derived from the winner*.
 * The Hedera transaction arguments are data-dependent on The Graph: that
 * dependency is the whole experiment.
 *
 * Runs planning-only by default (execute, no resume) so the Graph half is
 * exercised live while the Hedera half costs zero HBAR. Pass --execute to
 * actually broadcast.
 *
 * Run (from app/):
 *   bash bench/arm-combined.sh help          # sanity: 30-tool merged catalog
 *   npx tsx bench/combined-probe.ts          # plan only, free
 *   npx tsx bench/combined-probe.ts --execute
 */
import { execute, resume } from "../src/sandbox.js";
import { ensureGraphTools, closeGraphUpstream } from "../src/graphUpstream.js";

const BROADCAST = process.argv.includes("--execute");

/** Five protocols: the advantage of code mode scales with the join's width. */
const program = `
  const targets = [
    "Uniswap V3 Ethereum",
    "Uniswap V3 Arbitrum",
    "Uniswap V3 Base",
    "Sushiswap Ethereum",
    "Curve Finance Ethereum",
  ];
  const Q = "{ financialsDailySnapshots(first: 1, orderBy: timestamp, orderDirection: desc) { dailyVolumeUSD totalValueLockedUSD } }";

  const ranked = [];
  for (const name of targets) {
    const s = await tools["graph.search_subgraphs_by_keyword"]({ keyword: name.toLowerCase() });
    const hit = (s.subgraphs ?? []).find(c => c.metadata && c.metadata.displayName === name);
    if (!hit) { ranked.push({ name, error: "not_found" }); continue; }
    const r = await tools["graph.execute_query_by_subgraph_id"]({ subgraph_id: hit.id, query: Q });
    if (!r || r.ok === false || r.errors) { ranked.push({ name, error: "unhealthy" }); continue; }
    const snap = r.data && r.data.financialsDailySnapshots && r.data.financialsDailySnapshots[0];
    if (!snap) { ranked.push({ name, error: "no_snapshot" }); continue; }
    ranked.push({ name, dailyVolumeUSD: Number(snap.dailyVolumeUSD) });
  }

  const healthy = ranked.filter(r => r.dailyVolumeUSD > 0);
  healthy.sort((a, b) => b.dailyVolumeUSD - a.dailyVolumeUSD);
  if (healthy.length === 0) return { error: "no_healthy_subgraphs", ranked };

  const winner = healthy[0];
  // Token identity is DERIVED from live Graph data — this is the cross-system join.
  const symbol = winner.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
  const supply = String(Math.floor(winner.dailyVolumeUSD));

  const token = await tools["hts.createToken"]({
    name: "Snapshot " + winner.name,
    symbol: symbol,
    decimals: 0,
    initialSupply: supply,
  });

  return {
    winner: winner.name,
    dailyVolumeUSD: winner.dailyVolumeUSD,
    rankedCount: healthy.length,
    ranked: healthy.map(r => r.name + ":" + Math.floor(r.dailyVolumeUSD)),
    tokenId: token.tokenId,
    hashscanUrl: token.hashscanUrl,
  };
`;

await ensureGraphTools();

const started = Date.now();
const planned = await execute(program);
console.log("RESULT plan:", JSON.stringify(planned, null, 2));
console.log(`RESULT planning wall: ${((Date.now() - started) / 1000).toFixed(1)}s`);

if (BROADCAST && planned.status === "awaiting_approval") {
  const outcome = await resume(planned.approval!.executionId, true);
  console.log("RESULT outcome:", JSON.stringify(outcome, null, 2));
}

await closeGraphUpstream();
// The Hiero SDK keeps gRPC channels open; without this the process never exits.
process.exit(0);
