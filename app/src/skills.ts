/** Lazily served docs. Everything verbose lives here, never in tool descriptions. */
export const SKILLS: Record<string, string> = {
  execute: `
# mdcp execute() calling convention

Write TypeScript. A global \`tools\` proxy gives progressive access to on-chain tools:

1. const hits = await tools.search({ query: "swap on uniswap", limit: 8 })
   → { items: [{ path, summary }], total }
2. const t = await tools.describe({ path: "uniswap.default.sepolia.quote" })
   → { inputTS, outputTS }   // compact TypeScript types derived from ABIs
3. const res = await tools.uniswap.default.sepolia.quote({ tokenIn, tokenOut, amountIn })
   → { ok: true, data } | { ok: false, error: { code, message, retryable } }
   Errors are DATA — branch and retry in code, do not throw.

Rules:
- Filter large collections (pools, routes) in code; return only what the user needs.
- emit(value) streams progress; return carries the final structured result.
- State-changing calls pause execution for wallet approval. You will receive
  { paused: true, executionId, approvalUrl }. Tell the user; they approve; the
  runtime resumes your code where it stopped — with re-quoted, re-simulated state.
- Never construct raw transactions; use tools.* which simulate before submitting.
- Submitted transactions are checkpoints: re-running your code cannot re-submit them.
`,
  policies: `
Side-effect policy is derived from the ABI:
- view/pure           → auto-allowed
- nonpayable/payable  → require_approval (pause/resume)
- unlimited approve, delegatecall → blocked by default
`,
  signing: `
Keys never enter the sandbox. On approval, the host signer (local keystore
or local keystore) signs. The sandbox only ever sees addresses and tx hashes.
Resume re-validates: quotes are re-fetched and re-simulated against the slippage
bound recorded at pause time; if drift exceeds the bound, the call returns
{ ok:false, error:{ code:"stale_quote", retryable:true } } instead of executing.
`,
  graph: `
# Querying The Graph from inside execute()

The \`graph.*\` capabilities are The Graph's official subgraph-mcp server
(graphops, Apache-2.0), mounted unmodified and discovered at runtime. Every
query is served live by gateway.thegraph.com — there is no cache.

## The pattern that pays

Messari **standardized subgraphs** share one schema across every protocol of a
type, and the base entities (\`protocols\`, \`financialsDailySnapshots\`) are the
same even ACROSS types — an EXCHANGE and a LENDING subgraph answer the same
query. So write the query once and loop it; the loop, the retries and the
discarded rows stay in the sandbox.

  const q = \`{ protocols(first:1){ name schemaVersion type }
               financialsDailySnapshots(first:1, orderBy: timestamp, orderDirection: desc){ totalValueLockedUSD } }\`;
  for (const name of targets) {
    const found = await tools["graph.search_subgraphs_by_keyword"]({ keyword: name.toLowerCase() });
    const hit = (found.subgraphs ?? []).find(c => c.metadata?.displayName === name);
    if (!hit) continue;
    const r = await tools["graph.execute_query_by_subgraph_id"]({ subgraph_id: hit.id, query: q });
    if (r?.ok === false || r?.errors) continue;   // dead subgraph, keep going
    ...
  }

Worked examples: bench/programs/dex-scan.ts (10 DEXes, 6 chains) and
bench/programs/defi-scan.ts (DEX + lending in one pattern).

## Rules that save a retry

- **Skip the schema.** get_schema_* returns 30-50KB of SDL. On a standardized
  subgraph you already know the shape; fetching it is pure context cost. It was
  70% of the conventional arm's payload in our benchmark.
- **Errors are values.** A failed call returns { ok:false, error } or a GraphQL
  { errors:[...] } body. Subgraphs die on the decentralized network routinely
  ("no allocations", "indexing_error") and health changes hour to hour — always
  branch and continue to the next candidate.
- **Check snapshot freshness.** A stale snapshot returns a confident-looking
  number, not an error. Compare financialsDailySnapshots.timestamp against now
  before ranking on it; we have seen a 41-day-stale snapshot take first place.
- **Distrust protocol-level totalValueLockedUSD.** Junk-token pricing inflates
  it past a trillion on some deployments. Pool/market-level values are sane.
- **chain is "mainnet", never "ethereum"** in get_top_subgraph_deployments.
`,
};
