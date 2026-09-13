# mdcp — a code-mode MCP gateway for DeFi

**Agents shouldn't re-invent the hands of every protocol they touch.**

Uniswap's Trading API is a brain: it routes, quotes, and builds calldata. It has
no hands — nothing signs, broadcasts, waits for receipts, tracks allowances, or
stops a retry from spending twice. So the official Uniswap AI skills hand an
agent 70KB of instructions and ask it to build that executor itself, from
scratch, every session. Every other DeFi protocol does the same thing with its
own 70KB.

mdcp is the hands, written once: **one `execute` tool that runs a whole strategy
as a sandboxed program**, with signing, approval gating and replay protection
enforced in code rather than described in prose.

    ./mdcp execute 'const q = await tools["uniswap.apiQuote"]({tokenIn:"USDC", tokenOut:"WETH", amountIn:"25000000"});
                    if (BigInt(q.amountOut) < minAcceptable) return {skipped:"price"};
                    return await tools["uniswap.apiSwap"]({tokenIn:"USDC", tokenOut:"WETH", amountIn:"25000000"});'

One round-trip. The loop, the conditionals and the discarded intermediate data
stay next to the chain instead of in the model's context.

## Does it actually help?

We didn't benchmark mdcp against a strawman. We took Uniswap's **own** skill
files verbatim, ported the strategy skill to mdcp by changing **12 lines of
126** — only the delegation target — and gave fresh agents the same task.

    diff skills/uniswap-official/dca-bot/SKILL.md skills/mdcp-port/dca-bot/SKILL.md

The strategy prompt is identical. What changes is that `swap-integration` +
`viem-integration` (70,117 bytes of "here's how to build an executor") become
`mdcp-execute` (4,219 bytes of "here are the functions").

We then ran it at three levels of realism:

| level | chain | Uniswap API | result |
| --- | --- | --- | --- |
| 1 | mainnet fork | on-chain contracts | 1.2–1.4x fewer tokens, 1.5–1.8x faster |
| 2 | mainnet fork | production Trading API | 1.81x fewer tokens, 3.0x faster |
| 3 | **live Sepolia** | **production Trading API** | **1.42x fewer tokens, 2.3x faster** |

**Level 3 is the one that counts** — real public testnet, real API, a fresh
agent per operation, four transactions anyone can open on Etherscan:

