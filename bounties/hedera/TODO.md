# TODO — Hedera

Build items for this bounty only. Event logistics (track picks, recording,
form pasting) live in your head, not here.

## Built

- [x] **HTS + HCS on live testnet** — `app/src/hedera.ts`. Hiero SDK behind the
      gateway: token create/mint/associate/transfer, account creation, consensus
      topics, message submission, mirror-node reads. Keys stay host-side;
      recipient keys live in a host keystore so an association can be signed
      without key material entering the sandbox.
- [x] **One catalog skill for both services** —
      `skills/mdcp-port/hedera-catalog/SKILL.md`, 6.6KB, 11 capabilities,
      self-contained (no prerequisite skill to read separately). Replaces two
      official skills totalling 42,515 bytes.
- [x] **Official skills vendored verbatim** — `skills/hedera-official/` at
      `8b1fccd`, Apache-2.0, **including their `evals/spec.json`**, whose
      prompts we reused as benchmark scenarios rather than inventing our own.
- [x] **Mirror-node MCP upstream** — `app/src/hederaUpstream.ts`, a sibling of
      `graphUpstream.ts` (left untouched). Discovers and mounts all 43 tools of
      `hedera-dev/mirrornode-mcp-server` unmodified as `mirror.*`.
- [x] **Benchmarks, including the ones we lost** — BENCHMARK.md §4 (single
      service: a wash), §5 (two services: still a wash, and now shown to be
      reproducible rather than variance), §6 (mirror-node MCP: 110x payload,
      6 round-trips → 1). Raw logs in `app/bench/logs/`.
- [x] **Runnable examples** — `app/bench/programs/audit-trail.ts` (two-service
      pipeline), `bench/hedera-probe.ts`, `bench/mirror-sweep.ts`,
      `bench/catalog-size.ts`. All reproduce their numbers without spending
      model tokens.
- [x] **Ergonomics fix** — `execute` accepts `@path/to/program.ts`, because the
      benchmark showed the agent losing real time shell-quoting a multi-line
      program.
- [x] **Upstream setup docs** — `app/bench/upstream/README.md`, including both
      workarounds needed to make Hedera's own MCP server reachable.
- [x] **Judge-facing README section** — the two-surfaces table, the 110x result,
      the upstream defects, live HashScan links, Hedera quickstart commands.
- [x] **Catalog isolation regression fixed** — HTS tools were gated on the mere
      presence of `HEDERA_OPERATOR_KEY`, and since every arm script sources the
      same `.env`, the Uniswap catalog had silently grown 13 → 21 tools. That
      would have invalidated its recorded numbers. Now gated on explicit
      `HEDERA_TOOLS=1`, verified back at 13 with zero leakage.

## Outstanding

- [ ] **Open the PR to `hedera-dev/mirrornode-mcp-server`** — *operator task,
      needs your explicit go-ahead.* It forks a third party's repo and opens a
      public pull request under your GitHub identity, so no session opens it
      without you saying so. This is the highest
      -leverage item left. It converts qualification requirement #1 from
      "arguably, via the new-harness arm" to unambiguous — the track says
      *"submit a meaningful contribution to the Hedera Harness (open PR, not
      merged is fine)"* — and it is verbatim their "fix the rough edges you
      personally hit in your first hour" bullet. Content is already written and
      tested:
      - pin `zod-to-json-schema@3.24.1` so a clean clone starts at all
      - add a stdio transport (`app/bench/upstream/mirrornode-stdio.mjs`),
        routing around the SSE endpoint that 500s on every connection
      Needs: fork under the submitter's account, branch, PR description. ~30 min.
- [ ] **Record the Hedera beat** — see `DEMO.md`. Check the operator balance
      first; a full pipeline run costs ~14 HBAR and the account was at ~19.
- [ ] **Decide the three partner picks.** ETHGlobal allows 3. Current
      candidates are exactly three: The Graph, Uniswap Foundation, Hedera.

## Deliberately not done

- **Widening the catalog toward executor.sh scale.** Their 99.6% context figure
  assumes 1,640 tools; ours is 67. Measured at our scale the catalog saving is
  only ~2.1x and is worth under 3% of an agent run, so more tools would not have
  changed any headline number — the payload ratio, not the catalog, is where the
  win lives here. Recorded in BENCHMARK.md §5 rather than chased.
- **Porting the remaining official plugins** (system-contracts, oracles,
  cross-chain). Real "extend service coverage" points, but §5 showed added
  services move the artifact ratios, not the agent cost — and there was no time
  to do it and still benchmark it honestly.
