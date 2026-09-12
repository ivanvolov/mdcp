# Benchmark: per-tool agent loop vs. code mode

We claim that driving DeFi through one sandboxed program is cheaper than driving
it through one tool call per step. This is the evidence, including where the
claim is weak.

## Setup

Both arms run the *same code*. `app/src/tools.ts` is a single capability
registry of eleven chain operations; only the way an agent reaches it differs:

- **baseline** — eleven separate capabilities, one call per step. This is the
  shape the Uniswap AI trading skills prescribe (`check_approval` → `quote` →
  `swap`, each its own step) and the shape nearly every MCP server ships today.
- **mdcp** — one `execute` capability taking a TypeScript program. Loops over
  quotes, pool tiers, leader trades and swaps run inside a QuickJS sandbox.

Each arm had its own `anvil` fork of Ethereum mainnet — real liquidity, real
routing, real transactions — from identical starting state. Both were driven by
the same model (Claude Sonnet) with information-equivalent instructions, running
as parallel background agents. Every call is logged under `app/bench/logs/`.

mdcp runs with its **approval gate on**: nothing is broadcast until the operator
approves the plan. The baseline has no such gate. mdcp pays for a safety feature
the control arm does not have, and still wins.

## Results across the skill surface

Four scenarios covering what the Uniswap trading skills actually do: a DCA bot,
an index bot, venue selection inside swap integration, and copy-trading.

**Round-trips** (calls crossing the model boundary — each costs a full inference):

- **DCA buy, 1 leg** — baseline 9 → mdcp 4 (2.25x fewer)
- **Index basket, 5 legs** — baseline 16 → mdcp 2 (8x fewer)
- **Venue scan, 20 fee tiers** — baseline 44 → mdcp 3 (14.7x fewer)
- **Copy-trade, 3 mirrors** — baseline 12 → mdcp 4 (3x fewer)

**Context tokens the provider actually processes** (every turn re-reads the
transcript so far, so this grows quadratically in a per-tool loop):

- DCA: 4,519 → 2,722 — **1.7x less**
- Index: 11,754 → 1,865 — **6.3x less**
- Venue scan: 71,207 → 1,942 — **36.7x less**
- Copy-trade: 31,298 → 3,724 — **8.4x less**

**Wall clock:** DCA 72s → 60s (1.2x). Index 144s → 64s (2.25x). Venue scan 544s
→ 328s (1.7x). Copy-trade 190s → 116s (1.6x).

**Total agent tokens:** DCA 57,429 → 59,626 (mdcp 4% *worse*). Index 62,779 →
61,124 (1.03x). Venue scan 77,532 → 70,231 (1.10x). Copy-trade 71,365 → 64,279
(1.11x).

**Chain operations mdcp ran inside the sandbox, invisible to the model:** 18, 25,
77 and 19 respectively.

## The actual finding

Not the ratio in any one row — the slope. As the strategy grows, the baseline's
cost grows with it and mdcp's does not:

| work | baseline round-trips | mdcp round-trips |
| --- | --- | --- |
| 1 leg    | 9  | 4 |
| 3 mirrors| 12 | 4 |
| 5 legs   | 16 | 2 |
| 20 tiers | 44 | 3 |

mdcp is flat at 2–4 regardless, because the loop is inside the program and the
operator approves the entire transaction plan in one step. The context-processed
ratio tells the same story more sharply: 1.7x → 6.3x → 8.4x → 36.7x.

The venue scan is the clearest case. Comparing twenty pool/quote pairs to choose
one route means twenty results the model must read and then discard. In mdcp the
scan happens in the sandbox and only the winner crosses back — 12,905 bytes of
scan data that never entered the transcript.

## Reading this honestly

**Total agent tokens barely move, and on the smallest task mdcp is worse.** That
number is dominated by the harness: a Claude Code subagent carries a large fixed
system prompt (~55k tokens) that swamps a small task. The effect only surfaces
once the task is big enough — which is exactly why it appears at 1.10x on the
venue scan and not at all on the DCA. We report it because we measured it.

**On payload bytes mdcp is often worse.** A program source is larger than a
single small JSON result. The win is not per-message size; it is turn count.

**This is N=1 per scenario.** Model tool-call counts vary between runs. We have
not measured variance, and we would not defend any single ratio to two decimal
places. The monotone trend across four scenarios of increasing size is the part
we stand behind.

**The baseline is our reimplementation**, not literally Uniswap's skills calling
the Trading API. The interaction *shape* follows their documented flow, but it is
our code on both sides — which is what makes it a controlled comparison rather
than a benchmark of two different implementations.

**Neither arm used real MCP transport**; both reach the same CLI, where one Bash
call equals one round-trip. This *understates* mdcp: with real MCP, the
baseline's eleven tool schemas sit in the system prompt every single turn while
mdcp's three do not, and that gap widens with every tool added to the catalog.

**One prompt was not symmetric.** In the copy-trade rerun we asked the mdcp agent
to verify its transaction hashes were distinct, which cost it an extra call. Its
4 would otherwise have been 2–3.

**mdcp performs more chain reads, not fewer.** A resumed program re-runs from the
top against live state instead of acting on quotes taken before the operator
decided. RPC reads are cheap; stale prices and double-spends are not.

## Three bugs this benchmark found in our own design

1. **Intent hashing over volatile fields double-spends.** The first version
   hashed the whole argument set including `amountOutMinimum`. After a swap
   landed the pool price moved, the next run derived a different slippage bound,
   the ledger did not recognise the intent as already executed, and it swapped
   again. Intent identity now covers only economic fields.

2. **A planning pass with side effects poisons the real run.** Local state writes
   executed during planning, so a DCA strategy read back its own dry run and
   concluded it had already bought that day. Planning is now side-effect free.

3. **Legitimate repeats collapsed into one transaction.** Mirroring three leader
   trades at a fixed 25 USDC produces three swaps with byte-identical economic
   fields. Keyed on those alone they deduped to one: the plan showed a single
   transaction and two of three mirrors silently never happened — 75 USDC of
   intent, 25 USDC executed. Intent identity now includes the occurrence index
   within the execution. Verified on-chain: both arms now spend exactly 75 USDC
   and produce three distinct transaction hashes.

The third was caught by the benchmark agent itself, which noticed all three
mirrors reporting the same hash and flagged it unprompted.

## Reproducing

```bash
cd app
anvil --fork-url $MAINNET_RPC_URL --port 8545 --silent   # baseline arm
anvil --fork-url $MAINNET_RPC_URL --port 8546 --silent   # mdcp arm
# fund both wallets with USDC, then drive each arm:
./bench/arm-baseline.sh uniswap.quote '{"tokenIn":"USDC","tokenOut":"WETH","amountIn":"50000000"}'
./bench/arm-mdcp.sh execute 'const q = await tools["uniswap.quote"]({...}); return q;'
npx tsx bench/summarize.ts
```

Raw logs for all four scenarios are committed under `app/bench/logs/`.
