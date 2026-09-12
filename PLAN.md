# ETHOnline 2026 build plan — code-mode gateway for DeFi

**DEADLINE: Sun Sep 13, 12:00 pm EDT (16:00 UTC). Hard. ~24h left.**
Track: Classic (from scratch — all code written during the event; MIT libraries allowed).

## Frozen idea (do not re-litigate)

**mdcp = MCP for DeFi.** Priorities, in order:
1. **Token usage + speed** — the headline. Whole strategy pipelines in one model
   round-trip; measured benchmark vs vanilla per-tool MCP (tokens + round-trips + wall time).
   Speed matters *because strategies are time-sensitive* (quotes go stale).
2. **Security** — keys never in the sandbox, ABI-derived policy, idempotent tx
   intents, staleness re-checks. The reason a generic gateway can't do DeFi.
3. **Agentic vs human** — later. Pause/resume covers the human-approval case now;
   autonomous session-key policies are a roadmap slide, not a build item.

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

## Partner prizes (pick 3 PARTNERS at submission)

**Rule (verified on the event Info page):** up to 3 Partner Prizes, but a partner
with multiple tracks counts as ONE pick and you're eligible for ALL their tracks.
So optimize per-partner, not per-track. We're Classic/From Scratch → Continuity-only
tracks excluded. Picks (eligible pool **$18k across 5 tracks**):

1. **The Graph ($10k eligible — 2 from-scratch tracks)**
   - *Best AI Tooling (From Scratch), $5k*: "new or extended MCP servers, agent
     SKILLs" — this is us verbatim. `tools.graph.*` feeds pool/token discovery
     into the Uniswap pipeline.
   - *Best Composable/Standardized Graph Products, $5k*: qualify by querying a
     **standardized schema across 2+ protocols** (Messari standardized subgraphs —
     e.g. one pools query shape over Uniswap + another DEX) or composing 2+ Graph
     products. Design `tools.graph` around the standardized schema, not a bespoke query.
   - ⚠️ **Hard qual: live data via Subgraph Studio API key. Mocked/static data
     explicitly disqualifies.** Get the API key early (h10 at latest).
2. **Privy ($5k eligible — BOTH tracks with one integration)**
   - *Best B2B financial product, $2.5k*: quals list "policies, signers, key
     quorums, intents" — our ABI-derived policy + pause/resume approval flow IS
     this. Frame: business treasury running agent strategies under policy.
   - *Best financial flow, $2.5k*: the swap/LP flow itself, complexity hidden.
   - Quals: Privy wallet created/used as core custody; sandbox never sees keys;
     Privy signs on resume. One integration, two write-ups.
3. **Uniswap Foundation ($3k eligible, up to 3×$1k)**: catalog = Uniswap v4/v3
   (quote, swap, LP mint/burn). Core demo. ⚠️ **Extra quals: `FEEDBACK.md` in
   repo + submit the Uniswap Developer Feedback Form
   (https://developers.uniswap.org/hackathon-feedback) linking it; README must
   point at the exact files/lines of the integration.**

Rejected: Arc ($7k but frontend+backend+diagram+USDC-on-Arc, most money gated on
mainnet deploy by Sep 30 — scope risk), Hedera (wrong chain), 1inch (Aqua-only),
Bazantic (low $/effort, needs their platform setup), Ledger (device stack).

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

- [ ] Public repo, all code authored during event window ✓ (repo live: ivanvolov/mdcp)
- [ ] Real commit history (no giant single commit) — commit as we go
- [ ] AI-tool attribution section in README (which parts Claude-assisted) — required by rules
- [ ] Video: 2–4 min, 720p+, human voice (NO AI voiceover, NO phone recording,
      NO speed-up), shows the token-counter side-by-side
- [ ] 3 partners selected: The Graph, Privy, Uniswap Foundation — each with
      integration explanation + feedback
- [ ] Graph: live Subgraph Studio API key wired (no mocks), standardized-schema
      query across ≥2 protocols for the composable track
- [ ] Privy: wallet created via Privy, policy/intent flow demonstrated (covers both tracks)
- [ ] Uniswap: FEEDBACK.md committed + Developer Feedback Form submitted with link;
      README points to exact integration files/lines
- [ ] Live demo link optional but judges love runnable things (`npx mdcp`)
