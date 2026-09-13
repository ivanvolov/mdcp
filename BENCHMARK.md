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
