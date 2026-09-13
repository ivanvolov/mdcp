# TODO — The Graph

Build items for this bounty only. Everything here is code or docs in the repo;
event logistics (track picks, video, form pasting) live in your head, not here.

## Built

- [x] **MCP-upstream adapter** — `app/src/graphUpstream.ts`. Connects to the
      official `graphops/subgraph-mcp` as an MCP client, discovers its 9 tools
      at runtime, generates compact TS signatures from their JSON Schema, and
      re-exposes them in the sandbox as `graph.*`. Generic: a tenth upstream
      tool appears with no code change.
- [x] **Errors as values** — upstream GraphQL and MCP protocol failures return
      `{ok:false, error}` into the program instead of throwing. Required, not
      cosmetic: subgraph health on the network changes hour to hour, and a
      throw kills the whole sweep.
- [x] **Benchmark, N=3 and N=10** — `s5-graph/`, `s7-graph-scale10/`. Same
      unmodified server both arms, live gateway, Sonnet agents, equivalent
      answers. Every ratio grows with N (1.16x → 1.34x tokens, 1.6x → 3.1x
      wall clock, 15.7x → 25.0x payload).
- [x] **Deterministic scaling sweep + charts** — `app/bench/graph-sweep.ts`,
      `s6-graph-sweep/` with `chart.html` rendered and verified in both themes.
- [x] **Cross-category demo** — `app/bench/programs/defi-scan.ts`, evidence in
      `s8-graph-crosscategory/`. One query pattern spanning DEX *and* lending,
      five schema versions, six chains, with stale and implausible values
      quarantined in code before ranking. This is the strongest form of the
      Track 1 standardization argument and it did not exist before today.
- [x] **Runnable programs** — `dex-scan.ts` reproduces the benchmarked task
      without spending model tokens; `defi-scan.ts` is the cross-category one.
      Both take `execute @path/to/file.ts`, so no shell-quoting a program.
- [x] **Mountable in a real AI client** — the bounty rewards making The Graph
      easier to use *from Claude/Cursor*, and nothing documented how to mount
      mdcp. `skills/mdcp-graph/SKILL.md` now carries the `mcpServers` JSON and
      the `claude mcp add` one-liner; verified the server serves all 9 Graph
      capabilities inside a 3,450-byte `execute` description.
- [x] **`skills({topic:"graph"})`** — query patterns and the four data-quality
      rules, served lazily (2,373 bytes) so they never sit in the always-loaded
      tool description. Registered in the topic enum and verified over MCP.
- [x] **No-Rust path verified** — with `SUBGRAPH_MCP_BIN` unset, mdcp bridges to
      the hosted SSE service via `npx mcp-remote` and live queries return real
      data. The SKILL.md quickstart is not a trap for a judge without cargo.
- [x] **Paperwork** — `README.md` (requirement → evidence map), `SUBMISSION.md`
      (form answers), `DEMO.md` (the 45-second beat).

## Worth building if time survives

- [ ] **Upstream issue on `graphops/subgraph-mcp`** proposing a code-mode
      `execute` tool, citing our measured numbers. ~1h. Reads as contributing
      to the ecosystem rather than extracting from it, and we genuinely believe
      it. Does **not** move us to the Continuity pool — it is a contribution we
      point at, not the project's identity.
- [ ] **A second cross-category axis** — the Messari base entities also cover
      YIELD/vaults, which is where the track text's ERC-4626 hint points. One
      more `kind` in `defi-scan.ts` if a healthy standardized vault subgraph
      exists. Cheap to try, and a third category makes "the pattern generalizes"
      harder to dismiss as a two-point coincidence.

## Deliberately not built

- **Anything named `dex_compare` / `lending_compare`.** Shipping a tool per
  use-case would rebuild the exact anti-pattern mdcp exists to remove. The
  primitives are `graph.*`; the comparison is a program the agent writes, and
  the two files in `bench/programs/` are examples, not fixed capabilities.
- **A fork of `subgraph-mcp`.** Both benchmark arms run the *same unmodified
  binary* — that is what makes the experiment readable. Forking it would
  destroy the control and gain nothing.
- **Substreams anything.** Not touched, not claimed.

## Standing risks

- **N=1 per configuration.** Two agent runs per arm, not a distribution. The
  direction is consistent across both task sizes and matches the deterministic
  sweep; no single ratio's second digit should be trusted. Stated in every
  RESULTS.md.
- **The 1,238x sweep figure is a cost model, not a measurement.** It models an
  agent re-reading its transcript each turn. Never cite it without the measured
  1.16x/1.34x beside it — if it reads as a measurement passed off as one, the
  whole benchmark loses standing.
- **Subgraph health drifts within hours.** Four Uniswap V3 deployments went
  healthy → "no allocations" between scenario 7 and the `dex-scan.ts` run on
  the same morning. Programs degrade gracefully, but reruns will not reproduce
  the same row set. Documented in `s8-graph-crosscategory/RESULTS.md`.
