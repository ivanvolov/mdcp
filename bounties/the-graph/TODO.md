# TODO — The Graph submission

Deadline target: **11:00 EDT, Sun 2026-09-13** (hard cutoff 11:59; the plan is
to submit at 11:00, not to race the wire).

Legend: **[you]** needs a human · **[claude]** I can do it · **[done]** shipped.

## Blocking — must be true to submit

- [ ] **[you] Pick the 3 partner prizes.** ETHGlobal allows three selections per
      project and we have four candidates: Uniswap, The Graph Track 1
      (Standardized), The Graph Track 2 (AI / From Scratch), Hedera. Both Graph
      tracks are separately eligible and separately judged, so taking both is
      legitimate — it just spends two of three slots. My read: **Track 2 is the
      stronger claim** (the adapter is exactly the "AI tooling that targets The
      Graph's products" the text describes), **Track 1 is the less crowded one**
      and our standardized-schema evidence is unusually concrete. Decide against
      the Uniswap and Hedera claims, not in isolation.

- [ ] **[you] Record the demo video** — 2–4 min, ≥720p, **human voice**
      (AI voiceover is an automatic rejection). Beat sheet with what to show and
      say: `DEMO.md`. The Graph segment is ~45 seconds of it.

- [ ] **[you] Paste the submission form answers** from `SUBMISSION.md` (drafted,
      needs your voice-check and the final track picks).

- [x] **[done]** Public repo — https://github.com/ivanvolov/mdcp, everything
      pushed, MIT, all work inside the event window.

- [x] **[done]** Judges-can-run-it doc — `skills/mdcp-graph/SKILL.md`.

- [x] **[done]** Live-data requirement — every Graph query hits
      `gateway.thegraph.com` with a Studio key; no mocks, no cache, no fixtures.

## Should do — materially strengthens the submission

- [x] **[done] The Graph has real estate in the root README.** The Integrations
      entry now carries the adapter framing, the N=3 vs N=10 table, the
      schema-SDL finding, and pointers to the skill and all three log dirs.

- [x] **[done] No-Rust path verified end-to-end.** With `SUBGRAPH_MCP_BIN`
      unset, mdcp bridges to the hosted SSE service via `npx mcp-remote` and
      live queries return real data (Uniswap V3 schemaVersion 4.0.0,
      dailyVolumeUSD 106,487,875). The SKILL.md quickstart is not a trap for a
      judge without a Rust toolchain. Note our own `.env` points
      `SUBGRAPH_MCP_BIN` at a session scratchpad path that will be
      garbage-collected — harmless, since the fallback works.

## Nice to have — only if time survives

- [ ] **[claude] Open an upstream issue on `graphops/subgraph-mcp`** proposing a
      code-mode `execute` tool, citing our measured numbers. Costs an hour,
      reads as ecosystem contribution rather than extraction, and is honest —
      we genuinely think their 9 tools would benefit. Does **not** move us to
      the Continuity pool; it is a contribution we point at, not our project's
      identity.

- [ ] **[claude] Chart polish for slides** — `s6-graph-sweep/chart.html` is
      rendered and checked in both themes. Only revisit if you want a different
      framing (e.g. bytes instead of tokens on the left axis).

## Explicitly not doing

- **Continuity track (Track 3)** — requires the project to *be* an extension of
  an existing repo. mdcp is net-new; claiming otherwise would be false.
- **Featured Substreams challenge** — prompt → deployed Substreams pipeline. We
  never touched Substreams. Not claimed anywhere in the submission.
- **Moving Graph artifacts into this folder** — the code and logs are shared
  with the Uniswap and Hedera claims; `README.md` here carries an artifact map
  instead. Re-pathing files hours before a deadline breaks more than it tidies.

## Open risks

- **N=1 per configuration.** Two agent runs (N=3, N=10) per arm, not a
  distribution. The *direction* is consistent across both sizes and matches the
  deterministic sweep, but no single ratio's second digit should be trusted.
  Stated plainly in every RESULTS.md; keep it stated in the video too — the
  benchmark's credibility is the submission's main asset.
- **The 1,238x sweep figure is a cost model, not a measurement.** It models an
  agent re-reading its transcript each turn. Always cite it next to the measured
  1.16x/1.34x, never alone. If a judge thinks we passed off a model as a
  measurement, the whole benchmark loses its standing.
- **Subgraph health drifts.** PancakeSwap Ethereum, Balancer V2, Camelot,
  QuickSwap and Aerodrome were all dead on the network at probe time (no
  allocations / indexing errors), and the ten we use could drift too. If a judge
  reruns next week and one target fails, the program's error-as-data path skips
  it — but the numbers will not reproduce exactly. Worth one sentence if asked.
