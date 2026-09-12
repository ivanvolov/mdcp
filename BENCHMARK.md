# Benchmark: per-tool agent loop vs. code mode

We claim that driving DeFi through one sandboxed program is cheaper than driving
it through one tool call per step. This is the evidence, including the places
where the claim is weaker than the pitch.

## Setup

Both arms run the *same code*. `app/src/tools.ts` is a single capability
registry; only the way an agent reaches it differs:

- **baseline** — nine separate capabilities, one call per step. This is the shape
  the Uniswap AI trading skills prescribe (`check_approval` → `quote` → `swap`,
  each its own step) and the shape nearly every MCP server ships today.
- **mdcp** — one `execute` capability taking a TypeScript program. The loop over
  quotes, allowances, approvals and swaps runs inside a QuickJS sandbox.

Each arm had its own `anvil` fork of Ethereum mainnet — real liquidity, real
routing, real transactions — starting from identical state (allowance 0, funded
wallet, empty strategy state). Both were driven by the same model (Claude Sonnet)
with information-equivalent instructions, running as parallel background agents.
Every call is logged to `app/bench/logs/`.

mdcp runs with its **approval gate on**: no transaction is broadcast until the
operator approves. The baseline has no such gate — it just fires. So mdcp pays
for a safety feature the control arm does not have, and still wins.

## Scenario 2 (headline) — five-asset index basket

*"Spend 250 USDC, 50 into each of WETH, WBTC, DAI, LINK and UNI, each on its own
fee tier, 0.5% slippage, record the legs."* Six transactions: one approval, five
swaps.

|                                    | baseline | mdcp   | ratio         |
| ---------------------------------- | -------- | ------ | ------------- |
| model round-trips                  | 16       | 2      | **8x fewer**  |
| wall clock                         | 144.5s   | 64.2s  | **2.25x faster** |
| task context processed (tokens)    | 10,554   | 1,845  | **5.7x less** |
| chain operations                   | 16       | 25     | —             |
| operations hidden inside sandbox   | 0        | 25     | —             |
| bytes kept out of the transcript   | 0        | 5,736  | —             |
| total agent tokens                 | 62,779   | 61,124 | 1.03x         |

Both arms produced the same basket and equivalent strategy state.

## Scenario 1 — single DCA buy

*"Buy 50 USDC of WETH, once per UTC day, 0.5% slippage, record it."*

| | baseline | mdcp | ratio |
| --- | --- | --- | --- |
| model round-trips | 9 | 3 | 3x fewer |
| wall clock | 72.5s | 59.6s | 1.22x faster |
| total agent tokens | 57,429 | 59,626 | 0.96x (mdcp worse) |

## Reading these numbers honestly

**Total agent tokens barely move, and in scenario 1 mdcp is worse.** That number
is dominated by the harness: a Claude Code subagent carries a large fixed system
prompt that swamps a task this size. It is the wrong denominator for this
question, but we report it because we measured it. The task-specific figure —
"context processed", derived from the actual logged payloads and turn structure —
is where the 5.7x lives.

**On raw payload bytes mdcp is consistently worse** (0.65x in scenario 2): a
program source is larger than any single small JSON result. The win is not
per-message size. It is that an agent re-sends its whole transcript every turn,
so cost grows with the square of the number of steps. Two turns beat sixteen
turns even when each turn carries more.

**The gap widens with strategy complexity** — this is the real finding:

| strategy size | baseline round-trips | mdcp round-trips |
| --- | --- | --- |
| 1 leg (DCA)   | 9  | 2* |
| 5 legs (index)| 16 | 2  |

The baseline grows with the number of legs. mdcp does not: the program loops
internally, and the operator approves the whole transaction plan in one step.
Extrapolating the baseline's own shape, a twenty-asset rebalance is ~46
round-trips against the same 2.

\* Scenario 1 was measured at 3 before we added batch planning; the same task
costs 2 under the current design.

**mdcp performs *more* chain operations, not fewer** (25 vs 16). A resumed
program re-runs from the top so it re-reads live state rather than acting on
stale quotes, and replays already-broadcast transactions from an intent ledger
instead of re-sending them. More RPC calls, zero duplicate transactions. RPC
reads are cheap; model turns and double-spends are not.

## Two bugs this benchmark found in our own design

Both are documented in the code because they are the interesting part:

1. **Intent hashing over volatile fields double-spends.** The first version
   hashed the whole argument set, including `amountOutMinimum`. After a swap
   landed, the pool price moved, the next run derived a different slippage bound,
   the ledger did not recognise the intent as already executed, and it tried to
   swap again. Intent identity now covers only economic fields.

2. **A planning pass with side effects poisons the real run.** Local state writes
   executed during planning, so the DCA strategy read back its own dry run and
   concluded it had already bought today. Planning is now fully side-effect free.

## Reproducing

```bash
cd app
anvil --fork-url $MAINNET_RPC_URL --port 8545 --silent   # baseline arm
anvil --fork-url $MAINNET_RPC_URL --port 8546 --silent   # mdcp arm
# fund both wallets with USDC, then drive each arm's CLI:
./bench/arm-baseline.sh uniswap.quote '{"tokenIn":"USDC","tokenOut":"WETH","amountIn":"50000000"}'
./bench/arm-mdcp.sh execute 'const q = await tools["uniswap.quote"]({...}); return q;'
npx tsx bench/analyze.ts
```

Raw logs for both scenarios are committed under `app/bench/logs/`.
