# Scenario 5 — The Graph: official Subgraph MCP vs the same server behind execute()

Run: 2026-09-13, ~09:35–09:40 UTC. Model: Claude Sonnet, two parallel agents,
empty context, identical task prompt. Both arms talk to the **same unmodified
`graphops/subgraph-mcp` binary** (Apache-2.0, built from source at 44 commits,
v0.1.1) over stdio, which serves every query **live from the Graph gateway**
(`gateway.thegraph.com`, Gateway API key auth). Nothing mocked, nothing forked.

## Task (identical in both arms)

Venue comparison for WETH/USDC on Ethereum mainnet across Uniswap V3,
SushiSwap, Curve Finance, via their Messari standardized subgraphs: per
protocol the latest financials snapshot (dailyVolumeUSD, TVL), the most-traded
pool containing both WETH and USDC in the top 50 by cumulativeVolumeUSD, and a
final ranking + recommendation. Subgraph IDs must be discovered live, not
hardcoded.

## Arms

- **baseline** — the 9 subgraph-mcp tools, one shell invocation per tool call
  (the conventional MCP shape). `bench/arm-graph-baseline.sh`.
- **mdcp** — the same 9 tools exposed inside the sandbox as `tools["graph.*"]`;
  the agent writes programs for `execute`. `bench/arm-graph-mdcp.sh`.

## Agent-level results (from the runner)

- agent tokens:      baseline 73,240 → mdcp 63,169  (1.16x less)
- wall clock:        baseline 193s   → mdcp 119s    (1.62x faster)
- tool invocations:  baseline 19     → mdcp 3       (6.3x fewer)

Both arms produced substantively identical deliverables: same three subgraph
IDs, same pools (USDC/WETH 0.05% on Uniswap, USDC/WETH on Sushi, TricryptoUSDC
on Curve), same ranking (Uniswap ≫ Curve ≫ Sushi), same recommendation — and
both independently flagged the protocol-level TVL corruption (see below).

## Boundary-level results (from the JSONL logs in this directory)

- baseline: 19 boundary calls, **162,069 bytes (~40.5k tokens) of tool payload
  through the transcript**; nothing stays out of context.
- mdcp: 3 boundary calls, **10,329 bytes (~2.6k tokens) through the
  transcript**; 16 inner calls totalling 39,611 bytes ran inside the sandbox
  and never reached the model. **15.7x less tool payload in context.**

Where the baseline's bytes went:

- 3 schema fetches = 112,810 bytes (~28k tokens) — **70% of its transcript
  payload is GraphQL SDL** the model reads once and mostly never uses.
- 3 top-50 pool queries ≈ 13 KB each — raw lists the model must filter
  in-context for the WETH∩USDC condition.
- 3 wasted searches (39-byte empty results) — discovery friction paid at full
  round-trip price.

The mdcp arm fetched **no schemas at all** — its program queried the
standardized Messari schema directly, retried candidates on
`{ok:false}`/GraphQL errors inside the sandbox, and filtered the pool lists in
code, returning only the final aggregates.

Why agent-token ratio (1.16x) understates the transcript ratio (15.7x): agent
tokens include the fixed system/task prompt and the (identical) final
deliverable on both sides; the tool-payload delta is the only variable part,
and it is what compounds when a strategy grows or the transcript is re-read
each turn.

## Data-quality note (kept honest)

Messari protocol-level `financialsDailySnapshots.totalValueLockedUSD` is
corrupted by junk-token pricing on Uniswap ($136B) and Sushi ($1.07T).
Pool-level TVLs are sane. Both agents noticed and said so unprompted — the
task requires reasoning about the data, not printing it.

## Reproducing

```bash
cd app
# .env: GATEWAY_API_KEY (Subgraph Studio), SUBGRAPH_MCP_BIN (cargo build --release
# of github.com/graphops/subgraph-mcp)
bash bench/arm-graph-baseline.sh help                      # lists graph.* tools
bash bench/arm-graph-mdcp.sh execute '<program>'           # code-mode arm
# Agents: two parallel empty-context Claude Sonnet sessions, prompts as above;
# logs land in bench/logs/graph-{baseline,mdcp}.jsonl.
```
