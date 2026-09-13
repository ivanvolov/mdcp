/**
 * Cross-CATEGORY DeFi scan on The Graph — the standardization argument at full
 * strength.
 *
 * Messari's standardized subgraphs don't just share a schema within a protocol
 * type; every type is built on the same base entities — `protocols` and
 * `financialsDailySnapshots` are identical whether the protocol is an exchange
 * or a lending market. So SHARED below is written once and runs, unmodified,
 * against DEXes and lending markets on six chains. Only the tiny category-
 * specific fragment differs, and even that is the same shape.
 *
 * Without the standard this is nine schema explorations and nine bespoke
 * queries. With it, it is one pattern in a loop — and because the loop lives in
 * the sandbox, none of the intermediate data reaches the model.
 *
 * Run:  bash bench/arm-graph-mdcp.sh execute @bench/programs/defi-scan.ts
 */

const TARGETS = [
  { name: "Uniswap V3 Ethereum", kind: "dex" },
  { name: "Uniswap V3 Arbitrum", kind: "dex" },
  { name: "Uniswap V3 Base", kind: "dex" },
  { name: "Sushiswap Ethereum", kind: "dex" },
  { name: "Curve Finance Ethereum", kind: "dex" },
  { name: "Pancakeswap V3 BSC", kind: "dex" },
  { name: "Aave V3 Ethereum", kind: "lending" },
  { name: "Compound V3 Ethereum", kind: "lending" },
  { name: "Aave V2 Ethereum", kind: "lending" },
];

// Identical for every protocol, of every type, on every chain.
const SHARED = `protocols(first: 1) { name schemaVersion type }
  financialsDailySnapshots(first: 1, orderBy: timestamp, orderDirection: desc) {
    timestamp totalValueLockedUSD
  }`;

// The only per-category difference: which one extra number is meaningful.
const EXTRA = {
  dex: `liquidityPools(first: 1, orderBy: cumulativeVolumeUSD, orderDirection: desc) { name cumulativeVolumeUSD }`,
  lending: `markets(first: 1, orderBy: totalValueLockedUSD, orderDirection: desc) { name totalValueLockedUSD }`,
};

const rows = [];
for (const t of TARGETS) {
  const found = await tools["graph.search_subgraphs_by_keyword"]({
    keyword: t.name.toLowerCase(),
  });
  const hit = (found.subgraphs ?? []).find(
    (c) => c.metadata?.displayName === t.name,
  );
  if (!hit) {
    rows.push({ target: t.name, status: "not_found" });
    continue;
  }

  const r = await tools["graph.execute_query_by_subgraph_id"]({
    subgraph_id: hit.id,
    query: `{ ${SHARED} ${EXTRA[t.kind]} }`,
  });

  // Errors are values here, so one dead subgraph does not end the sweep.
  if (r?.ok === false || r?.errors) {
    rows.push({ target: t.name, status: "unhealthy" });
    continue;
  }

  const proto = r.data.protocols?.[0] ?? {};
  const snap = r.data.financialsDailySnapshots?.[0] ?? {};
  const top = (r.data.liquidityPools ?? r.data.markets ?? [])[0] ?? {};

  rows.push({
    target: t.name,
    kind: t.kind,
    subgraphId: hit.id,
    protocol: proto.name,
    schemaVersion: proto.schemaVersion,
    type: proto.type,
    tvlUSD: Math.round(Number(snap.totalValueLockedUSD ?? 0)),
    snapshotAgeHours:
      snap.timestamp != null
        ? Math.round(((Date.now() / 1000 - Number(snap.timestamp)) / 3600) * 10) / 10
        : null,
    top: top.name,
  });
}

const ok = rows.filter((r) => r.tvlUSD != null);

/**
 * Data quality is decided here, in code, before anything is ranked.
 *
 * Two failure modes are live in this exact dataset right now, and both return
 * confident-looking numbers rather than errors:
 *   - a snapshot that stopped updating (PancakeSwap BSC is ~41 days stale)
 *   - junk-token pricing inflating protocol TVL past any real figure
 * Ranking on either is how an agent reaches a wrong conclusion from data that
 * technically parsed. Doing this filtering in the sandbox means the model is
 * handed a clean ranking plus a named list of what was excluded, instead of
 * nine raw rows it has to audit itself.
 */
const TRILLION = 1e12;
const quarantine = (r) =>
  (r.snapshotAgeHours ?? 0) > 48
    ? `stale (${r.snapshotAgeHours}h)`
    : r.tvlUSD > TRILLION
      ? `implausible TVL ($${(r.tvlUSD / 1e12).toFixed(1)}T)`
      : null;

const excluded = ok.filter((r) => quarantine(r));
const clean = ok.filter((r) => !quarantine(r));
const sum = (rs) => rs.reduce((s, r) => s + r.tvlUSD, 0);

return {
  // The claim, in one field: one query pattern, N schema versions, 2 categories.
  pattern: {
    schemaVersionsSpanned: [...new Set(ok.map((r) => `${r.type}:${r.schemaVersion}`))],
    categories: { dex: clean.filter((r) => r.kind === "dex").length,
                  lending: clean.filter((r) => r.kind === "lending").length },
  },
  tvlByCategory: {
    dex: sum(clean.filter((r) => r.kind === "dex")),
    lending: sum(clean.filter((r) => r.kind === "lending")),
  },
  ranked: clean
    .sort((a, b) => b.tvlUSD - a.tvlUSD)
    .map((r) => ({ target: r.target, type: r.type, tvlUSD: r.tvlUSD, top: r.top })),
  excluded: excluded.map((r) => ({ target: r.target, reason: quarantine(r) })),
  skipped: rows.filter((r) => r.status).map((r) => `${r.target}: ${r.status}`),
};
