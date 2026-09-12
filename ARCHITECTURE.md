# How mdcp works

## The problem

An AI agent using a normal MCP server calls one tool per step. Ask it to build a
five-asset index and it makes sixteen separate calls, each one a full round-trip:
the model emits a call, waits, receives JSON, and re-reads the entire
conversation so far before deciding the next step. The intermediate data — pool
depths, quotes it rejected, balances it only needed for a comparison — all lands
permanently in its context.

That is wasteful for any domain. For DeFi it is also unsafe, because the
approval story is usually "the instructions tell the model to ask first", which
is not a guarantee — and in a scheduled run there is nobody to ask.

## The shape

mdcp exposes **three** tools no matter how many chain capabilities sit behind
them:

- `execute(code)` — run a TypeScript program against the connected integrations
- `resume(executionId, approve)` — approve a suspended program's transaction plan
- `skills(topic)` — read the calling convention, policy model, or signing model

The agent writes a program. The loop lives in the program.

## The sandbox, concretely

The program runs in **QuickJS compiled to WebAssembly** — a small JavaScript
engine embedded inside our Node process. We use
[`@executor-js/runtime-quickjs`](https://www.npmjs.com/package/@executor-js/runtime-quickjs)
(MIT, by Rhys Sullivan of executor.sh) rather than writing our own; the code-mode
runtime is solved, and our contribution is the chain-specific layer on top.

What matters about that sandbox:

- **It has no ambient authority.** No network, no filesystem, no environment
  variables, no access to our process memory. A program cannot open a socket or
  read a private key, because those capabilities do not exist inside it.
- **The only way out is a bridge we control.** `tools["uniswap.swap"](...)`
  is not a function inside the sandbox; it is a message to the host. The host
  looks up the capability, applies policy, runs it, and passes back a value.
  Every crossing is a checkpoint we own.
- **It is bounded.** Execution has a timeout and a memory ceiling, so a runaway
  loop costs a failed call rather than a hung server.

So "sandbox" here means: the model's code runs *next to the chain* instead of
*in the conversation*, and it runs somewhere that cannot do anything we did not
hand it.

## What we added for crypto

A general code-mode runtime is not enough to let an agent move money. Four
additions:

### 1. Policy from the side-effect class

Every capability declares what it does: `view` (reads), `local` (writes a
strategy state file), `chain` (moves funds). Only `chain` is gated. That
classification is data on the tool, not a prompt instruction, so it holds
regardless of what the model decides to do.

### 2. Plan first, approve once

The first `execute` does **not** broadcast anything. It runs the whole program to
completion in a *planning pass*, recording every transaction the strategy intends
to make and handing them back as one list:

```json
{ "status": "awaiting_approval",
  "approval": { "executionId": "cf0ccdba",
    "plan": [ { "tool": "token.approve", "args": {...}, "intentHash": "7206..." },
              { "tool": "uniswap.swap",  "args": {...}, "intentHash": "e792..." } ] } }
```

The operator reviews the whole strategy and approves once. This is both better
UX than signing transaction-by-transaction and the reason approval cost does not
grow with the number of legs in a strategy.

The planning pass must be perfectly side-effect free — we learned this when local
state writes executed during planning and a DCA strategy read back its own dry
run and concluded it had already bought that day.

### 3. Transaction-intent idempotency

Each chain write gets an **intent hash** covering only its *economic* fields —
which token, which direction, how much. Slippage bounds and deadlines are
excluded on purpose, because they are re-derived from fresh quotes on every run.

An early version hashed the whole argument set. After a swap landed, the pool
price moved, the next run computed a different `amountOutMinimum`, the ledger
failed to recognise the intent as already executed, and it swapped a second time.
Intent identity is now stable across re-quoting, and an already-broadcast
transaction replays from the ledger instead of being sent again.

### 4. Re-read on resume, never replay stale prices

When an operator approves, the program runs again from the top against **live**
chain state rather than continuing from a frozen snapshot. Quotes taken before
the human went to lunch are recomputed; transactions already broadcast are not
repeated. If the fresh run produces a transaction that was not in the approved
plan — because the strategy took a different branch against newer data — it is
not executed silently; it goes back for approval.

This costs more RPC reads than a per-tool loop. RPC reads are cheap. Acting on a
stale quote is not.

## Where the key lives

The private key never enters the sandbox. Signing happens in the host, and only
for an intent that appears in an approved plan. A program can *ask* for a swap;
it cannot produce a signature.

## Layout

```
app/src/
  chain.ts        viem clients, Uniswap v3 quoting/routing/pool reads
  tools.ts        the capability registry — one source of truth, shared by both servers
  sandbox.ts      QuickJS bridge, policy gate, planning pass, intent ledger
  mcp-mdcp.ts     the three-tool MCP server
  mcp-baseline.ts the same capabilities as conventional one-tool-per-call MCP
app/bench/        the measurement harness and raw logs
```

`mcp-baseline.ts` exists so the comparison in [BENCHMARK.md](./BENCHMARK.md) runs
the *same code* on both sides; only the interaction shape differs.
