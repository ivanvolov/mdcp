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

Agents talking to on-chain systems today burn most of their context on plumbing. Every protocol hands them tens of kilobytes of instructions and asks them to rebuild the same executor — clients, ABIs, signing, retries — from scratch, every session. Every tool call drags its full payload through the transcript, and the transcript is re-read on every turn.

mdcp is that plumbing written once. It exposes three tools — execute / resume / skills — and runs the agent's program in a QuickJS sandbox with the integrations already mounted. Loops, conditionals, retries and discarded intermediate data stay next to the chain instead of in the model's context. Private keys never enter the sandbox. Chain writes stop for operator approval as a code-enforced gate rather than a prompt instruction, and a resumed run replays already-landed transactions from an intent ledger instead of double-spending.

Three protocols sit behind that one surface: Uniswap (the production Trading API plus the on-chain v3 stack), The Graph (their official MCP server, unmodified), and Hedera (HTS/HCS through the Hiero SDK, plus their 43-tool mirror-node MCP server). Seventy-six capabilities behind three MCP tools and 13KB of always-loaded description — and a reviewer can mount one protocol at a time with MDCP_PROFILE=uniswap|graph|hedera|all.

We did not benchmark against a strawman. For Uniswap we took their own skill files verbatim and changed 12 lines of 126 — only the delegation target — then ran fresh agents on the same task, ending with real transactions on live Sepolia. For The Graph we mounted their own MCP server unmodified and ran the identical server against itself in both interaction shapes. For Hedera we measured both of their official AI surfaces and report both: against their SKILL.md suite there was no improvement, because those skills already tell the agent to write a script; against their per-tool MCP server the payload into context dropped from 47,766 bytes to 434. Every number in the repo ships with its raw logs and both agents' verbatim answers.

Repo: https://github.com/ivanvolov/mdcp (public). Run it: RUN.md. Site: https://ivanvolov.github.io/mdcp/

---

## How it's made (min 280 chars)

TypeScript MCP server (@modelcontextprotocol/sdk) over stdio. The sandbox wraps @executor-js/runtime-quickjs (MIT, from executor.sh) — QuickJS compiled to WebAssembly, so the agent's program has no network, no filesystem and no environment, and its only exit is a host-controlled bridge. On top of that general runtime we added what a chain gateway needs and a code runner does not: a policy gate on every call leaving the sandbox, keyed on a declared side-effect class (view / local / chain) that is data on the tool rather than prompt text; a planning pass that runs the whole strategy without broadcasting and returns one reviewable transaction plan, so the operator approves once instead of per leg; and transaction-intent idempotency hashed over economic fields plus an occurrence index, so a resumed run re-quotes at live prices but never sends the same transaction twice.

Chain access is viem, against mainnet forks and live Sepolia. Routing and calldata come from Uniswap's production Trading API (check_approval → quote → swap, with x-agent-info attribution), signed host-side — the private key never enters the sandbox, and signing only happens for an intent that appears in an approved plan. Hedera uses the Hiero SDK, with recipient keys in a host keystore so a token association can be signed without key material reaching the program.

Two of the three integrations are generic MCP-upstream adapters: mdcp connects to another MCP server as a client, discovers its tools at runtime, converts their JSON Schema into compact TypeScript signatures, and re-exposes them inside the sandbox. The Graph's subgraph-mcp and Hedera's mirrornode-mcp-server are both mounted that way, unmodified — which is also what makes the benchmark fair, since both arms drive the same upstream binary. Upstream failures come back as values rather than thrown exceptions, so a program sweeping ten subgraphs survives the two that are dead on the network.

The hacky-but-load-bearing part: benchmarking is instrumented at the call level. Every invocation logs argument bytes, result bytes, duration, and whether it crossed the model boundary, and both interaction shapes are served from one capability registry (app/src/tools.ts) by two thin servers — mcp-mdcp.ts and mcp-baseline.ts — so the only difference between arms is the interaction shape, not the implementation. That instrumentation caught two double-spend bugs in our own idempotency design, and one case where the planning pass wrote local state and a DCA strategy read back its own dry run.
