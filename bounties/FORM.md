# ETHGlobal form — paste-ready text

Plain text, already within the field limits. Copy each block verbatim.

---

## Short description (max 100 chars)

One execute tool instead of 76 schemas: agents run DeFi programs in a sandbox next to the chain

`95 characters.`

Alternates, same length class, if you prefer a different emphasis:

- `Code-mode MCP gateway for DeFi: agents write one program, it runs sandboxed next to the chain` (93)
- `One execute tool, not 76 schemas. Uniswap, The Graph and Hedera in one sandboxed code-mode gateway` (98)

---

## Description (min 280 chars)

Agentic finance does not work yet, and the reason is boring: the plumbing is too expensive.

An agent that trades is not an agent that answers one question. It runs constantly — watching, re-quoting, rebalancing, reacting. Every one of those turns pays the same tax twice. It pays tokens, because every protocol hands the model tens of kilobytes of instructions and every tool result gets dragged through the transcript and re-read on the next turn. And it pays seconds, because every step is a round-trip through the model. A cost you pay once is a rounding error. A cost you pay on every loop compounds until the strategy is not worth running.

The time is what actually kills it. If you spot a move and it takes seven seconds of model round-trips to act on it, you do not have a trading agent. You have an expensive newsletter.

executor.sh made this argument for software in general: do not hand a model a hundred tool schemas, hand it one sandbox and let it write code. mdcp is that idea built for DeFi, where it matters most — because here the loop never stops and the payload is money.

One execute tool instead of seventy-six schemas. The agent writes a small program; it runs in a sandbox sitting next to the chain, with Uniswap, The Graph and Hedera already mounted. The loop happens there. Quotes it rejected, pools it checked, balances it only needed for a comparison — none of that ever reaches the model. Only the answer does.

That changes the economics instead of trimming them. Measured against each protocol's own official agent tooling: up to 2.8x fewer tokens, up to 11x faster, and 15-25x less data crossing into context — against Hedera's MCP server, 47,766 bytes became 434. The gap widens with the task: triple the work and our side stays roughly flat while the conventional one triples.

And because the program is code, the safety is code. Keys never enter the sandbox. A strategy is planned in full before anything is signed, and the operator approves the whole plan once rather than leg by leg. "Ask the user first" written in a prompt is not a control. Agentic finance needs its guarantees enforced somewhere the model cannot talk its way around.

DeFi needs its own standard for how agents touch it. This is a proposal for what that should look like.

---

## How it's made (min 280 chars)

TypeScript MCP server (@modelcontextprotocol/sdk) over stdio. The sandbox wraps @executor-js/runtime-quickjs (MIT, from executor.sh) — QuickJS compiled to WebAssembly, so the agent's program has no network, no filesystem and no environment, and its only exit is a host-controlled bridge. On top of that general runtime we added what a chain gateway needs and a code runner does not: a policy gate on every call leaving the sandbox, keyed on a declared side-effect class (view / local / chain) that is data on the tool rather than prompt text; a planning pass that runs the whole strategy without broadcasting and returns one reviewable transaction plan, so the operator approves once instead of per leg; and transaction-intent idempotency hashed over economic fields plus an occurrence index, so a resumed run re-quotes at live prices but never sends the same transaction twice.

Chain access is viem, against mainnet forks and live Sepolia. Routing and calldata come from Uniswap's production Trading API (check_approval → quote → swap, with x-agent-info attribution), signed host-side — the private key never enters the sandbox, and signing only happens for an intent that appears in an approved plan. Hedera uses the Hiero SDK, with recipient keys in a host keystore so a token association can be signed without key material reaching the program.

Two of the three integrations are generic MCP-upstream adapters: mdcp connects to another MCP server as a client, discovers its tools at runtime, converts their JSON Schema into compact TypeScript signatures, and re-exposes them inside the sandbox. The Graph's subgraph-mcp and Hedera's mirrornode-mcp-server are both mounted that way, unmodified — which is also what makes the benchmark fair, since both arms drive the same upstream binary. Upstream failures come back as values rather than thrown exceptions, so a program sweeping ten subgraphs survives the two that are dead on the network.

The hacky-but-load-bearing part: benchmarking is instrumented at the call level. Every invocation logs argument bytes, result bytes, duration, and whether it crossed the model boundary, and both interaction shapes are served from one capability registry (app/src/tools.ts) by two thin servers — mcp-mdcp.ts and mcp-baseline.ts — so the only difference between arms is the interaction shape, not the implementation. That instrumentation caught two double-spend bugs in our own idempotency design, and one case where the planning pass wrote local state and a DCA strategy read back its own dry run.
