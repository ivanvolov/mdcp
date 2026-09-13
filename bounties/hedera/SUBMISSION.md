# Submission form — Hedera-specific answers

The general fields (project name, tagline, description, how it's made) are
shared across all three partner picks and live in
`bounties/the-graph/SUBMISSION.md`. This file holds only the answer that is
Hedera-specific.

Read it in your own voice before submitting — I wrote it, you are the one
signing it.

---

## How did you use Hedera? / What did you build for this track?

mdcp is a code-mode gateway: instead of exposing N tool schemas to a model, it
exposes one `execute` tool and runs the agent's program in a QuickJS sandbox
next to the network, returning only the answer. For this track we pointed it at
Hedera and benchmarked it against Hedera's **own** official artifacts, not a
strawman.

Two things were built:

**1. A single catalog skill covering two native services.** The official suite
splits Hedera by service, so anything spanning tokens *and* consensus means
reading two skills (42,515 bytes) and hand-writing one script that reconciles
them. `skills/mdcp-port/hedera-catalog/SKILL.md` is one self-contained file
(6.6KB) with 11 capabilities across HTS and HCS. On the same task — create an
audit topic, mint into a token, write a JSON audit event, read the trail back —
the agent authored **25 lines instead of 181**. The operator key never enters
the sandbox, and the whole multi-transaction pipeline is planned and approved
as one unit before anything is broadcast, which is code-enforced rather than a
prompt instruction.

**2. A wrap of Hedera's own mirror-node MCP server.** `hedera-dev/mirrornode-mcp-server`
generates 43 MCP tools, one per mirror-node REST endpoint. mdcp mounts it
unmodified and re-exposes those same tools inside the sandbox. On a six-endpoint
portfolio-and-audit review, the conventional shape pulls **47,766 bytes into
model context across 6 round-trips**; through mdcp it is **434 bytes in 1** —
110x less — because the holder lists, raw transaction records and base64 topic
messages are filtered, decoded and aggregated in code instead of in the
transcript.

Everything runs on live testnet — token
[0.0.10521642](https://hashscan.io/testnet/token/0.0.10521642), audit topic
[0.0.10521641](https://hashscan.io/testnet/topic/0.0.10521641) — and every
number ships with its raw log. BENCHMARK.md §4–§6 includes the rounds we lost
and the caveats (the 110x is a deterministic interaction-shape measurement, not
an agent run).

## Rough edges we hit and fixed

- `mirrornode-mcp-server` **does not start from a clean clone**: `fastmcp` pulls
  `zod-to-json-schema`, which imports the `zod/v3` subpath, while the repo pins
  `zod@3.24.2`, which predates it.
- Once running, its **SSE endpoint answers HTTP 500 "Error creating server"** on
  every connection — reproduced with the repo's own pinned dependencies — so the
  43 tools it defines are unreachable as shipped. We served its own
  `openApiZod.ts` definitions over stdio instead (`app/bench/upstream/`),
  leaving its files untouched.
- In our own gateway, passing a multi-line program on a shell line cost real
  agent time in quoting and escaping, so `execute` now accepts
  `@path/to/program.ts`.

## Links

- Repo: https://github.com/ivanvolov/mdcp
- Hedera section of the README: https://github.com/ivanvolov/mdcp#integrations
- Benchmarks: https://github.com/ivanvolov/mdcp/blob/main/BENCHMARK.md
- Catalog skill: `skills/mdcp-port/hedera-catalog/SKILL.md`
