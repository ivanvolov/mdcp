# ETHGlobal form — paste-ready text

Plain text, already within the field limits. Copy each block verbatim.

---

## Short description (max 100 chars)

A faster MCP standard for DeFi agents — far more token-efficient, and far faster in execution

---

## Description (min 280 chars)

Agentic finance today is agentic in name only. Almost everything that ships is a script — a strategy hard-coded in advance, with no model anywhere near the decision. Not because nobody wants autonomous agents, but because the standard way to give a model access to a chain, MCP, costs too many tokens and too much time per action to survive a loop.

And an agent that trades is a loop that never ends. It runs 24/7, so every cost inside it compounds: an inefficiency that looks trivial on a single call is your entire AI bill by the end of the month, and the strategy stops paying for itself long before it stops working.

Time is the harder wall. With today's official trading skills, getting from "make this trade" to a signed transaction averages around 5 seconds, and it is the good case. Worse, it degrades with complexity: the moment a strategy is more than a couple of calls, every intermediate result stays in the context window, the window grows, and each next step — including the trivial ones — takes longer than the last. We measured exactly that on Uniswap.

Use skills from more than one vendor together and it compounds again. Each brings its own tens of kilobytes of instructions and its own payloads into the same context, so running two protocols together costs more than running each apart.

For agents to actually operate in DeFi, a complex strategy has to execute in under a second and stay flat as it grows. That is the target mdcp is built against. Measured against the protocols' own official agent tooling, it cuts what reaches the model by 10x to 100x and wall-clock time by 1.5x to 11x — and, more importantly, the cost stops scaling with the strategy: triple the work and our side stays roughly flat.

The mechanism is code mode. Instead of calling tools one at a time, the agent writes one small program, and it runs in a sandbox sitting next to the chain with Uniswap, The Graph and Hedera already mounted. The loop happens there. Only the answer comes back. And because it is code, the safety is code too: keys never enter the sandbox, and the whole strategy is planned and approved once before anything is signed.

DeFi needs its own standard for how agents touch it. This is a proposal for what it should be.

---

## How it's made (min 280 chars)

A TypeScript MCP server over stdio (@modelcontextprotocol/sdk). It exposes three tools — execute, resume, skills — and every chain capability lives behind them.

Programs run in QuickJS compiled to WebAssembly. The runtime itself is an off-the-shelf npm dependency (@executor-js/runtime-quickjs, MIT) used as published; everything that turns it into a chain gateway is ours. Inside it a program gets no network, no filesystem, no environment and no reach into our process. Its only exit is a host-controlled bridge, so every call leaving the sandbox is a checkpoint we own.

What we built on top is the part a general code runner does not have:

- A policy gate keyed on a declared side-effect class — view / local / chain. It is data on the tool rather than an instruction in a prompt, so it holds regardless of what the model decides to do. Only chain is gated.
- Plan, then approve once. The first execute runs the whole strategy to completion without broadcasting anything and returns a single transaction plan. The operator approves the plan rather than each leg, so approval cost does not grow with the number of legs. On resume the program re-runs against live state, so a quote taken before the human answered is recomputed instead of replayed stale.
- Transaction-intent idempotency. Each chain write is hashed over its economic fields only — token, direction, amount — plus an occurrence index, so re-quoting does not change an intent's identity and a transaction that already landed replays from a ledger instead of being sent again.

Chain access is viem, against anvil mainnet forks and live Sepolia. Uniswap runs through the production Trading API (check_approval to quote to swap, with x-agent-info attribution), signed host-side: the key never enters the sandbox and only ever signs an intent from an approved plan. Hedera uses the Hiero SDK for HTS and HCS on testnet, with recipient keys in a host keystore so a token association can be signed without key material reaching the program.

Two integrations are generic MCP-upstream adapters. mdcp connects to another MCP server as a client, discovers its tools at runtime, converts their JSON Schema into compact TypeScript signatures and re-exposes them inside the sandbox. The Graph's subgraph-mcp and Hedera's 43-tool mirrornode-mcp-server are both mounted that way, unmodified. Upstream failures come back as values rather than thrown exceptions, so a program sweeping ten subgraphs still returns for the ones that answer.

Measurement is built in rather than bolted on: both interaction shapes are served from one capability registry by two thin servers, so the only thing that differs between arms is the shape, never the implementation, and every invocation logs argument bytes, result bytes, duration and whether it crossed the model boundary. That instrumentation caught two bugs in our own idempotency design that would have re-sent a transaction.

A reviewer can mount one protocol at a time with MDCP_PROFILE=uniswap|graph|hedera|all. All together it is 76 capabilities behind 3 MCP tools and 13KB of always-loaded description.

---

## Tech multiselects

These are dropdowns — pick the closest matching options the form offers.

