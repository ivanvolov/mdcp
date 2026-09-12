# Feedback for the Uniswap Foundation

Submitted as part of **mdcp** (ETHOnline 2026, Classic / From Scratch).
Repo: https://github.com/ivanvolov/mdcp

We built an MCP gateway that lets an AI agent drive Uniswap by writing one
sandboxed program instead of making a dozen separate tool calls. Along the way
we read the whole `Uniswap/uniswap-ai` plugin suite closely and integrated
against the v3 Quoter and SwapRouter02. This is what we found.

## What worked well

**The `uniswap-trading-tools` execution model is the best-specified agent-safety
document we have seen from a protocol.** `references/execution-model.md` gets the
hard part right: `confirm` vs `autonomous` modes, and the rule that autonomous
requires all four of a per-run spend cap, a per-period spend cap, a token
allowlist, a dry-run, and a kill switch. The insistence that strategy skills
never build their own quote/approval/signing logic — that they delegate to
`swap-integration` — is exactly the layering we ended up enforcing in code.

**The three strategy skills are well-chosen.** DCA, index, and copy-trade cover
the shapes most agent trading actually takes, and keeping them as thin layers
over one execution path means a fix in `swap-integration` improves all three.

**The idempotency guidance is real engineering, not boilerplate.** The
period-key invariant in `strategy-state.md` (derive the key from the cadence,
never assume the UTC day) is precisely the bug someone ships on day one.

**`x-agent-info` with an explicit `decision_origin`** is a good idea we had not
seen elsewhere: the protocol gets to distinguish human-approved from autonomous
flow at the traffic level. We send it with `integration_name: "mdcp"`.

## What was harder than it should have been

**1. The skills' guidance about human approval assumes an interactive runtime.**
`swap-integration` mandates `AskUserQuestion` before any gas-spending call, and
the trading-tools skills repeat it. But the same docs describe the host agent's
*scheduler* waking the skill on a cadence — a cron run has no one to ask. The
runtime-compatibility note ("collect the same confirmations through natural
language instead") does not resolve it: in a scheduled run there is no
conversation at all. The approval gate needs to be a property of the execution
layer, not a prompt instruction. This is the gap mdcp fills: a state-changing
call *suspends* the program, returns an approval request with a stable intent
hash, and resumes later — so the same code path works interactively and
headlessly.

**2. Nothing enforces the guardrails.** Spend caps, the allowlist, the kill
switch and the dry-run are described as things the skill "must" do, but they
live in markdown the model may or may not follow. We would love a
`@uniswap/agent-guardrails` package — cap and allowlist checks as code that
wraps the Trading API client — so the guarantee survives a model that skims.

**3. The context cost of the skills is large and unmeasured.** Doing a single
DCA buy the documented way pulls in `dca-bot` + `execution-model` +
`strategy-state` + the target-chain template + `swap-integration` +
`viem-integration`. We measured that dependency closure at **105,122 characters
(~26k tokens)** before a single call is made, with `swap-integration/SKILL.md`
alone at 62KB. No token or latency budget is published anywhere in the repo.
For an agent that runs on a cadence across many positions, this is the dominant
cost, and it is invisible today. A published per-skill token budget, and a
"minimal" variant of `swap-integration` that covers just the Trading API path,
would both help a lot.

**4. `routingPreference` docs vs. validation.** `swap-integration` lists
`BEST_PRICE`, `FASTEST`, and `CLASSIC` as the accepted values for
`routingPreference`, but the live API rejects `CLASSIC`:
`{"errorCode":"RequestValidationError","detail":"\"routingPreference\" must be
one of [BEST_PRICE, FASTEST]"}`. `CLASSIC` is a valid *routing type* in the
response, which is probably the source of the confusion — but an agent
following the skill verbatim gets a 400 on its first call.

**5. Request validation runs before authentication.** Posting to `/v1/quote`
without an `x-api-key` returns a body-validation 400 first, and only a 401 once
the body is valid. A newcomer debugging their first request can spend a while
fixing a schema that was never the problem. Authenticating first would make the
actual error obvious.

**6. Getting a key needs an interactive login, which agents cannot do.** For a
repo whose entire purpose is agent-driven development, the Trading API key sits
behind a Google/GitHub/email login with no programmatic path. A scoped
testnet-only key issuable by CLI would remove the one manual step in an
otherwise fully automatable flow.

**7. The reference target-chain template is an unusual default.** Robinhood
Chain is the only template shipped, and it brings RWA-specific baggage —
transfer-restricted ERC-20s, equity market hours, token-level gating — into
skills that are otherwise asset-agnostic. A plain Ethereum-Sepolia or Base
template would be a gentler starting point, with Robinhood as the advanced case
showing what a restrictive chain adds.

## What we would like to see next

- **Publish token/latency budgets per skill**, and treat context size as a
  first-class cost of an agent integration.
- **Ship the guardrails as enforced code**, not prompt text.
- **A suspend/resume signing contract** in the execution model, so the same
  strategy can run interactively and on a scheduler without changing shape.
- **A `CLASSIC`-only quote path** for integrators who want deterministic AMM
  behavior and cannot handle UniswapX order flow in a first version.

## Where our integration lives

- `app/src/chain.ts` — viem clients, QuoterV2 quoting, SwapRouter02
  `exactInputSingle`, exact-amount ERC-20 approvals.
- `app/src/tools.ts` — the capability registry, including the side-effect class
  (`view` / `local` / `chain`) that drives our policy gate.
- `app/src/sandbox.ts` — the approval gate, suspend/resume, and the
  transaction-intent ledger that makes a resumed run unable to double-spend.
- `app/bench/` — the measurement harness comparing a per-tool agent loop against
  the same work done as one sandboxed program.

Thanks for the uniswap-ai repo — it is a genuinely good piece of work, and most
of the criticism above is only possible because the design is written down
clearly enough to argue with.
