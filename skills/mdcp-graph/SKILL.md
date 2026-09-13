---
name: mdcp-graph
description: Query The Graph from inside the mdcp sandbox. The official Subgraph MCP's tools, discovered at runtime and exposed as graph.* — write one program that searches, queries, and aggregates across many subgraphs, and return only the answer. Use for any on-chain data question (protocol stats, pools, cross-protocol or cross-chain comparisons).
license: MIT
metadata:
  author: mdcp
  version: '0.1.0'
---

# mdcp Graph

The Graph's data plane inside the code-mode sandbox. mdcp connects to the
**unmodified official `subgraph-mcp` server** (graphops, Apache-2.0) as an MCP
client, discovers its 9 tools at runtime, and exposes them to your program as
`tools["graph.*"]`. Every query is served live by the Graph gateway — there is
no cached or mocked data anywhere on this path.

## Setup (2 minutes)

1. Get a **Gateway API key**: [thegraph.com/studio](https://thegraph.com/studio)
   → API Keys tab → Create. (This is not the per-subgraph deploy key.)
2. In `app/.env`:

   ```
   GATEWAY_API_KEY=<your key>
   # optional, faster: a locally built binary instead of the hosted bridge
   # git clone https://github.com/graphops/subgraph-mcp && cargo build --release
   SUBGRAPH_MCP_BIN=/path/to/subgraph-mcp/target/release/subgraph-mcp
   ```

   Without `SUBGRAPH_MCP_BIN`, mdcp bridges to the hosted service at
   `subgraphs.mcp.thegraph.com` via `npx mcp-remote` — zero install, slower start.
3. Run anything with `GRAPH_UPSTREAM=1` (the bench scripts set it for you):

   ```bash
   cd app
   bash bench/arm-graph-mdcp.sh execute @bench/programs/dex-scan.ts   # code mode
   bash bench/arm-graph-baseline.sh help              # or call the 9 tools one by one
   ```

   `execute` takes a program inline, as `{"code":"..."}`, or as `@path/to/file.ts`.
   Prefer the file form for anything multi-line — shell quoting a TypeScript
   program is its own failure mode.

## Mounting it in an AI client

The above is the benchmark harness. To actually *use* this from Claude Code,
Claude Desktop, or Cursor, mount mdcp as an MCP server — three tools total
(`execute` / `resume` / `skills`), with all 9 Graph capabilities reachable from
inside `execute`:

```json
{
  "mcpServers": {
    "mdcp": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/app/src/mcp-mdcp.ts"],
      "env": {
        "GRAPH_UPSTREAM": "1",
        "GATEWAY_API_KEY": "<your Studio key>",
        "SUBGRAPH_MCP_BIN": "<optional: path to the built binary>"
      }
    }
  }
}
```

Claude Code one-liner equivalent:

```bash
claude mcp add mdcp -e GRAPH_UPSTREAM=1 -e GATEWAY_API_KEY=<key> \
  -- npx tsx /absolute/path/to/app/src/mcp-mdcp.ts
```

Then ask in natural language — *"compare WETH/USDC liquidity across Uniswap,
Sushi and Curve"* — and the model writes one program instead of a dozen tool
calls. `skills({topic:"graph"})` serves the query patterns and the data-quality
rules on demand, so none of that sits in the always-loaded tool description.

## Runnable examples

Two programs in `app/bench/programs/`, both live against the gateway:

- **`dex-scan.ts`** — the benchmarked task: 10 standardized subgraphs, 4
  protocols across 6 chains, one query pattern, stale snapshots excluded from
  the ranking and reported separately.
- **`defi-scan.ts`** — the same pattern spanning protocol *categories*: DEX and
  lending answered by one query, because Messari's base entities are shared
  across types. Spans 5 schema versions (EXCHANGE 1.3.0/1.3.2/4.0.0/4.0.1 and
  LENDING 3.1.0) in a single run.

```bash
bash bench/arm-graph-mdcp.sh execute @bench/programs/defi-scan.ts
```

## Calling convention

Same as every mdcp capability — one program, `await` freely, `return` only what
you need. Intermediate payloads (search results, schemas, 50-row pool lists)
stay in the sandbox and never enter the model's context.

```ts
const s = await tools["graph.search_subgraphs_by_keyword"]({ keyword: "uniswap v3 ethereum" });
const id = s.subgraphs.find(c => c.metadata?.displayName === "Uniswap V3 Ethereum").id;
const r = await tools["graph.execute_query_by_subgraph_id"]({
  subgraph_id: id,
  query: "{ financialsDailySnapshots(first: 1, orderBy: timestamp, orderDirection: desc) { dailyVolumeUSD totalValueLockedUSD } }",
});
return r.data.financialsDailySnapshots[0];
```

## Capabilities

```
graph.search_subgraphs_by_keyword({ keyword })                       // discovery, ~10 results by signal
graph.get_schema_by_subgraph_id({ subgraph_id })                     // GraphQL SDL, current version
graph.get_schema_by_deployment_id({ deployment_id })                 // SDL by 0x… deployment
graph.get_schema_by_ipfs_hash({ ipfs_hash })                         // SDL by Qm… hash
graph.execute_query_by_subgraph_id({ subgraph_id, query, variables? })
graph.execute_query_by_deployment_id({ deployment_id, query, variables? })
graph.execute_query_by_ipfs_hash({ ipfs_hash, query, variables? })
graph.get_top_subgraph_deployments({ chain, contract_address })      // use chain "mainnet", never "ethereum"
graph.get_deployment_30day_query_counts({ ipfs_hashes })
```

All reads (`view`) — auto-allowed by the policy gate, no approval round-trip.
The list is discovered from the upstream at connect time, so if The Graph ships
a tenth tool, it appears here without an mdcp change.

## The pattern that pays: standardized schemas × in-sandbox loops

Messari Standardized Subgraphs give every protocol of a type one shared schema,
so a single query pattern works across protocols **and** chains. Loop it in the
sandbox and only the aggregate crosses to the model:

```ts
const targets = ["Uniswap V3 Ethereum", "Uniswap V3 Arbitrum", "Uniswap V3 Base",
                 "Sushiswap Ethereum", "Curve Finance Ethereum"];
const Q = `{ protocols(first: 1) { name }
             financialsDailySnapshots(first: 1, orderBy: timestamp, orderDirection: desc) { dailyVolumeUSD } }`;
const out = [];
for (const name of targets) {
  const s = await tools["graph.search_subgraphs_by_keyword"]({ keyword: name.toLowerCase() });
  const hit = (s.subgraphs ?? []).find(c => c.metadata?.displayName === name);
  if (!hit) { out.push({ name, error: "not_found" }); continue; }
  const r = await tools["graph.execute_query_by_subgraph_id"]({ subgraph_id: hit.id, query: Q });
  if (r?.ok === false || r?.errors) { out.push({ name, error: "unhealthy" }); continue; }
  out.push({ name, dailyVolumeUSD: r.data.financialsDailySnapshots[0]?.dailyVolumeUSD });
}
out.sort((a, b) => Number(b.dailyVolumeUSD ?? 0) - Number(a.dailyVolumeUSD ?? 0));
return out;
```

Notes that save you a retry:

- **Errors are data.** A failed call returns `{ ok: false, error }` (transport/
  MCP level) or a GraphQL `{ errors: [...] }` body — branch and continue.
  Subgraphs that search finds can still be dead on the network ("no
  allocations", "indexing_error"); probe and fall through to the next candidate.
- **You rarely need schemas.** Standardized subgraphs share the documented
  Messari schema; skip `get_schema_*` unless exploring an unfamiliar subgraph —
  a schema is 30–50 KB you don't want to pull at all if you can help it.
- **Distrust protocol-level `totalValueLockedUSD`.** Junk-token pricing inflates
  it on some deployments; pool-level TVL and volumes are the reliable fields.

## Why this beats calling the same tools directly

Measured, not asserted — same unmodified server, live gateway, Claude Sonnet
agents with empty context (`app/bench/logs/s5-graph/`), plus a deterministic
N=1..10 scaling sweep (`app/bench/logs/s6-graph-sweep/`): at 3 targets the
per-tool arm pushed 162 KB of tool payload through the transcript against
mdcp's 10 KB; at 10 targets the modeled cumulative-context gap is three orders
of magnitude. Full write-up: `BENCHMARK.md` §3.
