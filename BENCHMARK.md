# Benchmark

Two questions, answered separately, because they need different controls:

1. **Does mdcp beat the official Uniswap skill?** — the headline test: their skill
   verbatim vs. the *same skill* ported to mdcp (12 lines changed).
2. **Where does the improvement come from?** — interaction-shape microbenchmarks
   on identical code, isolating the round-trip effect.

All runs: real Ethereum mainnet state on local anvil forks (real Uniswap
contracts, real liquidity, real transactions), one fork per arm, identical
starting balances, same model (Claude Sonnet), agents run in parallel. In every
round both arms finished with **byte-identical on-chain balances** — same swap,
same route, same output — so the comparison is between equally-successful runs.

## 1. Official skill vs. the same skill on mdcp

### Level 3: production — live Sepolia, one fresh agent per operation

The test a user would actually experience. Eight fresh agents (one per
operation per arm), live Ethereum Sepolia, production Trading API, real public
transactions. Same wallet, runs sequenced to avoid nonce races; view operations
returned byte-identical results across arms, swap operations each landed on
chain with explorer-visible hashes.

Per operation — official skill vs mdcp port (agent tokens / wall clock):

- **quote 25 USDC->WETH** (view): 86,474 / 47s -> 54,683 / 21s (**1.58x / 2.2x**)
- **wallet balances** (view): 60,168 / 62s -> 55,124 / 31s (**1.09x / 2.0x**)
- **swap 25 USDC->WETH** (live tx): 85,794 / 145s -> 55,965 / 57s (**1.53x / 2.5x**)
  - official [`0x868d...d598`](https://sepolia.etherscan.io/tx/0x868d375e517ba510c80d0479990ddef0a2b38d2e27a0d7b1e1afa93643bbd598), mdcp [`0xeb1b...3a10`](https://sepolia.etherscan.io/tx/0xeb1b2c71c5dd6aeddf3069ce006e6549300645699091fe0a5f813a0d07d93a10)
- **swap 0.002 WETH->USDC** (live tx): 83,066 / 109s -> 56,366 / 49s (**1.47x / 2.2x**)
  - official [`0x1124...189b`](https://sepolia.etherscan.io/tx/0x1124815a81bc13e5f05c7d6685962f3ab20e5156151b77f8dec40cf23fdb189b), mdcp [`0x3ea4...4fd6`](https://sepolia.etherscan.io/tx/0x3ea4f8f66fa24af26690f8fc9f29b1077c84b09bbeefc36140934d7165204fd6)

Totals across the four operations: **315,502 -> 222,138 tokens (1.42x less),
363s -> 158s (2.3x faster)**.

Two structural observations the averages hide:

- **mdcp's cost is flat across operations** — 54.7k / 55.1k / 56.0k / 56.4k
  tokens whether the task is a read or a live swap. The official arm swings
  60k–86k because each operation means re-deriving its own executor. Flat cost
  is what makes an integration predictable enough to budget.
- **The approval gate ran live on both mdcp swaps** (plan -> operator resume ->
  broadcast) — the safety feature was on during the benchmark. The official arm
  has no enforced gate; its AskUserQuestion checkpoint was a code comment.

The full transaction trail, including earlier API-built transactions (a WRAP
and a WETH->USDC sell), is public on the
[burner address](https://sepolia.etherscan.io/address/0xEEb84a3a4B4930311dD7385c10559Bd309944b3f).
Every request carried `x-agent-info: {"integration_name":"mdcp"}`.

### Level 2, second bot: index-bot (3-leg basket)

The same skill-vs-skill design applied to a second strategy. `index-bot` ported
the same way — **20 lines of 158**, delegation target only. Task: spend 300 USDC
equally across WETH, WBTC and LINK through the Trading API, on fresh mainnet
forks, one agent per arm.

Both arms built the basket. Both spent exactly 300 USDC, three CLASSIC routes:

- agent tokens: official 179,979 → mdcp 64,126 (**2.81x less**)
- wall clock: 738s → 67s (**11.0x faster**)
- tool invocations: 35 → 7; Bash commands 22 → 4

This is the widest gap we measured, and it is not because the basket is bigger —
it is because **the official arm had to solve a protocol problem first**. Both
arms hit the same wall: the Trading API signs a Permit2 permit whose nonce is
read from live mainnet, so on a fork the second permit-consuming swap reverts
with an undecoded `0x2c4029e9` (Permit2 `InvalidNonce`, selector `0x756688fe`).

The official agent got there unaided — it decoded the selectors by hand, found
the skill's Legacy approval path, and rewrote its script — spending 12 minutes,
three failed diagnostic runs and 180k tokens to do it. That work is real and we
credit it: it is what told us the workaround exists, and it corrected an
overstated claim in our own [FEEDBACK.md](./FEEDBACK.md).

But it is also work **every agent repeats from scratch, every session**, because
it lives in a transcript rather than in a gateway. We fixed it once in
`tradingApi.ts` (standing Permit2 allowance instead of a per-swap signature) and
no mdcp agent will ever pay for it again. That is the whole argument of this
project in one measurement: the official arm's 180k tokens bought a lesson that
evaporates; ours bought a commit.

Caveat: the two arms did not do identical work here. The official arm's number
includes the diagnosis; a rerun against a warm, already-solved script would be
far cheaper. We report it because it is what a real first encounter costs.

### Level 2: both arms on the production Trading API, execution on forks

The strongest comparison: both arms use Uniswap's real Trading API — the path
`swap-integration` actually prescribes (`check_approval` -> `quote` -> permit
signature -> `swap`) — with live routing and calldata, executed against fresh
mainnet forks. Zero deviations from the skill's documented flow on either side.

**DCA 50 USDC -> WETH via Trading API** (both landed CLASSIC swaps, both spent
exactly 50 USDC):

- agent tokens: official 114,967 -> mdcp 63,467 (**1.81x less**)
- wall clock: 193s -> 65s (**3.0x faster**)
- tool invocations: 23 -> 7

The official arm's cost went *up* versus its on-chain round (114,967 vs 86,339
tokens): the API path needs more of `swap-integration` read and debugged — it
also hit the documented-vs-actual `routingPreference: CLASSIC` mismatch (the
live API rejects the value the skill lists) and burned two failed script runs
on it. The mdcp arm's cost stayed flat, because the API flow lives inside the
gateway's `apiSwap` and none of that complexity reaches the agent.

Harness note: our first mdcp run of this round failed deterministically — an
earlier smoke test had consumed the fork's Permit2 nonce, while the API builds
permits against live mainnet state. Fresh fork, same prompt: success. Recorded
because level-2 benchmarking has exactly this contamination hazard.

### Level 1: both arms on the on-chain path

The official arm gets the verbatim files from `Uniswap/uniswap-ai@5338d6e`
(copied under `skills/uniswap-official/`), full Bash, and viem — it works the
way Claude Code actually works, including writing and running its own scripts.
The mdcp arm gets `skills/mdcp-port/` — the same `dca-bot` strategy prompt with
**only the delegation target changed** (12 of 126 lines; diff them yourself):
`swap-integration` + `viem-integration` are replaced by `mdcp-execute`.

Two rounds, opposite directions:

**Buy round — DCA 50 USDC → WETH** (both received 0.019843182371195533 WETH):

- agent tokens: official 86,339 → mdcp 62,281 (**1.39x less**)
- wall clock: 195s → 107s (**1.8x faster**)
- tool invocations: 18 → 8

**Sell round — take-profit 0.01 WETH → USDC** (both received 25.172382 USDC):

- agent tokens: official 76,802 → mdcp 63,166 (**1.22x less**)
- wall clock: 109s → 71s (**1.5x faster**)
- tool invocations: 13 → 6

### Why the improvement happens

Not because the strategy prompt is better — it is deliberately the same prompt.
Three mechanical reasons, visible in the transcripts:

1. **The execution layer an agent must read is 16.6x smaller.** Official:
   `swap-integration` (62,499 bytes) + `viem-integration` (7,618) = 70,117 bytes
   of instructions. mdcp: `mdcp-execute` = 4,219 bytes. The official arm spent
   its first ~90 seconds reading documentation.
2. **The official arm must author its own executor.** Following the skills, it
   wrote a ~10KB viem script (`bench/skill-arm/run-sell.ts`) — client setup,
   ABIs, quoting, approval, receipt handling — before doing anything. The mdcp
   arm expressed the same strategy as a ~20-line program, because clients,
   routing, signing and idempotency already live in the gateway.
3. **Approval is one round-trip regardless of transaction count.** The plan
   (approve + swap) comes back as one list, approved by one `resume`.

And one reason that is *not* about efficiency: the official skill's safety rests
on the agent choosing to follow `execution-model.md` — the script it writes has
the private key in scope and nothing enforcing the guardrails. In the mdcp arm
the key never enters the sandbox and the approval gate is code, not prompt text.
Same task, same outcome, structurally different guarantees.

### Caveats, honestly

- **N=1 per direction.** Agent behavior varies between runs; we trust the
  direction of the effect and the mechanism, not any ratio's second digit.
- **The official arm used the on-chain path, not the Trading API** (the harness
  has no interactive login; CONTEXT.md documented the deviation, flow order and
  guardrails preserved). With a live key we measured a single Trading API
  `/quote` response at **2,907 chars** — ~15x larger than the on-chain quote
  results our tools return — so the API path would have *added* context weight
  to the official arm, not removed it.
- Both arms were told a human had pre-authorized this run, since subagents are
  non-interactive. The official skill's `AskUserQuestion` gate was therefore
  noted-but-skipped; mdcp's plan-approval gate actually executed (execute →
  plan → resume).

## 2. Where the round-trip effect lives (microbenchmarks)

Same eleven capabilities on both sides (`app/src/tools.ts`), reached two ways:
one MCP-style tool per call vs. one program. This isolates interaction shape
from implementation differences — it is *our* code on both sides.

- DCA, 1 leg: 9 → 4 round-trips; context processed 1.7x less
- Copy-trade, 3 mirrors: 12 → 4; 8.4x less
- Index basket, 5 legs: 16 → 2; 6.3x less

The pattern: the per-tool loop's cost grows with strategy size, the program's
does not (flat at 2–4), and an agent re-reads its transcript every turn, so the
gap compounds quadratically.

A fourth scenario (scanning 20 fee tiers, 44 → 3) is **excluded from claims**:
it forced the baseline to do routing work the real Trading API performs
server-side in one call. We keep the logs (`app/bench/logs/s3-venue/`) because
the sandbox-side filtering is still illustrative, but it is not a fair
comparison against the official skill and we do not cite it as one.

## 3. The Graph: official Subgraph MCP vs the same server behind execute()

**Both arms use The Graph's own `subgraph-mcp` server, unmodified** (graphops,
Apache-2.0, built from source), serving every query live from the Graph
gateway — so the upstream implementation is held constant by construction. The baseline agent
calls its 9 tools the conventional way — one round-trip per call. The mdcp
agent reaches the *same server* through one `execute()` program; mdcp connects
to it as an MCP client and re-exposes its tools inside the sandbox
(`app/src/graphUpstream.ts`). Nothing of The Graph's is forked or
reimplemented — the only variable is interaction shape.