**Ethereum developer tools:** viem · Foundry (anvil mainnet forks for both benchmark arms) · Alchemy (RPC) · The Graph. Not Hardhat, not Truffle, not Remix — no contracts were written.

**Blockchain networks:** Ethereum (mainnet state via fork) · Ethereum Sepolia (the live transaction trail) · Hedera (testnet — HTS/HCS). Also, read-only through The Graph: Arbitrum, Base, Optimism, Polygon, BNB Chain. Select those five only if you want completeness; execution happens on Sepolia and Hedera testnet.

**Programming languages:** TypeScript (everything) · JavaScript (sandbox programs, benchmark scripts) · Bash (benchmark arms, the `./mdcp` entrypoint) · HTML/CSS (the site). No Solidity.

**Web frameworks:** none. The site is one hand-written static HTML file with one inline script. Pick "None"/"N/A" if offered, otherwise leave blank.

**Databases:** none. Benchmark evidence is append-only JSONL on disk; the intent ledger is in-process. Pick "None"/"N/A" if offered, otherwise leave blank.

**Design tools:** none. Hand-written CSS.

**Other technologies (free multiselect — type and enter):**

Model Context Protocol (MCP), @modelcontextprotocol/sdk, QuickJS, WebAssembly, @executor-js/runtime-quickjs (executor.sh), Uniswap Trading API, Permit2, Uniswap v3, Hiero SDK, Hedera Token Service (HTS), Hedera Consensus Service (HCS), Hedera mirrornode-mcp-server, The Graph subgraph-mcp, Messari subgraph standard, GraphQL, Zod, tsx, Claude Code

---

## Describe how AI tools were used

Two ways, and the second one is the project.

Built with: Claude Code (Claude Opus) wrote most of the TypeScript under a normal review loop — I set the architecture and the invariants, read the diffs, and the benchmark harness caught what slipped through: two double-spend bugs in the transaction-intent idempotency design, and a planning pass that wrote local state so a DCA strategy read back its own dry run. The three sponsor integrations were built in parallel Claude Code sessions coordinating through the repo. Docs and the landing page were drafted the same way.

Measured with: mdcp is infrastructure for AI agents, so every benchmark is an AI run. Each result in BENCHMARK.md is a fresh Claude Code agent handed one task and one of two tool surfaces — the protocol's own official skills or MCP server on one side, mdcp on the other — with no knowledge of the other arm. Agent tokens, wall clock, tool invocations and transcript payload bytes are recorded per run, and both agents' verbatim answers plus the raw logs ship in the repo, so every ratio can be recomputed from the evidence rather than taken on trust.

---

# Partner prizes

Three prizes selected: Hedera, The Graph, Uniswap Foundation. Each needs a
one-or-two-sentence "why applicable", one code link, an ease rating 1-10, and
(for two of them) sponsor feedback. Links are pinned to commit `3f06235` so the
line numbers stay correct no matter what lands later.

## Hedera — $15,000

**Why you're applicable:**

mdcp puts Hedera's own services behind a code-mode agent interface: HTS and HCS
are driven natively through the Hiero SDK on testnet, and Hedera's own
`mirrornode-mcp-server` is mounted unmodified as an upstream so its 43 tools run
inside the sandbox instead of in the model's context. Benchmarked against
Hedera's own official artifacts rather than a strawman: on a six-endpoint
portfolio-and-audit review the conventional shape pulls 47,766 bytes across 6
round-trips, through mdcp it is 434 bytes in 1, and on a combined
HTS-plus-HCS task the agent wrote 25 lines instead of 181 because one catalog
covers both services. Live testnet trail: token 0.0.10521642, topic 0.0.10521641.

**Link to the line of code:**

https://github.com/ivanvolov/mdcp/blob/3f06235/app/src/hedera.ts#L170-L260

