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

Links pinned to commit `3f06235` so line numbers stay correct.

**Note on the feedback fields:** in the form as it stands, only **Hedera** and
**The Graph** have an "Additional feedback for the Sponsor" box. **Uniswap does
not** — they collect it through their own Developer Feedback Form instead, so
the FEEDBACK.md link goes inside the Uniswap applicability answer.

---

## Hedera — $15,000

**Track:** Open Source — Improve the Hedera Harness.

**Why you're applicable:**

We built a new MCP standard for DeFi and used it two ways on Hedera. We mounted
Hedera's own 43-tool `mirrornode-mcp-server` **unmodified** inside the sandbox,
and we wrote one catalog covering HTS and HCS natively through the Hiero SDK on
testnet.

- mirror-node, 6-endpoint portfolio + audit review: **47,766 → 434 bytes into
  model context (110x), 6 → 1 round-trips**; catalog surface 36,968 → 7,932
  bytes (4.7x)
- HTS + HCS in one task: agent authored **181 → 25 lines**, because one 6.6KB
  catalog replaces two official skills totalling 42,515 bytes

Live testnet trail: token 0.0.10521642, topic 0.0.10521641. The operator key
never enters the sandbox, and the whole multi-transaction pipeline is planned
and approved as one unit before anything broadcasts — code-enforced, not a
prompt instruction.

**Link to the line of code:**

https://github.com/ivanvolov/mdcp/blob/3f06235/app/src/hedera.ts#L170-L260

(native HTS + HCS writes through the Hiero SDK. The mirror-node MCP upstream
adapter is
https://github.com/ivanvolov/mdcp/blob/3f06235/app/src/hederaUpstream.ts#L123-L158 )

**Ease of the API / protocol: 6**

The Hiero SDK alone is closer to a 9. The 6 is the MCP server, below.

**Additional feedback:**

The Hiero SDK is the good part — consistent transaction builders across HTS and
HCS, receipts return the ids you actually need, HCS messages over 1KB chunk
themselves.

`mirrornode-mcp-server` cost us real time twice, both reproduced with the
repo's own pinned dependencies. It does not start from a clean clone: `fastmcp`
pulls `zod-to-json-schema`, which imports the `zod/v3` subpath, while the repo
pins `zod@3.24.2`, which predates it. And once running, its SSE endpoint
answers HTTP 500 "Error creating server" on every connection, so the 43 tools
it defines are unreachable as shipped. We served its own `openApiZod.ts`
definitions over stdio instead and left its files untouched — but a first-time
integrator reads that 500 as their own mistake. A lockfile and a CI smoke test
close both.

Two smaller ones. The official agent suite splits HTS and HCS into separate
skills, so anything spanning tokens and consensus means reading two documents
(42,515 bytes) and hand-writing the reconciliation; one combined catalog helps
agents more than two thorough ones. And the ~3s mirror-node lag after a write
is correct behaviour but is not stated anywhere near the write path — an agent
that reads back immediately gets a 404 and concludes its transaction failed.

---

## The Graph — $15,000

**Track:** AI Tooling / AI Use Case (From Scratch), plus Composable or
Standardized Graph Products.

**Why you're applicable:**

We built a new MCP standard for DeFi and mounted The Graph's own `subgraph-mcp`
server inside it **unmodified** — mdcp connects as an MCP client, discovers its
9 tools at runtime, re-exposes them in the sandbox. Same server, same live
gateway data, both interaction shapes, so the only variable is the shape. Task:
one Messari-standard query pattern across 4 protocols on 6 chains.

- 10 targets: **43 → 5 tool calls, 242KB → 9.7KB transcript payload (25x),
  479s → 154s (3.1x), 95k → 71k tokens**
- 3 targets: 19 → 3 calls, 162KB → 10KB (15.7x)

Every ratio grows with task size while our side stays near-flat — 63k → 71k
tokens for 3.3x the work. Schema SDL alone was **69% of the baseline's entire
context payload**, which is the standardized schema paying for itself.

**Link to the line of code:**

https://github.com/ivanvolov/mdcp/blob/3f06235/app/src/graphUpstream.ts#L108-L136

**Ease of the API / protocol: 8**

**Additional feedback:**

`subgraph-mcp` was the easiest of our three upstreams — clean clone, plain MCP,
both the local binary and the hosted SSE bridge worked. Two things would help
agents specifically.

Schema discovery is priced like a read but behaves like a download: fetching an
SDL is often more expensive than the query it enables. In our runs schema SDL
was 69% of the baseline arm's whole context payload. A way to ask "is this
subgraph on a known standard, and which version" without pulling the SDL would
cut a large share of agent context spend outright.

Freshness is invisible at the point of use. Two of our agents independently
flagged PancakeSwap's BSC snapshot as ~41 days stale, which makes its top
volume rank an artifact rather than a fact. It is knowable, but only if you
think to look. A last-indexed-block or staleness field in the MCP response,
instead of a separate status query, would let a program quarantine bad rows
before ranking them.

---

## Uniswap Foundation — $5,000

**Track:** Best Uniswap Stack Contribution (Classic / From Scratch).

**Why you're applicable:**

We built a new MCP standard for DeFi — one `execute` tool, the agent's program
runs in a sandbox next to the chain — and ran Uniswap's own `uniswap-ai` skills
on it, changing only the delegation target (12 lines of 126 in `dca-bot`). Same
task, same Trading API, fresh agent each side:

- index-bot, 3-leg basket: **180k → 64k tokens (2.81x), 738s → 67s (11.0x)**
- dca-bot on the Trading API: **115k → 63k tokens (1.81x), 193s → 65s (3.0x)**
- live Sepolia swap: **86k → 56k tokens, 145s → 57s (2.5x)**, four public txs

Our side stays flat at ~55-64k tokens whether the task is a balance read or a
3-leg basket; the official arm swings 60k-180k because it rewrites its own
executor every session. Trading API integration is `check_approval` → `quote` →
Permit2 → `swap`, signed host-side, `x-agent-info: integration_name "mdcp"` on
every request. Detailed developer feedback, including two claims we withdrew
after verifying them: https://github.com/ivanvolov/mdcp/blob/main/FEEDBACK.md

**Link to the line of code:**

https://github.com/ivanvolov/mdcp/blob/3f06235/app/src/tradingApi.ts#L154-L200

**Ease of the API / protocol: 5**

Routing and quoting are excellent. The 5 is the gap between a quote and a
confirmed transaction: no official executor, Permit2 signing specified for
request shape but never for the act of signing, and a documented Legacy
approval path that reverts as written. All reproduced in FEEDBACK.md.
