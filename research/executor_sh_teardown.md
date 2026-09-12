# executor.sh teardown → what transfers to our DeFi tool (2026-09-12)

Verified from source (repo cloned to session scratchpad `scratchpad/executor/`).

## Facts

- YC **S26**, solo founder **Rhys Sullivan** (ex-Vercel/Microsoft, answeroverflow.com, OpenCode).
- **MIT license**, full monorepo open: https://github.com/UsefulSoftwareCo/executor
- Headline number: **1,640 tools ≈ 278,800 tokens without → 1 tool ≈ 1,044 tokens with (~99.6% context reduction)**.
  This is a *context-size* claim — they publish **no latency benchmark**. "Faster" = fewer model round-trips.
- Not a new wire protocol: **still MCP at the edge**; wraps MCP/OpenAPI/GraphQL upstreams.

## The mechanism (3 layers)

1. **Tiny fixed MCP surface** — only `execute(code: TypeScript)`, `skills` (docs fetched lazily —
   the calling-convention essay is deliberately NOT in the always-loaded description), `resume`
   (continue a paused execution after human approval), optional per-integration `search_*`
   micro-tools. Integration *names only* (no schemas) in the description, capped at 50.
2. **Code mode with progressive disclosure** — inside the sandbox (QuickJS/WASM) the agent's code gets
   a lazy `tools.*` proxy: `tools.search({query})` → `tools.describe.tool({path})` (returns **compact
   TypeScript type strings**, not JSON Schema) → `tools.<integration>.<owner>.<connection>.<tool>(args)`.
   Results are `{ok, data} | {ok:false, error:{code, retryable}}` — errors are data, so retries/branches
   happen in-sandbox. `emit()` streams progress; big collections are filtered in code, never shipped to
   the model. `fetch` banned; proxy enumeration throws (forces search).
3. **Normalized catalog + gateway** — plugins normalize any upstream into one manifest (schema,
   side-effect class, auth). **Secrets never enter the sandbox** (resolved host-side; no SecretRef in
   any I/O schema). Policies per tool address: allow / require_approval / block, glob patterns,
   GET auto-allowed. Approval **pauses execution mid-code** → approval URL → `resume` continues.

## Copy for the DeFi tool (all directly reproducible in 24h scope)

- The 3-meta-tool surface. DeFi catalog (Uniswap quote/swap/LP, approvals, balances, routes…)
  collapses from hundreds of tool schemas to ~1k tokens → **our measurable "Nx cheaper" demo number**.
- Code mode for the pipeline: quote → build tx → simulate → approve-gate → sign → submit → receipt as
  ONE `execute` call. In-sandbox retry on slippage/nonce/gas. Only the receipt reaches the model →
  **our "Nx faster" story (round-trips, not RPC speed)**.
- `describe.tool` returning compact TS types derived **deterministically from ABIs** (not observed).
- **Pause/resume = wallet signing UX.** Sandbox builds unsigned tx → execution pauses → human signs in
  wallet → resume with tx hash. Keys host-side always; sandbox sees only addresses + opaque handles.
- Side-effect defaults from ABI: `view` auto-allow; nonpayable/payable → require approval;
  unlimited-approve / delegatecall → block.
- Addressing `tools.uniswap.<owner>.<wallet|chain>.<action>` for multi-wallet/multi-chain.
- Since it's MIT: can vendor `@executor-js/codemode-core` + QuickJS runtime, or write a protocol
  plugin for their `resolveTools`/`invokeTool` seam over ABIs instead of rebuilding the kernel.

## Must change (where crypto breaks their assumptions)

- **Idempotency**: re-running failed code is safe for HTTP reads, double-spends for broadcast txs.
  Need nonce reservation, tx-intent dedup keys, "submitted" as a non-reenterable checkpoint.
- **State drift across pause**: quotes go stale in seconds; resume must re-quote + re-simulate with
  slippage bounds, not blindly continue.
- **Chain-state layer** (provider, simulation, gas oracle) as first-class sandbox capabilities.
- **Benchmarks don't exist upstream** — we must measure tokens/task + wall-clock vs a vanilla
  per-tool-MCP baseline ourselves. Easy and honest; strengthens the pitch vs executor's unmeasured claim.

## Positioning

"executor.sh proved generic APIs need code-mode gateways (YC S26). Crypto needs its own: on-chain
actions add signing, simulation, idempotency, and staleness — none of which generic gateways handle."
That's the "crypto needs its own MCP standard" line, now with a named precedent.
