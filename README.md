# ETHOnline 2026 — mdcp

Code-mode MCP gateway for DeFi: one `execute()` tool instead of hundreds of tool
schemas. Whole on-chain pipelines (quote → simulate → approve → sign → submit) run
in a single model round-trip inside a sandbox; only the receipt reaches the model.

Built from scratch during ETHOnline 2026 (Sep 4–13). See `PLAN.md` for the build
plan, `PRIZES.md` for the event's full prize information, `research/` for the
pre-build research (2026 finalist analysis, executor.sh teardown), and `app/` for
the code.

## Layout

- `app/` — the TypeScript MCP server (surface: `execute` / `skills` / `resume`),
  QuickJS sandbox, and the normalized DeFi tool catalog (Uniswap, The Graph, wallet).
- `PLAN.md` — 24h schedule, architecture, partner-prize mapping, submission checklist.
- `PRIZES.md` — all 11 sponsors / 28 tracks of ETHOnline 2026, full text.
- `research/` — finalists_2026.md (who won this year, verified), executor_sh_teardown.md
  (the YC S26 precedent this design builds on, and where crypto breaks its assumptions).
