# Feedback for the Uniswap Foundation

From building **mdcp** (ETHOnline 2026): an MCP gateway that runs Uniswap
strategies as sandboxed programs. We read the full `uniswap-ai` suite, ported
`dca-bot` onto our execution layer (12 lines changed of 126), and benchmarked
the official skill against the port on identical tasks — including one round
where both sides used the production Trading API end to end. Every claim below
was verified against the live API or the shipped packages; things that did not
survive verification are listed at the bottom rather than deleted.

## The core gap: the Trading API has no hands

**There is no official executor.** Verified three ways:

- The [SDK overview](https://developers.uniswap.org/docs/sdks/overview) states
  the SDKs compute and encode but "do not execute trades or send transactions" —
  the application owns signer, broadcast, approvals.
- `@uniswap/client-trading` (npm, v0.9.0) turns out to be auto-generated
  protobuf/Connect types for the API — zero dependencies, no signing, no
  broadcast. And **neither the skills nor the docs ever mention it**; we found
  it by searching npm by hand.
- The `swap-integration` skill's answer to execution is: have the agent write
  the executor itself. In our benchmarks the agent following the skill wrote a
  fresh ~10KB viem script *every session* — client setup, permit handling,
  approval sequencing, broadcast, receipts — before the first trade.

Everything between "API response" and "confirmed transaction" is DIY, and it is
exactly the part where money is lost. This is what mdcp packages: an executor
with an approval gate, transaction-intent idempotency, and keys that never
enter the strategy's execution context. We would much rather this existed
upstream. Until it does, every agent integration re-invents it, differently,
with the private key in scope.

Concrete consequences we hit, each worth fixing on its own:

1. **Permit2 signing is documented for humans, not for the artifact agents
   read.** The skill (62KB) specifies the request-shape rules — signature and
   permitData both-or-neither, strip nulls, UniswapX exclusion — in detail, but
   contains **zero** occurrences of `signTypedData`: the actual act of producing
   the signature is absent. The web docs show a one-line ethers
   `_signTypedData(...)` and note the response "does not return every field
   some libraries expect" — precisely the friction we hit with viem, which
   needs a `primaryType` the response never names. One code block in the skill
   (ethers *and* viem) would have saved both our gateway and the benchmarked
   agent real debugging time.
2. **No replay protection anywhere in the path.** The API is stateless by
   design; the deadline is the only bound. Re-broadcasting the same built swap,
   or re-running a strategy whose first attempt already landed, double-spends
   silently. This is an executor-layer responsibility — but since no executor
   exists, today it is nobody's. (Our intent ledger keys each transaction on
   its economic fields plus occurrence index; we found and fixed two
   double-spend bugs in our own design purely because the layer existed to
   hold the invariant.)
3. **`gasLimit` in the /swap response has an undocumented trust boundary.** It
   is estimated against live-mainnet warm/cold state; against any other state —
   forks, simulations, replays — it under-provisions and the transaction
   reverts OutOfGas mid-swap. Nothing in the docs says when the number can be
   trusted. A sentence would do.
4. **`routingPreference: "CLASSIC"` is documented but rejected by the live API**
   (`must be one of [BEST_PRICE, FASTEST]`). Independently rediscovered by the
   benchmarked agent, which burned two failed runs on it before working around
   via `protocols: ["V2","V3","V4"]`.
5. **Request validation runs before authentication** — a missing key surfaces
   as a body-validation 400 first, so newcomers debug schemas that were never
   the problem.
6. **The API key requires an interactive login** with no programmatic path —
   the one manual step in an otherwise automatable flow, in a product suite
   aimed at agents.

## The skill-suite gaps we still stand behind

- **The approval story assumes an interactive runtime.** `swap-integration`
  mandates `AskUserQuestion` before any spend; the trading-tools skills are
  designed to be woken by a scheduler — where no one can answer. The approval
  gate needs to live in the execution layer (suspend/resume with a reviewable
  transaction plan), not in prompt text. This is measurable, not rhetorical:
  our port runs the same strategy headlessly with the gate *enforced*.
- **Guardrails are prose.** Spend caps, allowlist, dry-run, kill switch — all
  described as musts, none enforced by anything. A model that skims has the key
  and no fence.
- **Context cost is large and unpublished.** The dca-bot dependency closure is
  105,122 chars (~26k tokens) before the first call. In our API-path benchmark
  the official-skill agent spent 114,967 tokens and 193s on one DCA buy versus
  63,467 and 65s for the identical strategy on a 4KB execution contract.

## What did not survive verification

We checked our own complaints before sending them; these failed, and one of
them is interesting anyway:

- **"check_approval breaks on native ETH" — false.** The live API returns a
  clean `{"approval": null}` for the zero address. We had written a client-side
  guard on the assumption it would fail, and never needed it. (The behavior is
  undocumented, which is why we assumed — but the API does the right thing.)
- **"The /swap body shape is strict" — apparently false, which is its own
  finding.** The skill warns emphatically not to wrap the quote
  (`{quote: quoteResponse}` marked "Don't wrap!") — yet our gateway sent
  exactly that wrapped shape on CLASSIC routes and the API accepted it and the
  swaps executed. Either the API tolerates both shapes (then the skill's
  warning is overstated) or one shape is deprecated (then say which). A
  documented contract would remove the guesswork.
- The permit-shape rules we initially thought undocumented **are in the skill**
  (both-or-neither, null-stripping, routing-type differences). What is missing
  is the signing itself — see point 1 above. We flag this split deliberately:
  the rules being present but the signature act absent is exactly the kind of
  gap that is invisible to the author and fatal to a first-time agent.

## Where our integration lives

- `app/src/tradingApi.ts` — the executor: check_approval → quote → Permit2
  EIP-712 signature → /swap → host-side sign & broadcast, with `x-agent-info`
  attribution (`integration_name: "mdcp"`) on every request.
- `app/src/sandbox.ts` — approval gate (plan once, approve once), intent
  ledger, occurrence-indexed idempotency.
- `skills/uniswap-official/` vs `skills/mdcp-port/` — the side-by-side port,
  12 lines changed.
- `BENCHMARK.md` — methodology, results, and the three bugs the benchmark
  caught in our own design.

Sources: [SDK overview](https://developers.uniswap.org/docs/sdks/overview),
[Swapping API integration guide](https://developers.uniswap.org/docs/trading/swapping-api/integration-guide),
[Permit2 guide](https://api-docs.uniswap.org/guides/permit2),
`@uniswap/client-trading@0.9.0` on npm, and the live
`trade-api.gateway.uniswap.org/v1` responses recorded in `app/bench/logs/`.
