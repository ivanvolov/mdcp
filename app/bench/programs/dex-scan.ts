/**
 * The benchmarked task, as a runnable file.
 *
 * This is the N=10 sweep from BENCHMARK.md §3 (scenario 7): ten Messari
 * standardized subgraphs — 4 protocols across 6 chains — through one query
 * pattern, with discovery, health fallback and filtering all happening in the
 * sandbox. The agent benchmark asked a model to write this; running the file
 * directly reproduces the same upstream work without spending model tokens.
 *
 * Run:  bash bench/arm-graph-mdcp.sh execute @bench/programs/dex-scan.ts
 */

const TARGETS = [
  "Uniswap V3 Ethereum",
  "Sushiswap Ethereum",
  "Curve Finance Ethereum",
  "Uniswap V3 Arbitrum",
  "Uniswap V3 Base",
  "Uniswap V3 Polygon",
  "Uniswap V3 Optimism",
  "Uniswap V3 BSC",
  "Sushiswap Arbitrum",
  "Pancakeswap V3 BSC",
];

// One pattern, written once, run against all ten. This is what the shared
// Messari EXCHANGE schema buys: no per-protocol schema exploration.
const QUERY = `{
  protocols(first: 1) { name schemaVersion }
  financialsDailySnapshots(first: 1, orderBy: timestamp, orderDirection: desc) {
    timestamp dailyVolumeUSD
  }
  liquidityPools(first: 1, orderBy: cumulativeVolumeUSD, orderDirection: desc) {
    name cumulativeVolumeUSD
  }
}`;

const rows = [];
for (const name of TARGETS) {
  const found = await tools["graph.search_subgraphs_by_keyword"]({
    keyword: name.toLowerCase(),
  });
  const hit = (found.subgraphs ?? []).find((c) => c.metadata?.displayName === name);
  if (!hit) {
    rows.push({ target: name, status: "not_found" });
    continue;
  }

  const r = await tools["graph.execute_query_by_subgraph_id"]({
    subgraph_id: hit.id,
    query: QUERY,
  });
  if (r?.ok === false || r?.errors) {
    rows.push({ target: name, status: "unhealthy" });
    continue;
  }

  const snap = r.data.financialsDailySnapshots?.[0] ?? {};
  const pool = r.data.liquidityPools?.[0] ?? {};
  rows.push({
    target: name,
    subgraphId: hit.id,
    protocol: r.data.protocols?.[0]?.name,
    dailyVolumeUSD: Math.round(Number(snap.dailyVolumeUSD ?? 0)),
    // A stale snapshot still reports a confident number; rank on it and the
    // conclusion is wrong even though every value parsed.
    snapshotAgeHours:
      snap.timestamp != null
        ? Math.round((Date.now() / 1000 - Number(snap.timestamp)) / 360) / 10
        : null,
    topPool: pool.name,
  });
}

const ok = rows.filter((r) => r.dailyVolumeUSD != null);
const fresh = ok.filter((r) => (r.snapshotAgeHours ?? 0) <= 48);

return {
  rankedByDailyVolume: fresh
    .sort((a, b) => b.dailyVolumeUSD - a.dailyVolumeUSD)
    .map((r) => ({ target: r.target, dailyVolumeUSD: r.dailyVolumeUSD, topPool: r.topPool })),
  excludedAsStale: ok
    .filter((r) => (r.snapshotAgeHours ?? 0) > 48)
    .map((r) => ({ target: r.target, ageHours: r.snapshotAgeHours, dailyVolumeUSD: r.dailyVolumeUSD })),
  skipped: rows.filter((r) => r.status).map((r) => `${r.target}: ${r.status}`),
};