- quote 25 USDC→WETH — 86,474 → 54,683 tokens, 47s → 21s
- wallet balances — 60,168 → 55,124 tokens, 62s → 31s
- swap 25 USDC→WETH — 85,794 → 55,965 tokens, 145s → 57s
  ([official](https://sepolia.etherscan.io/tx/0x868d375e517ba510c80d0479990ddef0a2b38d2e27a0d7b1e1afa93643bbd598) · [mdcp](https://sepolia.etherscan.io/tx/0xeb1b2c71c5dd6aeddf3069ce006e6549300645699091fe0a5f813a0d07d93a10))
- swap 0.002 WETH→USDC — 83,066 → 56,366 tokens, 109s → 49s
  ([official](https://sepolia.etherscan.io/tx/0x1124815a81bc13e5f05c7d6685962f3ab20e5156151b77f8dec40cf23fdb189b) · [mdcp](https://sepolia.etherscan.io/tx/0x3ea4f8f66fa24af26690f8fc9f29b1077c84b09bbeefc36140934d7165204fd6))

Two things the averages hide, and they matter more than the ratios:

**mdcp's cost is flat.** 54.7k / 55.1k / 56.0k / 56.4k tokens — whether the task
is a balance read or a live swap. The official skill swings 60k–86k because each
operation means re-deriving its own executor. Flat cost is what makes an
integration predictable enough to budget.

**The safety was switched on the whole time.** Both mdcp swaps went through the
approval gate live — plan returned, operator approved, then broadcast. The
official arm has no enforced gate at all; its `AskUserQuestion` checkpoint
exists only as prose the model may skip. We are faster *with* the seatbelt on.

Full methodology, caveats and raw logs: **[BENCHMARK.md](./BENCHMARK.md)**.

## What we had to build, that no protocol ships

These are the reusable primitives every DeFi agent needs and every protocol
leaves as an exercise — this is the case for a shared standard rather than N
per-protocol skill bundles:

- **an executor** — `check_approval → quote → Permit2 EIP-712 signature → swap →
  broadcast → receipt`. Verified absent upstream: the SDKs state they "do not
  execute trades or send transactions", and `@uniswap/client-trading` on npm is
  protobuf types with zero dependencies (and is referenced by neither the docs
  nor the skills).
- **balances, allowances, token metadata, block state** — the Trading API is a
  *trading* API; it has none of these. The official skill's answer is 7.6KB of
  instructions for writing your own viem client.
- **replay protection** — the API is stateless by design. Re-running a strategy
  whose first attempt already landed double-spends. Our intent ledger keys each
  transaction on its economic fields plus its occurrence index.
- **an approval gate that works headlessly** — a scheduled DCA run has no human
  to answer a prompt. Ours returns the whole transaction plan for one approval.

## Integrations

- **Uniswap** — production Trading API (executor above) plus the on-chain path
  (QuoterV2, SwapRouter02, v3 pool state, swap-log decoding for copy-trading).
  Every request carries `x-agent-info: {"integration_name":"mdcp"}`.
  Feedback for the Foundation: **[FEEDBACK.md](./FEEDBACK.md)** — claims verified
  against the live API, with a section for the ones that didn't survive checking.
- **The Graph** — the official `subgraph-mcp` server, unmodified, mounted
  *inside* the sandbox. Same binary in both arms of the benchmark; only the
  interaction shape differs. Cross-protocol venue comparison over Messari
  standardized subgraphs: 19 → 3 round-trips, 15.7x less tool payload in
  context (70% of the baseline's payload was schema SDL).
  See `app/bench/logs/s5-graph/RESULTS.md`.
- **Hedera** — HTS via the Hiero SDK on live testnet, mirror-node reads.

## How it works

The program runs in **QuickJS compiled to WebAssembly** — no network, no
filesystem, no environment access. The only way out is a host bridge we control,
where policy is applied and signing happens. Keys never enter the sandbox: a
program can *ask* for a swap, it cannot produce a signature.

Chain writes don't broadcast on the first call. The program runs to completion
in a **planning pass**, and every transaction it intends to make comes back as
one reviewable list. The operator approves once; the program then re-runs
against live state, replaying already-landed transactions from the ledger rather
than re-sending them.

Details, and why each piece exists: **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

We use [`@executor-js/runtime-quickjs`](https://www.npmjs.com/package/@executor-js/runtime-quickjs)
(MIT, by Rhys Sullivan / executor.sh) for the sandbox itself rather than writing
our own — code-mode execution is solved; the crypto layer on top is ours.

## Quickstart

```bash
cd app && npm install
cp .env.example .env     # RPC + UNISWAP_API_KEY (+ a throwaway testnet key)

# live Sepolia through the production Trading API
CHAIN_PROFILE=sepolia npx tsx bench/cli.ts execute \
  'return await tools["uniswap.apiQuote"]({tokenIn:"USDC",tokenOut:"WETH",amountIn:"25000000"});'

# as an MCP server (surface: execute / resume / skills)
npx tsx src/mcp-mdcp.ts
```

`src/mcp-baseline.ts` exposes the *same* 21 capabilities as conventional
one-tool-per-call MCP — that's the control arm, so the comparison runs identical
code on both sides.

## What the benchmark caught in our own design

Worth more than the ratios, because they're the failure modes this layer exists
to prevent — and all three were found by running it, not by reasoning about it:

1. **Intent hashes over volatile fields double-spend.** Hashing
   `amountOutMinimum` meant a re-quote after the price moved looked like a new
   transaction. A resumed run re-broadcast a swap that had already landed.
2. **A planning pass with side effects poisons the real run.** Local state
   writes executed during planning, so a DCA strategy read back its own dry run
   and concluded it had already bought that day.
3. **Legitimate repeats collapsed into one.** Three copy-trade mirrors at the
   same size deduped to a single intent — 75 USDC of intent, 25 USDC executed.
   Caught by the benchmark agent itself, which noticed three identical hashes.

## Honest limitations

- Benchmarks are N=1 per operation; we trust the direction and the mechanism,
  not the second decimal of any ratio.
- One scenario (a 20-fee-tier venue scan) is **excluded from all claims** — it
  forced the baseline to do routing the Trading API performs server-side.
- Skill-vs-skill coverage is `dca-bot`. `index-bot` and `copy-trade` are
  measured at the mechanism level only; `lp-integration`, x402 and the v4 SDK
  are not covered.
- UniswapX / Dutch-auction routing is out of scope — the gateway handles
  CLASSIC, WRAP and UNWRAP.

## AI attribution

Built with Claude Code (Claude Fable 5 / Opus 5) driving implementation under
human direction; all planning artifacts and prompts are in the repo
(`PLAN.md`, `skills/`, the benchmark agent prompts embedded in
`app/bench/logs/`). The human author set the architecture, chose the partner
integrations and the experiment design, rejected the first benchmark as unfair
to the baseline, and required every claim in `FEEDBACK.md` to be verified
against the live API before it was written down. Benchmark runs were executed by
Claude Sonnet subagents with empty context, on both arms equally.

## Docs

- [BENCHMARK.md](./BENCHMARK.md) — methodology, all three levels, raw logs
- [ARCHITECTURE.md](./ARCHITECTURE.md) — the sandbox, policy, planning, idempotency
- [FEEDBACK.md](./FEEDBACK.md) — feedback for the Uniswap Foundation
- [skills/](./skills/) — the official suite and our port, side by side
- [PRIZES.md](./PRIZES.md) — the event's prize information, captured locally
