# ETHOnline 2026 build plan — code-mode gateway for DeFi

> **This is the plan as written before the build, left unedited on purpose.**
> It is here as a planning artifact, not as a description of what shipped —
> several things in it turned out differently once measured, and the results
> that replaced its placeholders are in [BENCHMARK.md](./BENCHMARK.md). Where
> the two disagree, BENCHMARK.md is what happened.

**DEADLINE: Sun Sep 13, 12:00 pm EDT (16:00 UTC). Hard. ~24h left.**
Track: Classic (from scratch — all code written during the event; MIT libraries allowed).

## The pitch

> executor.sh (YC S26) proved agents need code-mode gateways instead of raw MCP —
> 1,640 tools ≈ 278k tokens collapsed to ~1k. Crypto needs its own: on-chain actions
> add signing, simulation, idempotency, and quote-staleness that no generic gateway
> handles. We built it, and we publish the benchmark they never did.

One MCP tool: `execute(code)`. The agent writes TypeScript; inside a sandbox it
discovers DeFi tools progressively, runs the whole quote→simulate→sign→submit
pipeline in ONE model round-trip, and only the receipt reaches the model.
Measured demo: same Uniswap strategy setup, vanilla per-tool MCP vs us —
**N× fewer tokens, M× fewer round-trips** (live token counter on screen).

## Architecture (executor.sh pattern + crypto deltas)

- **MCP surface (3 tools):** `execute` (TS code), `skills` (lazy docs — calling
  convention NOT in the always-loaded description), `resume` (continue after
  wallet approval). Description lists integration names only, no schemas.
- **Sandbox:** quickjs-emscripten (WASM). Lazy `tools.*` proxy:
  `tools.search({query})` → `tools.describe({path})` (compact TS types derived
  from ABIs, not JSON Schema) → `tools.uniswap.<wallet>.<action>(args)`.
  Errors as data `{ok:false, error:{code, retryable}}` → in-sandbox retry.
  No fetch; big payloads (pool lists, routes) filtered in code.
- **Crypto deltas (the novelty — say them out loud in the video):**
  1. *Signing = pause/resume*: sandbox builds unsigned tx → execution pauses →
     human approves/signs (or session-key policy auto-signs under limits) →
     resume with tx hash. Keys NEVER enter the sandbox.
  2. *Idempotency*: tx-intent dedup key + "submitted" checkpoint the sandbox
     cannot re-enter; re-running failed code can't double-spend.
  3. *Staleness*: resume after pause re-quotes + re-simulates against slippage
     bounds instead of blindly continuing.
  4. *Policy from ABI*: view → auto-allow; nonpayable/payable → approval;
     unlimited approve → block.
- **Chain layer:** viem + Sepolia (or Base Sepolia). Simulation via eth_call.

## Partner prizes (pick 3 at submission)

1. **Uniswap Foundation — Best Uniswap Stack Contribution ($3k, up to 3×$1k)**:
   catalog = Uniswap v4/v3 + Uniswap API (quote, swap, LP mint/burn). Core demo.
2. **The Graph — Best AI Tooling (From Scratch) ($5k)**: literally "tooling that
   makes The Graph easier to use from AI environments like Claude". Our
   `tools.graph.*` integration: subgraph discovery + querying from the sandbox
   (pool/token discovery feeds the Uniswap pipeline). Check quals on the event's prize page.
3. **Privy — Best financial flow ($2.5k)**: Privy server wallets AS the host-side
   key custody — the sandbox never sees keys, Privy signs on resume. Natural fit.
   (Alternate: Bazantic "Agentify a new API" $1k if Privy integration stalls.)

## 24h schedule

- **h0–2**: scaffold builds & runs; MCP server with 3 tools registers in Claude Code.
- **h2–7**: sandbox + tools proxy + Uniswap catalog (quote/swap on Sepolia fork or
  testnet); search/describe with TS-type compression.
- **h7–10**: pause/resume signing flow (Privy or local keystore) + policy defaults.
- **h10–13**: The Graph integration (subgraph query tool) + end-to-end strategy demo
  (e.g. "LP into the best-fee ETH/USDC pool with ±2% range").
- **h13–16**: benchmark harness: identical task via (a) vanilla one-tool-per-action
  MCP server (we ship it as the baseline) vs (b) our gateway. Log tokens + round-trips.
- **h16–20**: README, architecture diagram, polish, deploy nothing we don't need.
- **h20–23**: **demo video 2–4 min, ≥720p, HUMAN narrator (AI voiceover = rejected)**,
  submission form (title, description, repo public, 3 partner picks + how used).
- Buffer: 1h. Submit by 11:00 am EDT, not 11:59.

## Submission checklist

- [ ] Public repo, all code authored during event window
- [ ] Video: 2–4 min, 720p+, human voice, shows the token-counter side-by-side
- [ ] 3 partner prizes selected with integration explanations
- [ ] Live demo link optional but judges love runnable things (`npx` one-liner?)
