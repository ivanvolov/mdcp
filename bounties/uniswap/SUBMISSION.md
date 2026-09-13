# Submission answers — Uniswap

Drafts. Read them in your own voice before pasting; they should sound like you.

## ETHGlobal partner-prize question

> How did you use Uniswap, and what feedback do you have?

We built an MCP gateway that lets an AI agent run Uniswap strategies as
sandboxed programs, and we integrated the Trading API as its execution path:
`/check_approval` → `/quote` → `/swap`, signed and broadcast host-side, with a
standing Permit2 allowance (`app/src/tradingApi.ts`). Every request carries
`x-agent-info` with `integration_name: "mdcp"`. We also wired the on-chain
stack — QuoterV2, SwapRouter02, v3 pool depth per fee tier, and Swap-log
decoding for copy-trading (`app/src/chain.ts`).

The interesting part is how we tested it. We took the `uniswap-ai` skills
verbatim and ported the strategy skills to our gateway by changing only the
delegation target — 12 lines of 126 in `dca-bot`, 20 of 158 in `index-bot` —
then gave fresh agents the same tasks. On live Sepolia through the production
Trading API: 1.42x fewer tokens and 2.3x faster across four operations, with
four public transactions. On a 3-leg index basket: 2.81x fewer tokens, 11x
faster. Our cost stays flat (~55k tokens) whether the task is a balance read or
a swap, while the skill-only arm swings 60k–180k, because it re-derives its own
executor every session.

The feedback is in FEEDBACK.md and it is specific. The headline: the Trading API
is a brain with no hands. The SDKs state they don't execute;
`@uniswap/client-trading` on npm is protobuf types referenced by neither the
docs nor the skills; so `swap-integration` hands the agent 62KB of instructions
and asks it to build an executor from scratch. We also found two documentation
bugs the hard way — the Legacy approval path as written does not work (the
router pulls through Permit2, so a direct approval reverts with `0xd81b2f2e`),
and `routingPreference: "CLASSIC"` is documented but rejected by the live API.
Full list, including two claims we withdrew after verifying them:
https://github.com/ivanvolov/mdcp/blob/main/FEEDBACK.md

## Uniswap Developer Feedback Form

> Link to your FEEDBACK.md

https://github.com/ivanvolov/mdcp/blob/main/FEEDBACK.md

> What were you building?

An MCP gateway ("mdcp") that executes DeFi strategies as sandboxed programs
instead of one tool call per step, with Uniswap as the first integration.

> What worked well?

The Trading API's routing is excellent and `x-agent-info` with an explicit
`decision_origin` is a genuinely good idea we hadn't seen elsewhere. The
`uniswap-trading-tools` execution model is the best-specified agent-safety
document we've seen from a protocol — confirm vs. autonomous modes, and the rule
that autonomous requires spend caps, an allowlist, a dry-run and a kill switch.
The period-key invariant in `strategy-state.md` is real engineering.

> What was hard?

Everything between "API response" and "confirmed transaction". There is no
official executor, so each agent writes one — ours measured a fresh ~10KB viem
script per session before the first trade. Permit2 signing is specified for
request *shape* but the skill contains zero occurrences of `signTypedData`.
Permit2 nonces are read from live mainnet, so the second swap on a fork reverts
as an undecoded custom error. The Legacy path that fixes it is documented
incorrectly. `routingPreference: "CLASSIC"` is documented but rejected.
Details and reproduction in FEEDBACK.md.

> What would you like to see?

An official executor package (or one blessed pattern), Permit2 errors decoded
into the `/swap` response, one sentence in the Permit2 section saying the nonce
comes from live mainnet, a corrected Legacy snippet, and published token budgets
per skill — context size is the dominant cost of an agent integration and it is
currently invisible.

## Repo pointers for judges

- Integration code: `app/src/tradingApi.ts`, `app/src/chain.ts`
- Safety layer: `app/src/sandbox.ts`
- The port, side by side: `skills/uniswap-official/` vs `skills/mdcp-port/`
- Methodology and caveats: `BENCHMARK.md`
- Evidence map with line numbers: `bounties/uniswap/README.md`
