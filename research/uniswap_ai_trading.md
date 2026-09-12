# Uniswap AI — trading skills teardown (up to date)

Source: `github.com/Uniswap/uniswap-ai`, cloned 2026-09-12, HEAD `5338d6e` (2026-09-08 — 4 days old).
Local clone: scratchpad `uniswap-ai/`.

## Repo map (7 plugins)

App-building plugins (**not our focus**): `uniswap-viem` (viem/wagmi integration), `uniswap-hooks`
(v4 hook generator + security), `uniswap-cca` (auction configurator/deployer),
`uniswap-permissioned-pools`, `uniswap-driver` (swap/liquidity planners that emit deep links).

**Trading plugins (our focus):**

### `uniswap-trading` — the execution layer
- `swap-integration` (SKILL.md, 1662 lines, v1.5.0, model: opus) — THE canonical execution skill.
  - **Trading API** is the recommended path for backends/bots: `https://trade-api.gateway.uniswap.org/v1`
  - 3-step flow: `POST /check_approval` → `POST /quote` → `POST /swap` → sign & broadcast via viem.
  - Auth: `x-api-key` from the Uniswap Developer Portal (developers.uniswap.org → dashboard, immediate).
  - Required headers: `x-universal-router-version: 2.0` and **`x-agent-info`** — compact JSON
    `{integration_name, decision_origin: "human_mediated"|"autonomous", version}` (ASCII, <1KB,
    all 3 fields). Attribution-only; malformed = silently dropped.
  - Routing types: CLASSIC, DUTCH_V2 (UniswapX), DUTCH_V3, PRIORITY, LIMIT_ORDER, BRIDGE, WRAP/UNWRAP,
    QUICKROUTE. `BEST_PRICE` on mainnet often returns DUTCH_V2, not CLASSIC.
  - Native ETH = `0x0000...0000` as token address; API inserts WRAP/UNWRAP itself.
  - Hard rule in the skill: **confirm with the user (AskUserQuestion) before ANY tx that spends** —
    i.e. Uniswap's own skills already encode a human approval gate.
  - `quote` gotcha: `tokenInChainId`/`tokenOutChainId` are **strings**.
- `lp-integration` (655 lines) — LP API: create/increase/decrease/claim fees for v2/v3/v4.
- `v4-sdk-integration` (271 lines) — V4Planner, V4Quoter, StateView, PositionManager (on-chain reads).
- `pay-with-any-token` / `pay-with-app` — HTTP 402 payment challenges via Trading API / OKX APP.

### `uniswap-trading-tools` — the strategy layer (dca-bot, index-bot, copy-trade)
Thin strategy skills (126–158 lines each, model: sonnet, v0.2.0). Explicit design rule:
**"skills never build quote, approval, swap, or signing logic themselves — they delegate"** to
`swap-integration` (Trading API path) + `viem-integration`.

Shared execution model (`references/execution-model.md`):
- Execution modes: `confirm` (default; approve every tx) vs `autonomous` (no per-tx prompts, only
  within guardrails). **Autonomous requires all 4: spend cap (per run + per period), token
  allowlist, dry-run first, kill switch.**
- No embedded scheduler — host agent's cron/wake invokes the skill; each run is self-contained.
- Idempotency via small JSON state file (`lastBuyPeriod` / block `cursor` / `positions`);
  period key must match cadence granularity.
- All pricing/execution data from Uniswap only (Trading API `/quote`, or V4Quoter/StateView);
  external price feeds forbidden.
- ETH/WETH treated as equivalent for allowlists; execution form left to the API.
- Funding never auto-topped-up: skip and report.
- Target-chain templates (chainId, contracts, token source, market-hours); reference template =
  Robinhood Chain (4663, RWA equities) — RWA transfer-restriction reverts handled gracefully.

Per skill:
- **dca-bot**: fixed buy per period, optional price-condition gate (price from `/quote` only).
- **index-bot**: weighted basket from one prompt, one-pass buy, drift rebalance on cadence.
- **copy-trade**: leader-wallet mirror, deterministic state machine (cursor → diff → guardrails →
  delegate), per-mirror spend cap, first run initializes cursor without replaying history.

## Trading API chain support (checked live)
23 mainnets (incl. Ethereum 1, Unichain 130, Base 8453, Arbitrum 42161, Robinhood 4663) and
**3 testnets: Ethereum Sepolia 11155111, Unichain Sepolia 1301, Base Sepolia 84532**.

## Implications for mdcp

1. **Execution path switch:** drop the hand-rolled QuoterV2/UniversalRouter encoding plan. Our
   catalog's swap tools should call the **Trading API** (check_approval → quote → swap) and sign
   with viem — fewer moving parts, testnet-supported, and it's the path Uniswap's judges push.
2. **The gap we fill (pitch):** Uniswap's trading-tools are markdown strategy skills executed in
   the agent loop — every quote/approval/swap/sign is a separate model round-trip with full JSON
   in context. mdcp runs the same canonical flow as **one sandboxed `execute()`**. Their own docs
   define the guardrail model (confirm/autonomous, caps, allowlist, dry-run, kill switch) — we
   implement it as enforced runtime policy instead of prompt instructions.
3. **Benchmark design:** same task ("DCA buy with price condition" on Sepolia) run (a) via
   vanilla per-tool MCP loop following the skills' flow vs (b) via one mdcp execute(); measure
   tokens + round-trips + wall clock.
4. **1:1 concept mapping** (use in README/FEEDBACK.md): confirm mode ↔ our pause/resume approval;
   autonomous guardrails ↔ our ABI policy engine; idempotent state file ↔ our tx-intent
   idempotency ("submitted" checkpoint); AskUserQuestion-before-spend ↔ policy `require_approval`.
5. **Attribution:** send `x-agent-info` with `integration_name: "mdcp"` and `decision_origin`
   chosen truthfully per execution (human_mediated when approval gate fires, autonomous when
   policy auto-allows). Judges will see the traffic attributed.
6. **Needs from operator:** Trading API key (developers.uniswap.org dashboard — register, key is
   immediate), Sepolia ETH + a test ERC-20 with a live Sepolia pool.
7. **FEEDBACK.md** (prize qualification) has real material now: e.g. skills' AskUserQuestion gate
   doesn't exist in non-interactive runtimes (our pause/resume is the answer), token-cost of
   1662-line SKILL.md in context, no latency/token benchmark published.
