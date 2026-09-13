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
