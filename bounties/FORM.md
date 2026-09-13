# ETHGlobal form — paste-ready text

Plain text, already within the field limits. Copy each block verbatim.

---

## Short description (max 100 chars)

executor.sh for DeFi: agents run code next to the chain instead of tool calls through their context

`99 characters.`

Alternates:

- `The execution layer for DeFi agents: code runs next to the chain, only the answer reaches the model` (99)
- `Tool calls are too slow and too expensive to trade on. mdcp runs the agent's code next to the chain` (99)
- `Agents that trade can't afford tool calls. mdcp runs their code next to the chain. 11x faster.` (94)

---

## Description (min 280 chars)

Agentic finance breaks on cost, not on ideas. An agent that trades runs a loop forever, and every turn of that loop pays twice: tokens, because the whole transcript is re-read, and seconds, because every step is a round-trip through the model. Spot a move, spend seven seconds acting on it, and you do not have a trading agent.

executor.sh made the general argument: give a model one sandbox, not a hundred tools. mdcp is that argument built for DeFi, where the loop never stops and the payload is money.

The agent writes one small program. It runs in a sandbox sitting next to the chain, with Uniswap, The Graph and Hedera already mounted. The loop happens there. Quotes it rejected, pools it checked, balances it only needed for a comparison — none of it reaches the model. Only the answer does.

Measured against each protocol's own official agent tooling: up to 2.8x fewer tokens, up to 11x faster, 15-25x less data crossing into context. Against Hedera's MCP server, 47,766 bytes became 434. The gap widens with the task — triple the work and our side stays flat while the conventional one triples.

And because the program is code, the safety is code. Keys never enter the sandbox. The whole strategy is planned before anything is signed, and the operator approves the plan once rather than leg by leg. "Ask the user first" written in a prompt is not a control, and money needs a guarantee the model cannot talk its way around.

DeFi needs a standard for how agents touch it. This is a proposal for what it should be.

---

## How it's made (min 280 chars)

TypeScript MCP server (@modelcontextprotocol/sdk) over stdio. The sandbox wraps @executor-js/runtime-quickjs (MIT, from executor.sh) — QuickJS compiled to WebAssembly, so the agent's program has no network, no filesystem and no environment, and its only exit is a host-controlled bridge. On top of that general runtime we added what a chain gateway needs and a code runner does not: a policy gate on every call leaving the sandbox, keyed on a declared side-effect class (view / local / chain) that is data on the tool rather than prompt text; a planning pass that runs the whole strategy without broadcasting and returns one reviewable transaction plan, so the operator approves once instead of per leg; and transaction-intent idempotency hashed over economic fields plus an occurrence index, so a resumed run re-quotes at live prices but never sends the same transaction twice.

Chain access is viem, against mainnet forks and live Sepolia. Routing and calldata come from Uniswap's production Trading API (check_approval → quote → swap, with x-agent-info attribution), signed host-side — the private key never enters the sandbox, and signing only happens for an intent that appears in an approved plan. Hedera uses the Hiero SDK, with recipient keys in a host keystore so a token association can be signed without key material reaching the program.

Two of the three integrations are generic MCP-upstream adapters: mdcp connects to another MCP server as a client, discovers its tools at runtime, converts their JSON Schema into compact TypeScript signatures, and re-exposes them inside the sandbox. The Graph's subgraph-mcp and Hedera's mirrornode-mcp-server are both mounted that way, unmodified — which is also what makes the benchmark fair, since both arms drive the same upstream binary. Upstream failures come back as values rather than thrown exceptions, so a program sweeping ten subgraphs survives the two that are dead on the network.

The hacky-but-load-bearing part: benchmarking is instrumented at the call level. Every invocation logs argument bytes, result bytes, duration, and whether it crossed the model boundary, and both interaction shapes are served from one capability registry (app/src/tools.ts) by two thin servers — mcp-mdcp.ts and mcp-baseline.ts — so the only difference between arms is the interaction shape, not the implementation. That instrumentation caught two double-spend bugs in our own idempotency design, and one case where the planning pass wrote local state and a DCA strategy read back its own dry run.

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

Measured with: mdcp is infrastructure for AI agents, so every benchmark is an AI run. Each result in BENCHMARK.md is a fresh Claude Code agent handed one task and one of two tool surfaces — the protocol's own official skills or MCP server on one side, mdcp on the other — with no knowledge of the other arm. Agent tokens, wall clock, tool invocations and transcript payload bytes are recorded per run, and both agents' verbatim answers plus the raw logs ship in the repo, including the rounds where mdcp lost.
