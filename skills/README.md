# Skills: official vs mdcp port

`uniswap-official/` is the Uniswap AI skill suite, copied verbatim from
github.com/Uniswap/uniswap-ai @ 5338d6e (2026-09-08, MIT — LICENSE included) so
the two versions can be read side by side.

`mdcp-port/` is the same DCA strategy skill with ONE change: the execution layer.
The strategy prompt is deliberately untouched — 12 lines of 126 differ, all of
them the delegation target (swap-integration + viem-integration -> mdcp-execute).
Compare them directly:

    diff uniswap-official/dca-bot/SKILL.md mdcp-port/dca-bot/SKILL.md

What the execution layer costs in instructions:

- official: swap-integration (62,499) + viem-integration (7,618) = 70,117 bytes
- mdcp:     mdcp-execute = 4,219 bytes   (16.6x smaller)

Those are the SKILL.md files themselves — the instructions an agent loads
before it can execute anything. Both official skills also link reference files
that are read on demand rather than preloaded (`swap-integration/references/`
11,103 bytes, `viem-integration/references/` 68,000 bytes); they are vendored
here for completeness and are deliberately **not** counted in the 70,117,
because counting them would overstate the always-loaded cost.

The strategy skill itself is the same size in both. The saving is entirely in
what an agent must carry to *execute*, not in the strategy prompt — which is the
point: mdcp replaces the execution layer, not the skill.

## Reading these as a judge

`mdcp-port/` skills are **frozen benchmark artifacts**: their byte sizes are
cited in the results, so they are not edited for convenience after a run. That
is why mounting instructions are not inside them — those live in
[RUN.md §4](../RUN.md), together with the credential matrix and the per-track
walkthroughs.

`references/` holds the three shared reference files both suites link to as
`../../references/*.md`. Uniswap's layout resolves that path; this repo's does
not, so the files sit at the depth the links expect. Both arms resolve them the
same way.

## Hedera — the mirror-node MCP server, and one catalog skill

Hedera's MCP surface is
[mirrornode-mcp-server](https://github.com/hedera-dev/mirrornode-mcp-server):
it auto-generates **43 MCP tools**, one per mirror-node GET endpoint. That is
per-tool MCP — one round-trip per call, every raw response through the model's
context — which is exactly the shape a code-mode gateway removes.

mdcp wraps it unmodified (`app/src/hederaUpstream.ts`, a sibling of
`graphUpstream.ts`) and re-exposes its tools inside the sandbox as `mirror.*`.
Measured on an operator portfolio + audit review across six endpoints
(BENCHMARK.md §4, deterministic, zero HBAR):

- payload into model context: **47,766 -> 434 bytes (110x)**, 6 round-trips -> 1
- catalog surface: **36,968 -> 7,932 bytes (4.7x)**

The gateway moves the filtering to where the data already is; only the answer
crosses back.

### Writes: one catalog skill for both native services

`mdcp-port/hedera-catalog/` covers HTS **and** HCS in a single self-contained
file — 11 capabilities (`hts.*` + `hcs.*`), calling convention and approval
flow included, no prerequisite skill to read separately, ~6.5KB.

All Hedera write runs are level 3 (live testnet — these are native services,
there is no fork to run them on). `app/bench/arm-hedera.sh` is the arm (gated
by `HEDERA_TOOLS=1`, so the Uniswap and Graph catalogs are untouched);
`app/bench/programs/audit-trail.ts` is the two-service pipeline — create a
topic, create and mint a token, write an audit event per step, read the trail
back — run with `bash bench/arm-hedera.sh execute @bench/programs/audit-trail.ts`.

## The Graph

Third surface, different shape: The Graph's official AI artifact is not a text
skill but a live MCP server (`graphops/subgraph-mcp`, Apache-2.0). So there is
nothing to copy verbatim and nothing to port — **mdcp wraps the unmodified
server itself** (`app/src/graphUpstream.ts` connects as an MCP client and
re-exposes its 9 tools inside the sandbox as `graph.*`).

`mdcp-graph/` is the skill judges can run: setup (a Subgraph Studio key), the
calling convention, and the cross-protocol Messari-standardized-schema pattern
the benchmark measures. Both benchmark arms use the same official server on
live gateway data — the only variable is interaction shape. Results:
`BENCHMARK.md` §3, raw logs `app/bench/logs/s5-graph/` and `s6-graph-sweep/`.
