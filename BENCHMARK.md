# Benchmark: per-tool agent loop vs. code mode

We are claiming that driving DeFi through one sandboxed program is cheaper than
driving it through one tool call per step. This document is the evidence, and it
includes the places where the claim is weaker than the pitch.

## Setup

Both arms are the *same code*. `app/src/tools.ts` is a single capability
registry; the only thing that differs is how an agent reaches it:

- **baseline** — nine separate capabilities, one call per step. This is the shape
  the Uniswap AI trading skills prescribe (`check_approval` → `quote` → `swap`,
  each its own step) and the shape almost every MCP server ships today.
- **mdcp** — one `execute` capability that takes a TypeScript program. The loop
  between quote, allowance, approval and swap happens inside a QuickJS sandbox.

Both ran against their own `anvil` fork of Ethereum mainnet (real liquidity, real
routing, real transactions), from identical starting state: allowance 0, funded
wallet, empty strategy state. Both were driven by the same model (Claude Sonnet)
given information-equivalent instructions. Every call is logged to
`app/bench/logs/`.

Note that mdcp runs with its **approval gate on**: every chain write suspends the
program and needs an explicit resume. The baseline has no such gate — it just
fires the transaction. So mdcp is paying for a safety feature the control arm
does not have, and still wins. That is deliberate; we would rather under-claim.

## Scenario 1 — single DCA buy

*"Buy 50 USDC of WETH, once per UTC day, 0.5% slippage, record it."*

|                                   | baseline | mdcp | ratio |
| --------------------------------- | -------- | ---- | ----- |
| model round-trips                 | 9        | 3    | 3.0x  |
| chain operations performed        | 9        | 18   | —     |
| operations hidden inside sandbox  | 0        | 18   | —     |
| cumulative context tokens         | 3,844    | 1,963| 1.96x |
| payload bytes entering transcript | 1,394    | 1,856| 0.75x |

Both arms executed a real swap and produced identical strategy state.

**Read this honestly.** On raw payload bytes mdcp is *worse*: a program source is
larger than any single small JSON result. The win comes from round-trips, because
an agent re-sends its whole transcript every turn — so cost grows with the square
of the number of steps, not linearly. Three turns beat nine turns even when each
turn carries more.

The 18-vs-9 chain operations line is the approval design showing its cost: a
resumed program re-runs from the top, re-reading live chain state, and replays
already-broadcast transactions from the intent ledger instead of re-sending them.
More RPC calls, zero extra transactions.

## What this scenario does *not* show

This task is small: nine capabilities, tiny result payloads, one swap. It is the
honest floor of the claim, not the ceiling. Code mode pays off most when:

1. **The catalog is large.** Per-tool servers put every tool schema in the
   context window on every turn. Ours costs one `execute` description regardless
   of how many protocols are behind it.
2. **Results are large.** Filtering 200 pools down to one happens in the sandbox;
   only the answer crosses into the transcript.
3. **The strategy loops.** An index rebalance over N assets is ~4N round-trips in
   the baseline and still one program in mdcp.

Scenario 2 measures exactly that, because a 3x claim from a toy task is not worth
much on its own.

## Reproducing

```bash
cd app
anvil --fork-url $MAINNET_RPC_URL --port 8545 --silent    # baseline arm
anvil --fork-url $MAINNET_RPC_URL --port 8546 --silent    # mdcp arm
# fund both wallets with USDC (see bench/README), then drive each arm's CLI
npx tsx bench/analyze.ts
```