(native HTS + HCS writes through the Hiero SDK — token create, mint, associate,
topic create, message submit. The mirror-node MCP upstream adapter is
https://github.com/ivanvolov/mdcp/blob/3f06235/app/src/hederaUpstream.ts#L123-L158 )

**How easy is the API / protocol? — 6**

The Hiero SDK itself is closer to a 9: one fluent transaction builder per
service, receipts carry exactly what you need, automatic chunking on HCS
messages over 1KB. The 6 is entirely the MCP server, below.

**Additional feedback:**

The Hiero SDK is the good part — the transaction builders are consistent across
HTS and HCS, receipts return the ids you actually need, and messages over 1KB
chunk themselves so a caller never handles it. Two things cost us real time.

First, `hedera-dev/mirrornode-mcp-server` does not start from a clean clone:
`fastmcp` pulls `zod-to-json-schema`, which imports the `zod/v3` subpath, while
the repo pins `zod@3.24.2`, which predates that subpath. Second, once running,
its SSE endpoint answers HTTP 500 "Error creating server" on every connection —
reproduced with the repo's own pinned dependencies — so the 43 tools it defines
are unreachable as shipped. We worked around it by serving the server's own
`openApiZod.ts` definitions over stdio, leaving its files untouched, but a
first-time integrator will read that 500 as their own mistake. A pinned
lockfile and a smoke test in CI would close both.

Smaller: the official agent suite splits HTS and HCS into separate skills, so
any task spanning tokens and consensus means reading two documents (42,515
bytes together) and hand-writing the reconciliation. One combined catalog would
help agents more than two thorough ones. And the ~3s mirror-node lag after a
write is real and correct, but it is not stated anywhere near the write path —
an agent that reads back immediately gets a 404 and concludes its transaction
failed.

## The Graph — $15,000

**Why you're applicable:**

We mounted The Graph's own `subgraph-mcp` server (graphops, Apache-2.0)
completely unmodified inside mdcp's sandbox — mdcp connects as an MCP client,
discovers its 9 tools at runtime and re-exposes them as `graph.*`, so the same
server and the same live gateway data run in both interaction shapes and the
only variable is the shape. On a cross-protocol venue comparison built on
Messari Standardized Subgraphs — one query pattern reused across 4 protocols on
6 chains — that took 43 tool invocations down to 5 and 242KB of transcript
payload down to 9.7KB at N=10, with schema SDL alone accounting for 69% of the
baseline's context.

**Link to the line of code:**

https://github.com/ivanvolov/mdcp/blob/3f06235/app/src/graphUpstream.ts#L108-L136

**How easy is the API / protocol? — 8**

`subgraph-mcp` started clean, spoke standard MCP, and needed nothing but a
Studio key. The two points off are the schema-discovery cost and the
data-quality traps below.

**Additional feedback:**

`subgraph-mcp` was the easiest of the three upstreams to integrate — it started
from a clean clone, spoke plain MCP, and both the local binary and the hosted
SSE bridge worked. The standardized Messari schema is the thing that actually
pays: because the schema is shared and known, a program never has to fetch one,
and in our measurements schema SDL was 69% of the baseline arm's entire context
payload. That is a strong argument for standardization that we do not think is
being made loudly enough in the docs.

Two pieces of feedback. First, schema discovery is priced like a read but
behaves like a download — for an agent, fetching an SDL is often more expensive
than the query it enables. A way to ask "is this subgraph on a known standard,
and which version" without pulling the SDL would cut a large fraction of agent
context spend outright.

Second, freshness is invisible at the point of use. Two of our agents
independently flagged PancakeSwap's BSC snapshot as roughly 41 days stale, which
made its top volume rank an artifact rather than a fact; another had to reason
about a Curve pool reporting cumulative volume on the order of 10^24. Both are
knowable from the data, but only if you think to look. A last-indexed-block or
staleness field surfaced in the MCP response — rather than requiring a separate
status query — would let a program quarantine bad rows instead of ranking them.

## Uniswap Foundation — $5,000

**Why you're applicable:**

The Trading API is mdcp's Uniswap execution path — `check_approval` to `quote`
to a Permit2 EIP-712 signature to `swap`, signed and broadcast host-side with
`x-agent-info` attribution on every request — and we tested it by porting
Uniswap's own `uniswap-ai` skills onto the gateway by changing only the
delegation target (12 lines of 126 in `dca-bot`), then running fresh agents on
identical tasks. Live on Sepolia through the production API: 1.42x fewer tokens
and 2.3x faster across four operations; 2.81x fewer tokens and 11x faster on a
3-leg index basket. The detailed developer feedback is in FEEDBACK.md, including
two claims we withdrew after verifying them.

**Link to the line of code:**

https://github.com/ivanvolov/mdcp/blob/3f06235/app/src/tradingApi.ts#L154-L200

(check_approval to quote to Permit2 signature to /swap; the `x-agent-info`
header with `integration_name: "mdcp"` is at
https://github.com/ivanvolov/mdcp/blob/3f06235/app/src/tradingApi.ts#L103-L105 )

**How easy is the API / protocol? — 5**

Routing and quoting are excellent and the request shapes are clear. The 5 is
the gap between a quote and a confirmed transaction: there is no official
executor, Permit2 signing is specified for request shape but not for the act of
signing, and the documented Legacy approval path does not work as written. All
reproduced in FEEDBACK.md.

(If the form has a feedback box here too, the short version is: an official
executor package or one blessed pattern; Permit2 errors decoded into the /swap
response; one sentence saying the Permit2 nonce comes from live mainnet; a
corrected Legacy snippet; and published token budgets per skill.
https://github.com/ivanvolov/mdcp/blob/main/FEEDBACK.md )
