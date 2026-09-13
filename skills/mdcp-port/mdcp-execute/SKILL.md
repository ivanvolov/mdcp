---
name: mdcp-execute
description: Execute Uniswap operations by writing one program that runs in a sandbox next to the chain. Use when a strategy skill needs to quote, approve, or swap. Replaces swap-integration and viem-integration.
license: MIT
metadata:
  author: mdcp
  version: '0.1.0'
---

# mdcp Execute

The single execution path. Strategy skills delegate here and never build quote,
approval, swap, or signing logic themselves.

## Calling convention

Send a TypeScript program. It runs in a QuickJS sandbox next to the chain:

```bash
mdcp execute '<program source>'
```

Inside the program each capability is an async function on `tools`. Use `await`,
loops and conditionals freely. `return` only the values the caller needs —
everything else stays in the sandbox and never enters the model's context.

```ts
const q = await tools["uniswap.quote"]({ tokenIn: "USDC", tokenOut: "WETH", amountIn: "50000000" });
const min = (BigInt(q.amountOut) * 995n / 1000n).toString();
const tx = await tools["uniswap.swap"]({ tokenIn: "USDC", tokenOut: "WETH", amountIn: "50000000", amountOutMinimum: min });
return { received: q.amountOut, txHash: tx.txHash };
```

## Capabilities

```
chain.block(): { number, timestamp, isoTime }                                        // view
token.info({ token }): { address, symbol, decimals }                                 // view
wallet.balances(): { address, native, tokens: Record<string,string> }                // view
uniswap.quote({ tokenIn, tokenOut, amountIn, fee? }): { amountOut, gasEstimate, fee } // view
uniswap.poolState({ tokenA, tokenB, fee }): { exists, pool, liquidity, tick }        // view
wallet.swapHistory({ address, blocks? }): { swaps: [...] }                           // view
token.allowance({ token, spender? }): { allowance, spender }                         // view
token.approve({ token, amount, spender? }): { txHash, status }                       // chain write
uniswap.swap({ tokenIn, tokenOut, amountIn, amountOutMinimum, fee? }): { txHash, status, gasUsed }  // chain write
state.read({ name }): unknown | null                                                 // view
state.write({ name, data }): { written: true }                                       // local write
```

Amounts are raw integer strings — USDC has 6 decimals, WETH 18. Symbols resolve
to addresses automatically. Routing is chosen by the gateway unless `fee` is
given.

## Approval

Chain writes are **not** broadcast on the first call. The program runs to
completion in a planning pass and returns every transaction it intends to make:

```json
{ "status": "awaiting_approval",
  "approval": { "executionId": "cf0ccdba",
    "plan": [ { "tool": "token.approve", "args": {...}, "intentHash": "7206..." },
              { "tool": "uniswap.swap",  "args": {...}, "intentHash": "e792..." } ] } }
```

The operator reviews the whole strategy and approves once:

```bash
mdcp resume '{"executionId":"cf0ccdba","approve":true}'
```

This is the same in an interactive session and in a scheduled run — there is no
prompt to answer, so a cron job works without a human present.

On approval the program re-runs against **live** chain state, so a quote that
went stale while the operator was deciding is recomputed. Transactions that
already landed replay from the intent ledger instead of being sent twice, and a
transaction that was not in the approved plan goes back for approval rather than
executing silently.

## Guarantees you do not have to implement

- **Keys never enter the sandbox.** Signing happens host-side and only for an
  intent in an approved plan. A program can ask for a swap; it cannot produce a
  signature.
- **Idempotency.** Each chain write is identified by its economic fields plus its
  occurrence index in the program, so re-running cannot double-spend and
  legitimate repeats (three mirrors at the same size) stay distinct.
- **No unlimited approvals.** `token.approve` takes an exact amount.
- **Errors come back as data**, not exceptions you must guess about.

## What this replaces

`swap-integration` and `viem-integration`. Do not set up clients, construct
router calldata, encode Permit2, or manage nonces — the gateway owns all of it.