Task: WETH/USDC venue comparison across Uniswap V3, SushiSwap and Curve via
their Messari standardized subgraphs — live discovery of subgraph IDs, latest
financials, top WETH∩USDC pool per protocol, ranking. Both arms: Claude
Sonnet, empty context, identical prompt, run in parallel. Both produced
substantively identical answers (same subgraphs, same pools, same ranking) —
and both independently flagged the corrupted protocol-level TVL figures.

- agent tokens: baseline 73,240 → mdcp 63,169 (**1.16x less**)
- wall clock: 193s → 119s (**1.6x faster**)
- tool invocations: 19 → 3
- tool payload through the transcript: 162,069 bytes → 10,329 bytes
  (**15.7x less**); 39,611 bytes of searches, retries and pool lists ran
  inside the sandbox and never reached the model

Where the baseline's context went: three GraphQL schema fetches were 112,996
bytes — **69% of its transcript payload is SDL** read once and mostly unused —
plus ~13 KB of raw top-50 pool rows per protocol filtered in-context, plus
three empty searches paid at full round-trip price. The mdcp program skipped
schema fetches entirely (the standardized Messari schema is the point of
standardization), probed unhealthy subgraphs and filtered pools in code, and
returned only the aggregates. Full logs, both verbatim agent answers, and the
detailed write-up: `app/bench/logs/s5-graph/`.

