# Submission form — The Graph

The bounty-specific answer, canonical here. Read it in your own voice before
submitting; I wrote it, you are the one signing it.

The general project fields (name / tagline / description / how it's made) are
**not** in this file — they live in [`../SUBMIT.md`](../SUBMIT.md) §2, in the
version extended to cover all three partner picks. They were drafted here
first and have since diverged, so a copy kept here would only be the stale one
nearest to hand at the worst moment.

---

## How did you use The Graph? (the bounty answer)

We mounted **The Graph's own `subgraph-mcp` server (graphops, Apache-2.0),
completely unmodified**, inside mdcp's sandbox. mdcp connects to it as an MCP
client, discovers its 9 tools at runtime, and exposes them to sandboxed
programs as `graph.*`. Nothing of The Graph's was forked, reimplemented, or
replaced — which is what let us run a clean experiment: **the same server, the
same live gateway data, the same task, in both interaction shapes.** The only
variable is whether the agent calls the 9 tools one at a time or writes one
program that calls them from inside the sandbox.

The task is a cross-protocol DEX venue comparison built on **Messari
Standardized Subgraphs** — one query pattern, written once against the shared
EXCHANGE schema, reused verbatim across **4 protocols on 6 chains** (Uniswap V3
on Ethereum, Arbitrum, Base, Polygon, Optimism and BSC; SushiSwap on Ethereum
and Arbitrum; Curve on Ethereum; PancakeSwap V3 on BSC). All data is live from
`gateway.thegraph.com` with a Subgraph Studio key — there is no cache, fixture,
or recorded response anywhere on this path.

Results, with both agents producing equivalent answers:

- At 3 targets: 19 → 3 tool invocations, 1.16x fewer agent tokens, 1.6x faster,
  and 15.7x less tool payload through the transcript (162 KB → 10 KB).
- At 10 targets: 43 → 5 agent tool invocations, 1.34x fewer tokens, 3.1x faster, 25.0x
  less payload (242 KB → 9.7 KB).

Every ratio grows with task size: mdcp's cost stays near-flat for 3.3x the work
while the conventional shape scales with N. The standardized schema is the
single biggest reason — because the schema is shared and known, the program
never fetches one, and **schema SDL was 69% of the baseline's entire context
payload**. A deterministic N=1…10 sweep (no model in the loop, both arms doing
identical upstream work) plots the curve.

Both agents also independently caught two data-quality traps — PancakeSwap
BSC's snapshot being ~41 days stale, so its top volume rank is an artifact
rather than a fact, and Curve's top pool reporting cumulative volume on the
order of 10^24 — which is the kind of reasoning-about-data the track asks for,
rather than printing query results. We then moved that judgment into code:
`bench/programs/defi-scan.ts` quarantines stale and implausible values before
ranking, so the model receives a clean ranking plus a named list of what was
excluded and why, instead of raw rows it has to audit itself.

Because Messari's base entities are shared **across protocol types** and not
just within one, that same program runs a single query pattern over DEXes *and*
lending markets — Uniswap V3, SushiSwap, Curve, PancakeSwap, Aave v2, Aave v3,
Compound III — spanning five schema versions (EXCHANGE 1.3.0/1.3.2/4.0.0/4.0.1
and LENDING 3.1.0) across six chains in one run, and ranks them together on a
TVL field that means the same thing in every one of them.

mdcp also mounts as a normal MCP server in Claude Code, Claude Desktop or
Cursor (config in the skill), so all nine Graph capabilities are reachable from
natural language through a three-tool surface, with the query patterns and
data-quality rules served on demand via `skills({topic:"graph"})` rather than
occupying the always-loaded description.

Everything is reproducible: `skills/mdcp-graph/SKILL.md` is the setup and
calling convention (a Studio API key and either a locally built binary or the
hosted SSE bridge — both paths verified), and `app/bench/logs/s5-graph/`,
`s6-graph-sweep/` and `s7-graph-scale10/` carry the raw JSONL, both agents'
verbatim deliverables, and the methodology with its caveats stated.

### If asked which track

- **AI Tooling / AI Use Case (From Scratch)** — the adapter is reusable
  infrastructure targeting The Graph's AI Suite, and the agents use Subgraphs
  as their live data source. mdcp is net-new, built during the event.
- **Composable or Standardized Graph Products** — one query pattern across 4
  protocols × 6 chains on the Messari standardized schema, composing Subgraph
  MCP with Subgraphs, with the standards leverage measured rather than asserted.

## Where a judge should read (if the form takes a pointer)

https://github.com/ivanvolov/mdcp — `skills/mdcp-graph/SKILL.md` to run it,
`BENCHMARK.md` §3 for the experiment, `app/bench/logs/s5-graph/` +
`s7-graph-scale10/` + `s8-graph-crosscategory/` for raw logs and both agents'
verbatim answers.
