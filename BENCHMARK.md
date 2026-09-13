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

The cleanest-controlled experiment in this repo: **both arms use The Graph's
own `subgraph-mcp` server, unmodified** (graphops, Apache-2.0, built from
source), serving every query live from the Graph gateway. The baseline agent
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

Where the baseline's context went: three GraphQL schema fetches were 112,810
bytes — **70% of its transcript payload is SDL** read once and mostly unused —
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
- tool invocations: 43 → 5
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

Fourth surface, second ecosystem, and the only all-level-3 one: HTS is a
native Hedera service, so there is no fork to run it on — every write here is
a real consensus-node transaction on live testnet.

The official artifact is `hedera-token-service` from `hedera-dev/hedera-skills`
(vendored verbatim at `8b1fccd` under `skills/hedera-official/`): 24,098 bytes
of Hiero-SDK instruction an agent must carry to execute — client setup, the
configure -> freeze -> sign -> execute -> receipt lifecycle, multi-party
association signatures, signed transfer legs that must net to zero. The mdcp
port (`skills/mdcp-port/hedera-token-service/`, 4,676 bytes, **5.2x smaller**)
replaces all of it with eight `hts.*` capabilities on the gateway.

The scenario is not ours: it is **eval id 0 from the official skill's own
`evals/spec.json`** — create fungible token "GameGold" (GG, 8 decimals, 1M
supply), then transfer 500 to another account. As one mdcp program that is:
createToken -> createAccount (no auto-association slots, so the association
step is real) -> associate -> transfer, plus a balance view.

Deterministic probe (`app/bench/hedera-probe.ts`), two runs, 12 logged calls:

- round-trips to the model: **1 execute + 1 resume** (the approval gate),
  against the 4-6 write/sign/receipt cycles the official skill has the agent
  script by hand
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
`app/bench/logs/hedera-probe.jsonl`. The model-driven skill-vs-skill arms
(official verbatim vs port, same prompt) are the planned extension.

## Three bugs the benchmark caught in our own design

1. Intent hashes over volatile fields (slippage bounds) made a resumed run
   re-broadcast an already-landed swap — double-spend. Fixed: economic fields
   only.
2. The planning pass executed local state writes, so a strategy read back its
   own dry run and skipped the real buy. Fixed: planning is side-effect free.
3. Three identical-size copy-trade mirrors collapsed into one intent — 75 USDC
   of intent, 25 executed. Fixed: occurrence index in the intent identity.
   Found by the benchmark agent itself, which noticed three identical tx hashes.

## Reproducing

```bash
cd app
anvil --fork-url $MAINNET_RPC_URL --port 8545 --silent   # official arm
anvil --fork-url $MAINNET_RPC_URL --port 8546 --silent   # mdcp arm
# fund both wallets (bench notes), then give one agent skills/uniswap-official/
# and the other skills/mdcp-port/, same task prompt. Raw logs: app/bench/logs/.
```