### The gap grows with task size

One data point proves nothing about scaling, so the same experiment was rerun
with the task widened from 3 targets to **10** (4 protocols × 6 chains, all on
the one Messari schema — which is what makes a single query pattern reusable
across them):

- agent tokens: 95,481 → 71,004 (**1.34x**, up from 1.16x)
- wall clock: 479s → 154s (**3.1x**, up from 1.6x)
- agent tool invocations: 43 → 5 (mdcp calls crossing the boundary: 42 → 1;
  the rest are the agent writing its program file)
- transcript payload: 242,174 B → 9,670 B (**25.0x**, up from 15.7x)

Every ratio grew. The mdcp arm is close to flat across the two sizes (63.2k →
71.0k tokens for 3.3x the work; its transcript payload *shrank*, because this
task needed no schema fetches), while the baseline's grows with N. Both arms
again produced equivalent rankings and both independently caught the two data
traps — PancakeSwap's snapshot being 41 days stale, and Curve's top pool
reporting ~10^24 in cumulative volume. Logs and answers:
`app/bench/logs/s7-graph-scale10/`.

A deterministic sweep (`app/bench/graph-sweep.ts`, no model in the loop, same
live gateway, N = 1…10) isolates the mechanical component of that trend:

    N            1      2      3      4      6      8     10
    baseline  14.8k  25.8k  35.6k  50.5k  61.2k  71.6k  97.4k   transcript tokens
    mdcp       0.46k  0.56k  0.65k  0.74k  0.80k  0.87k  1.06k
    ratio       36x   106x   197x   315x   615x   943x  1238x   processed context

