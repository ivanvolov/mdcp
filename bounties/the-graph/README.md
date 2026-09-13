# The Graph — $15,000

What we built for this bounty, which tracks it qualifies for, and where the
evidence lives. Working docs: `TODO.md` (what is left), `SUBMISSION.md` (form
answers), `DEMO.md` (video beats).

## The one-sentence version

We connected mdcp to **The Graph's own `subgraph-mcp` server, unmodified**, as
an MCP client and re-exposed its 9 tools inside a code sandbox — then
benchmarked the identical server against itself, the conventional way vs.
code mode, on live gateway data.

Nothing of The Graph's is forked, reimplemented, or replaced. The only variable
in the experiment is the shape of the interaction, which is exactly what makes
the result readable.

## Tracks

Three $5,000 tracks (1st $2,500 / 2nd $1,500 / 3rd $1,000 each).

**1. Best Use of Composable or Standardized Graph Products — eligible.**
We build on a standardized schema (Messari Standardized Subgraphs) and run one
query pattern across **4 protocols × 6 chains**, and we compose two Graph
products (Subgraph MCP + Subgraphs via the gateway). The scaling sweep measures
what the standard buys, which is what the track asks submissions to show.

**2. AI Tooling or AI Use Case — From Scratch — eligible, primary.**
mdcp is reusable infrastructure that makes The Graph easier to use from AI
environments, and the benchmark agents use Subgraphs as their live blockchain
data source. mdcp was begun during the event → Start Fresh pool.

**3. AI Tooling or AI Use Case — Continuity — NOT eligible.**
Reserved for projects that extend an existing open-source repo. mdcp is
net-new, and a project sits in one pool. (If we ever open the upstream PR in
`TODO.md`, it is a contribution we point at — not a pool change.)

**Featured Substreams challenge — out of scope.** We did not do prompt →
deployed Substreams pipeline. Not claimed anywhere.

## Qualification evidence

Requirements are quoted from `PRIZES.md` (verbatim sponsor text).

### Both AI-track and standards-track common requirements

**"Consume live data from a Graph provider … Mocked, local-only, or static
datasets do not qualify."**
Every query in every benchmark is served by `gateway.thegraph.com` against a
Subgraph Studio Gateway API key. There is no cache, no fixture, no recorded
response anywhere on the Graph path — `app/src/graphUpstream.ts` has no storage
layer at all. Block numbers in the logs advance across runs, which is the
cheapest way for a judge to verify this.

**"Submit a public repository and a short demo video (two to four minutes)."**
Repo: https://github.com/ivanvolov/mdcp (public). Video: see `TODO.md`.

### Track 2 (AI, From Scratch)

**"Use The Graph as a load-bearing part of the project."**
Both ways the track allows. The tooling targets The Graph's AI Suite directly —
mdcp mounts `graphops/subgraph-mcp` — and the agents' only source of chain data
is Subgraphs. Delete the Graph integration and the entire scenario disappears;
there is no fallback path.

**"Do meaningful work with the data: reasoning, decisions, automation … not
just printing a raw query result."**
The task ends in a decision (rank venues, recommend one for a WETH/USDC swap).
Both arms also caught two data traps unprompted: PancakeSwap BSC's snapshot
being ~41 days stale (so its #1 volume rank is an artifact, not a fact) and
Curve's top pool reporting cumulative volume on the order of 10^24. That is
reasoning about data quality, not printing rows.

**"Tooling submissions must be reusable infrastructure, not a single end-user
app."**
`graphUpstream.ts` is a *generic MCP-upstream adapter*: it discovers whatever
tools the upstream advertises at connect time and generates their sandbox
signatures from their JSON Schema. Nothing about it is Graph-specific beyond
the default endpoint — if The Graph ships a tenth tool it appears with no code
change. That is also why it generalizes past this bounty.

**"Open-source the code with a clear README or SKILL.md so judges can run it."**
`skills/mdcp-graph/SKILL.md` — setup (including the Studio-key-vs-deploy-key
trap that cost us a run), calling convention, capability list, the
cross-protocol pattern, and the data gotchas. MIT.

**"Select the pool that matches how you built."**
Start Fresh. All code authored during the event window; the only vendored
dependency is executor.sh's MIT QuickJS runtime, disclosed in `ARCHITECTURE.md`.

### Track 1 (Composable / Standardized)

**"Either compose two or more of The Graph's products, or build meaningfully on
a standardized schema."**
Both. We compose Subgraph MCP with Subgraphs served by the gateway, and every
benchmark query is written against the **Messari standardized EXCHANGE schema**
(`protocols`, `financialsDailySnapshots`, `liquidityPools`) — never a
protocol-specific schema.

**"Simply querying one Subgraph with no composition or standardization does not
qualify."**
The headline run sweeps **10 standardized subgraphs** — Uniswap V3 on Ethereum,
Arbitrum, Base, Polygon, Optimism and BSC; SushiSwap on Ethereum and Arbitrum;
Curve on Ethereum; PancakeSwap V3 on BSC — with one query pattern reused
verbatim on all of them.

**"Make the standards leverage clear: show what became easier because a shared
schema or composed product was used."**
This is the part we can *measure* rather than assert. Because the schema is
shared, the program never fetches a schema at all — and schema SDL was **70% of
the baseline's entire context payload** at N=3 (112,810 of 162,069 bytes). The
standard is what turns "explore each protocol" into "loop the same query," and
the sweep in `s6-graph-sweep/` plots exactly what that is worth as N grows.

## Results

Same unmodified official server on both sides, live gateway, Claude Sonnet
agents with empty context, run in parallel, equivalent answers.

| | N=3 targets | N=10 targets |
| --- | --- | --- |
| agent tokens | 73,240 → 63,169 (1.16x) | 95,481 → 71,004 (**1.34x**) |
| wall clock | 193s → 119s (1.6x) | 479s → 154s (**3.1x**) |
| tool invocations | 19 → 3 | 43 → 5 |
| transcript payload | 162,069 B → 10,329 B (15.7x) | 242,174 B → 9,670 B (**25.0x**) |

Every ratio grows with task size — mdcp's cost is near-flat for 3.3x the work
while the baseline's scales with N. A deterministic N=1…10 sweep (no model in
the loop) isolates the mechanical component and plots the curve.

Where the win comes from, in order of size: schemas never travel (70% of the
baseline's payload), filtering happens next to the data instead of in context,
dead ends (empty searches, unhealthy subgraphs) cost nothing, and N targets
cost 4N round-trips instead of 1.

## Artifact map

Code:
- `app/src/graphUpstream.ts` — the MCP-upstream adapter (the actual contribution)
- `app/src/tools.ts` — `registerTools()`, late registration for discovered tools
- `skills/mdcp-graph/SKILL.md` — the judges-can-run-it skill
- `app/bench/arm-graph-baseline.sh` / `arm-graph-mdcp.sh` — the two arms
- `app/bench/graph-sweep.ts` — deterministic scaling sweep

Evidence:
- `app/bench/logs/s5-graph/` — N=3 agent run: raw JSONL, both verbatim answers, RESULTS.md
- `app/bench/logs/s6-graph-sweep/` — sweep CSV/JSON + `chart.html` (slide-ready)
- `app/bench/logs/s7-graph-scale10/` — N=10 agent run, same structure as s5
- `BENCHMARK.md` §3 — the write-up
- `skills/README.md` — why The Graph's case is structurally different from Uniswap's

Upstream we depend on (both Apache-2.0, unmodified):
- `graphops/subgraph-mcp` — built from source, run over stdio
- Messari Standardized Subgraphs — the shared EXCHANGE schema
