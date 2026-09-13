# Scenario 7 — The Graph at N=10: does the gap actually grow?

Run: 2026-09-13, ~10:00 UTC. Same controls as scenario 5 (Claude Sonnet, two
parallel agents, empty context, identical task prompts, the same unmodified
`graphops/subgraph-mcp` binary serving live gateway data) — only the task size
changed: **10 Messari standardized subgraphs instead of 3**, spanning 4
protocols × 6 chains.

The point of this run is that scenario 5 measured a single point (N=3), and the
whole claim of code mode is that the advantage *scales*. This is the second
point on the curve, with real agents rather than the deterministic sweep in
`../s6-graph-sweep/`.

## Task

For each of 10 named targets: discover the subgraph ID live, read the latest
`financialsDailySnapshots.dailyVolumeUSD`, and get the top pool by
`cumulativeVolumeUSD`; then rank all 10 and comment on anomalies.

## Results

|                    | N=3 (scenario 5) | N=10 (this run) |
|--------------------|------------------|-----------------|
| agent tokens       | 73,240 → 63,169 (1.16x) | 95,481 → 71,004 (**1.34x**) |
| wall clock         | 193s → 119s (1.6x)      | 479s → 154s (**3.1x**) |
| agent tool invocations | 19 → 3              | 43 → 5 |
| transcript payload | 162,069 B → 10,329 B (15.7x) | 242,174 B → 9,670 B (**25.0x**) |

Every ratio grew with task size — which is the claim. The mdcp arm's cost is
close to flat between the two runs (63.2k → 71.0k tokens for 3.3x the work,
and its transcript payload actually *shrank* slightly, 10,329 → 9,670 bytes,
because this task needed no schema fetches); the baseline's grows with N.

Inside the sandbox the mdcp program made **39 upstream calls** (21 searches, 18
queries) totalling 29,218 bytes that never entered the model's context. The
baseline agent made 42 boundary calls carrying 242,174 bytes.

## Answer quality: equivalent, both arms

Identical rankings, identical dailyVolumeUSD to the dollar on same-snapshot
targets (tiny differences on Sushi/Curve are minutes-apart live snapshots, not
disagreement). Both arms independently flagged **both** data anomalies: the
PancakeSwap BSC snapshot being ~41 days stale (so its #1 rank is an artifact),
and Curve's `reUSD/sfrxUSD` pool reporting cumulative volume on the order of
10^24. The baseline additionally noted the `quq/USDT` pool on Uniswap BSC as
likely wash-traded; the mdcp arm noted PancakeSwap's staleness in the same
breath — neither missed anything material.

One methodological wrinkle worth recording: the baseline agent could not find
healthy registry subgraph IDs for Base and Polygon via keyword search, so it
fell back to `get_top_subgraph_deployments` + `execute_query_by_ipfs_hash` for
those two (5 extra tool calls). The mdcp program found both by subgraph ID on
the first pass. Same data reached in both arms, different paths — worth noting
because it means the baseline's 43 calls are not purely mechanical overhead;
some of them are re-planning the model had to do in-context.

## Files

- `baseline.jsonl` / `mdcp.jsonl` — raw per-call instrumentation
- `baseline-answer.md` / `mdcp-answer.md` — each agent's verbatim deliverable
- `../s6-graph-sweep/` — deterministic N=1..10 sweep and the charts