Transcript payload grows ~linearly for the per-tool shape and stays flat for
code mode (92x apart at N=10). Cumulative *processed* context — an agent
re-reads its whole transcript every turn — grows quadratically in boundary
crossings, so 4N crossings versus 1 diverge to three orders of magnitude. That
last row is a cost model, not a measurement: the measured agent ratios are the
1.16x and 1.34x above, which are diluted by the fixed system prompt and the
identical deliverable both arms must write. Data, charts and caveats:
`app/bench/logs/s6-graph-sweep/` (`chart.html` is slide-ready).

## 4. Hedera HTS: the official skill's own eval scenario, live on testnet

**Scope of the Hedera rounds (§4–§6).** Hedera ships two official AI surfaces:
the `hedera-skills` SKILL.md suite and the `mirrornode-mcp-server`. We
integrated both and measured both, and all results are reported here — §4 and
§5 against the skills, §6 against the MCP server. Two of the three rounds show
no improvement.

Every write in these rounds is a real consensus-node transaction on live
testnet: HTS and HCS are native services, so there is no fork to run them on.
Raw data: `app/bench/logs/hedera-skill-arms.json` (agent arms),
`hedera-probe.jsonl`, `hedera-mdcp.jsonl`, `mirror-sweep-result.json`.

The official artifact is `hedera-token-service` from `hedera-dev/hedera-skills`
(vendored verbatim at `8b1fccd` under `skills/hedera-official/`): 24,098 bytes
of Hiero-SDK instruction an agent must carry to execute — client setup, the
configure -> freeze -> sign -> execute -> receipt lifecycle, multi-party
association signatures, signed transfer legs that must net to zero. The mdcp
port replaces all of it with eight `hts.*` capabilities on the gateway, at
4,676 bytes — but the port declares `mdcp-execute` (4,219) as a prerequisite,
so the honest surface comparison counts both: **24,098 -> 8,895 bytes, 2.7x
smaller**. (Unlike the Uniswap rounds there is no separate strategy skill held
constant across arms: here the official SKILL.md *is* the execution layer, so
the whole surface is in scope on both sides.)

The scenario is not ours: it is **eval id 0 from the official skill's own
`evals/spec.json`** — create fungible token "GameGold" (GG, 8 decimals, 1M
supply), then transfer 500 to another account. As one mdcp program that is:
createToken -> createAccount (no auto-association slots, so the association
step is real) -> associate -> transfer, plus a balance view.

Deterministic probe (`app/bench/hedera-probe.ts`), two runs, 12 logged calls:

