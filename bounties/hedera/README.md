# Hedera — Open Source: Improve the Hedera Harness

**Pool:** $2,000 — up to 2 teams receive $1,000.

## The ask, verbatim

> The Hedera Harness is the tool layer developers reach for first, which makes
> it the highest-leverage thing in the ecosystem to improve. This track rewards
> contribution over greenfield: make the harness better, or build a new one on
> its foundations.

Ideas listed: extend service coverage into areas the harness handles thinly;
port the harness to another language or runtime; fix the rough edges you
personally hit in your first hour with Hedera; add a testing or
local-development mode that removes testnet round trips.

## Qualification requirements → our evidence

| requirement | status | evidence |
| --- | --- | --- |
| Meaningful contribution to the Harness (open PR, not merged is fine) **OR** a new harness that extends or takes direct inspiration from it | met via the **second** arm; PR still open as an item | `app/src/hedera.ts`, `app/src/hederaUpstream.ts`, `skills/mdcp-port/hedera-catalog/` |
| Public GitHub repo or PR link, with a README explaining the problem solved and how to run it | met | [github.com/ivanvolov/mdcp](https://github.com/ivanvolov/mdcp) — README "Hedera" section + Quickstart |
| Demo video ≤ 5 minutes showing the improvement working | **outstanding** | `DEMO.md` in this folder |

## Extra points → our evidence

- **New service coverage** — HTS *and* HCS in one catalog (11 capabilities),
  plus Hedera's own 43-tool mirror-node MCP server mounted inside the sandbox.
- **Better ergonomics / fewer lines to a working transaction** — measured, not
  asserted: the agent authored **181 lines → 25** on the two-service task and
  **106 → 0** on the single-service one. One catalog skill (6.6KB) replaces two
  official skills (42,515 bytes).
- **Tests, documentation, examples** — runnable programs
  (`app/bench/programs/audit-trail.ts`), deterministic probes
  (`bench/hedera-probe.ts`, `bench/mirror-sweep.ts`), upstream setup docs
  (`app/bench/upstream/README.md`).
- **Clear before/after DX evidence** — `BENCHMARK.md` §4, §5, §6 with raw logs
  and live HashScan links, *including the rounds where we did not win*.

## The honest core of this submission

Hedera ships two official AI surfaces with opposite shapes, and we benchmarked
both:

- **`hedera-skills`** — SKILL.md files that tell the agent to write a Hiero SDK
  script. That is *already code-mode*, so a code-mode gateway has nothing to
  remove. Measured twice (one service, then two): **a wash — 1.06x tokens and
  2x slower.** We report it as measured.
- **`mirrornode-mcp-server`** — 43 MCP tools, one per REST endpoint, one model
  round-trip per call. Against this the shape wins outright: **47,766 → 434
  bytes into context (110x), 6 round-trips → 1.**

Most submissions will claim their thing is faster everywhere. Ours says exactly
where it is not, and why — and that distinction is the actual contribution to
the harness conversation: *if your skill already tells the agent to write code,
a gateway buys you safety and ergonomics, not tokens.*

## Artifact map

Code and benchmarks live where they live; this folder is paperwork only.

- `app/src/hedera.ts` — HTS + HCS on live testnet via the Hiero SDK; keys stay
  host-side, recipient keys in a host keystore.
- `app/src/hederaUpstream.ts` — mounts `hedera-dev/mirrornode-mcp-server`
  unmodified; sibling of `graphUpstream.ts`, which is untouched.
- `skills/mdcp-port/hedera-catalog/SKILL.md` — the one catalog skill.
- `skills/hedera-official/` — both official skills, vendored verbatim at
  `8b1fccd`, Apache-2.0, evals included.
- `app/bench/arm-hedera.sh`, `app/bench/arm-mirror.sh` — the arms.
- `app/bench/logs/mirror-sweep-result.json`, `hedera-probe.jsonl`,
  `hedera-mdcp.jsonl` — raw evidence.
- `BENCHMARK.md` §4–§6 — the write-ups, caveats included.