- round-trips to the model: **1 execute + 1 resume** (the approval gate),
  carrying 999 bytes of tool output in total
- all 4 writes SUCCESS on live testnet, 0.9-1.5s each (Hedera's ~3s finality
  absorbed host-side; the model never waits on consensus)
- planning pass surfaced the full 4-transaction plan before any HBAR moved —
  including stub ids (`0.0.0-planned`) for entities that exist only after
  approval, which is what `planStub` was added for
- verify on-chain: token [0.0.10521350](https://hashscan.io/testnet/token/0.0.10521350),
  recipient 0.0.10521351 holds exactly 500 GG, treasury 999,500 GG
  (first run: token 0.0.10521303 / recipient 0.0.10521304, identical result)

Two mechanics ported from the EVM layer needed Hedera-specific treatment,
both documented in `app/src/tools.ts`: receipt-derived ids (tokenId,
accountId) are excluded from intent identity for the same reason
`amountOutMinimum` is, and recipient keys generated by `hts.createAccount`
live in a host-side keystore so association can be signed without key
material ever entering the sandbox. Raw log:
`app/bench/logs/hedera-probe.jsonl`.

### Skill vs skill, one round — and mdcp does not win this one

Same methodology as the Uniswap rounds: two fresh Sonnet agents, empty
context, identical task prompt, run in parallel on live testnet. One gets
`skills/hedera-official/` verbatim, the other `skills/mdcp-port/`. Both
produced **byte-identical on-chain outcomes** — GameGold, 8 decimals,
1,000,000 supply, recipient holding exactly 500 GG — so this compares two
equally-successful runs.

- agent tokens: official 71,296 -> mdcp 66,348 (**1.07x less** — a wash)
- wall clock: official 88.6s -> mdcp 186.8s (**mdcp 2.1x SLOWER**)
- tool invocations: 12 -> 14 (mdcp used *more*)
- executor authored by the agent: **106 lines / 4,132 bytes -> 0**
- on-chain writes: official 3 -> mdcp 4 (mdcp did *more* chain work)

Official arm: token [0.0.10521431](https://hashscan.io/testnet/token/0.0.10521431)
-> 0.0.10521432. mdcp arm: token
[0.0.10521424](https://hashscan.io/testnet/token/0.0.10521424) -> 0.0.10521425.

**Why the Uniswap result did not transfer.** The Uniswap advantage came from
the official arm drowning: 70,117 bytes of execution instructions, a
self-authored ~10KB viem executor, and a documented-vs-actual API mismatch
that cost it two failed runs. None of that exists here. Hedera's skill is
11.5KB, accurate, and well written — the official agent read it once, wrote a
correct 106-line script, and ran it successfully on the first attempt. There
was no waste for mdcp to remove. When the baseline is good, a gateway that
saves reading and debugging saves little.

Where mdcp's time went: gateway work totalled **22.1s** across both boundary
calls (execute 59ms planning, resume 7.6s covering all four writes); the
remaining ~165s was the agent reading two skill files and composing the
program, including shell-quoting a multi-line TypeScript program onto a
command line. The official agent's model time was roughly half that. The
two-step `execute` -> `resume` approval gate also costs a round-trip the
official arm never pays, because the official skill has no enforced gate.

What survives as a real gain is structural, not efficiency: the agent
authored **zero** lines of executor (vs 106), only **999 bytes** of tool
output entered model context across 2 round-trips, the private key never
entered the sandbox, and the 4-transaction plan was approved as one unit
before any HBAR moved. The official arm's script had the operator key in
scope with nothing enforcing a guardrail.

Caveat, loudly: **N=1**, and this round ran a single task. A 2.1x wall-clock
regression on one sample is a signal to investigate (program-quoting
ergonomics are the obvious suspect), not a settled measurement. The
honest summary today is: on this task mdcp is cost-neutral, slower, and
structurally safer.

## 5. Two Hedera services, one catalog

§4 tested one service and found mdcp cost-neutral and slower. executor.sh's
headline (1,640 tools ≈ 278,800 tokens -> 1 tool ≈ 1,044) is a *catalog-scaling*
claim, which predicts the advantage grows with the number of systems joined.
This round tests that prediction inside Hedera, by adding HCS (consensus
topics) to the catalog and giving the task a cross-service join.

Task: create an HCS audit topic, mint 500 GG into an existing HTS token, write
a JSON audit event recording the new total supply, read the topic back. The
official arm must read **two** skills (`hedera-token-service` 24,098 +
`hedera-consensus-service` 18,417 = 42,515 bytes) and reconcile them in one
script; the mdcp arm reads **one** self-contained catalog skill (6,599 bytes,
11 capabilities across both services). Same model, empty context, parallel.

Both arms produced equivalent on-chain outcomes — one topic each, one +500 GG
mint each, one audit event each, read back and verified:

- agent tokens: official 69,336 -> mdcp 65,172 (**1.06x less** — a wash)
- wall clock: 90.7s -> 179.3s (**mdcp 2.0x SLOWER**)
- tool invocations: 10 -> 10 (tie)
- executor authored by the agent: **181 lines -> 25**
- skill surface to read: **42,515 -> 6,599 bytes (6.4x)**

Official arm: topic [0.0.10521689](https://hashscan.io/testnet/topic/0.0.10521689).
mdcp arm: topic [0.0.10521684](https://hashscan.io/testnet/topic/0.0.10521684).
Both minted into token 0.0.10521642 (supply 100,050 -> 100,100 -> 100,150
billion raw; each arm's reported total reflects whichever mint had landed
first, which is sequencing, not disagreement).

**Composition did not change the answer.** Against §4's single-service round:
tokens 1.07x -> 1.06x, wall clock 2.11x slower -> 1.98x slower. Two
independent tasks, two services vs one, and the result is the same to within
noise. The ~2x wall-clock regression is therefore **reproducible, not
variance** — which is what a single N=1 round could not establish.

### Why — and it is arithmetic, not opinion

The catalog claim does not bite at our scale. Measured with
`bench/catalog-size.ts` (log: `app/bench/logs/catalog-size.json`), what a
per-tool MCP server would put in context versus
what `execute` ships:

- 24 tools (Hedera arm): 7,074 -> 3,397 bytes (2.1x)
- 33 tools (Hedera + Graph): 9,263 -> 4,247 bytes (2.2x)

The entire tool catalog is ~7KB, roughly 1,800 tokens. Deleting it outright
would save under 3% of a 65,000-token agent run. executor.sh's 99.6% figure
assumes **1,640** tools; we are two orders of magnitude below the scale where
their mechanism produces a visible saving, and adding a second service moved
the catalog by 2KB. No amount of composition at this scale can show up in agent
tokens, because agent tokens are dominated by reading instructions and
reasoning, not by tool schemas.

What composition *does* scale is the artifacts: the skill surface ratio went
2.7x -> 6.4x by adding one service, and the code the agent had to author went
from 181 lines to 25. The official arm's 181 lines are the tell — client setup,
key parsing, mirror-node URL construction, a `sleep()` helper to poll around
consensus lag, and base64-decoding topic messages by hand. All of that is
per-service work the catalog absorbs once.

Against `hedera-skills`, then, mdcp's measurable effect is on what the
developer reads and writes, not on what the agent spends. The ~2x wall-clock
cost is real and is the price of the approval gate (`execute` -> review ->
`resume` is a round-trip the official skill never pays, because it has no
enforced gate).

## 6. Hedera's mirror-node MCP server

§4 and §5 measured mdcp against `hedera-skills` and found a wash, because those
SKILL.md files tell the agent to **write and run a Hiero SDK script** — already
code-mode, leaving a code-mode gateway nothing to remove.

Hedera's second official AI surface has the opposite shape:
[hedera-dev/mirrornode-mcp-server](https://github.com/hedera-dev/mirrornode-mcp-server)
generates **one MCP tool per mirror-node GET endpoint** straight from the
OpenAPI spec — 43 tools, one model round-trip per call, full JSON Schema
catalog resident in context. Structurally this matches The Graph's
subgraph-mcp (§3).

Both arms use Hedera's own tool definitions, unmodified, served live from
testnet. Task: an operator portfolio + audit review — account state, tokens
held, token metadata, holder list, consensus-topic audit trail, and recent
transactions bucketed by type. Six endpoints, the kind of question the mirror
node exists to answer.

Deterministic (`app/bench/mirror-sweep.ts`) — no agents, so no model variance,
and every tool is a GET so the whole benchmark costs zero HBAR:

- **payload into model context: 47,766 bytes -> 434 bytes (110x less)**
- model round-trips: 6 -> 1
- 47,332 bytes absorbed in the sandbox — holder lists, raw transaction records,
  and base64 topic messages that were filtered, decoded and aggregated in code
- **catalog surface: 36,968 bytes -> 7,932 bytes (4.7x)** — what a client holds
  just to *have* the tools, before any work: 43 JSON Schemas plus descriptions
  versus one `execute` tool carrying compact TS signatures

This is the largest payload ratio measured in this repo — larger than The
Graph's 15.7x — because mirror-node responses are big by design (an account
carries up to 1,000 token balances) and the useful answer is an aggregate.

Note the catalog ratio, 4.7x, is far below executor.sh's 99.6%: 43 tools is
still two orders of magnitude short of their 1,640. The payload ratio is where
the win lives at this scale, and it comes from *where the filtering happens*,
not from schema elision.

### Two upstream defects found while wiring this up

Both reproduced with the repo's own pinned dependencies:

1. **A clean clone does not start.** `fastmcp` pulls `zod-to-json-schema`,
   which imports the `zod/v3` subpath; the repo pins `zod@3.24.2`, which
   predates it. Pinning `zod-to-json-schema@3.24.1` gets past it.
2. **Its SSE endpoint answers HTTP 500 "Error creating server"** on every
   connection — so the 43 tools it defines are unreachable as shipped. We
   therefore served the upstream's own `openApiZod.ts` definitions over stdio
   (`stdioServer.mjs`, same GET-only conversion as their `mcpServer.js`);
   upstream files were not modified. The tools, schemas and descriptions
   measured above are theirs verbatim — only the transport is ours.

### Caveats

- **Deterministic, not agent-driven.** This isolates interaction shape; it does
  not measure agent tokens or wall clock, so it is not comparable to §1's
  end-to-end numbers. Timings shown in the raw result are host-side only.
- The per-tool arm is the *faithful* cost of calling these tools one at a time,
  which is what an MCP client does — but no agent ran, so nothing here says
  what a model would have spent reasoning between calls.
- Raw result: `app/bench/logs/mirror-sweep-result.json`. Reproduce with
  `bash bench/arm-mirror.sh` (see the script header for starting the upstream).

## Five bugs the benchmark caught in our own design

1. Intent hashes over volatile fields (slippage bounds) made a resumed run
   re-broadcast an already-landed swap — double-spend. Fixed: economic fields
   only.
2. The planning pass executed local state writes, so a strategy read back its
   own dry run and skipped the real buy. Fixed: planning is side-effect free.
3. Three identical-size copy-trade mirrors collapsed into one intent — 75 USDC
   of intent, 25 executed. Fixed: occurrence index in the intent identity.
   Found by the benchmark agent itself, which noticed three identical tx hashes.
4. A **read** about an entity the plan had not created yet killed the whole
   planning pass. Views are side-effect free, so planning runs them for real —
   but `hcs.messages` on a topic whose id was still `0.0.0-planned` hit the
   mirror node, got a 400, and no plan came back at all. Fixed: the sandbox
   tracks which values it invented, and a view whose arguments depend on one
   returns its declared shape instead of calling out.
5. Bug 1 again, in a new service. `hcs.submitMessage`'s intent hash covered the
   message body — and audit messages embed ids minted earlier in the same
   program, which are stubs while planning and real after approval. Every
   intent would have changed between plan and resume, so nothing would match
   the approved set and the whole pipeline would bounce back for re-approval.
   Fixed the same way: identity is the tool plus its occurrence index, and the
   operator still reviews the full message text in the plan. The lesson
   generalizes — *any* field that can contain a value the plan invented is
   unsafe to hash.

## Reproducing

```bash
cd app
anvil --fork-url $MAINNET_RPC_URL --port 8545 --silent   # official arm
anvil --fork-url $MAINNET_RPC_URL --port 8546 --silent   # mdcp arm
# fund both wallets (bench notes), then give one agent skills/uniswap-official/
# and the other skills/mdcp-port/, same task prompt. Raw logs: app/bench/logs/.
```
