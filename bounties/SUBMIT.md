# Submit — the one file to open at submission time

Everything needed for the ETHGlobal form, in the order the form asks for it.
Per-track detail stays in the folders; nothing is duplicated here except the
**general project fields**, which are canonical in this file.

Deadline: **Sun 13 Sep 2026, 12:00 pm EDT / 16:00 UTC.**

---

## 1. Prize picks (3 allowed)

ETHGlobal lets one project select three partner prizes. A partner with multiple
tracks counts as one selection.

| pick | sponsor | pool | why it qualifies |
| --- | --- | --- | --- |
| 1 | **The Graph** | $15,000 across 3 tracks | official `subgraph-mcp` mounted unmodified; cross-category Messari-schema program; both arms run the same binary |
| 2 | **Uniswap Foundation** | $5,000, open track | Trading API integration with `x-agent-info`; skill-vs-skill port; **developer feedback form submitted** (the track's qualification gate) |
| 3 | **Hedera** | $2,000, Improve the Harness | HTS + HCS on live testnet; 43-tool mirror-node MCP server mounted; two upstream defects found, fix written |

All three are complete in the repo. Evidence maps: `the-graph/README.md`,
`uniswap/README.md`, `hedera/README.md`.

---

## 2. General project fields

### Project name

**mdcp — a code-mode MCP gateway for on-chain agents**

### Tagline

One `execute` tool instead of a hundred tool schemas: agents write a small
program, it runs in a sandbox next to the chain and the data, and only the
answer reaches the model.

### Description

Agents talking to on-chain systems today burn most of their context on
plumbing. Every protocol hands them tens of kilobytes of instructions and asks
them to rebuild the same executor — clients, ABIs, signing, retries — from
scratch, every session. Every tool call drags its full payload through the
transcript, and the transcript is re-read on every turn.

mdcp is that plumbing written once. It exposes three tools —
`execute` / `resume` / `skills` — and runs the agent's program in a QuickJS
sandbox with the integrations already mounted. Loops, conditionals, retries and
discarded intermediate data stay next to the chain instead of in the model's
context. Private keys never enter the sandbox; chain writes stop for operator
approval as a code-enforced gate rather than a prompt instruction; and a
resumed run replays already-landed transactions from an intent ledger instead
of double-spending.

Three protocols are mounted behind that one surface: Uniswap (production
Trading API plus the on-chain v3 stack), The Graph (their official MCP server,
unmodified), and Hedera (HTS/HCS through the Hiero SDK, plus their 43-tool
mirror-node MCP server). Seventy-six capabilities sit behind three MCP tools
and 13KB of always-loaded description, and a reviewer can mount one protocol at
a time with `MDCP_PROFILE`.

We did not benchmark it against a strawman. For Uniswap we took their own skill
files verbatim and changed 12 lines of 126 — only the delegation target — then
ran fresh agents on the same task, ending with real transactions on live
Sepolia. For The Graph we mounted their own MCP server unmodified and ran the
identical server against itself in both interaction shapes. For Hedera we
measured both of their official AI surfaces, and report both: against their
SKILL.md suite there was **no improvement**, because those skills already tell
the agent to write a script; against their per-tool MCP server the payload into
context dropped from 47,766 bytes to 434. Every number in the repo comes with
its raw logs and both agents' verbatim answers.

### How it's made

TypeScript MCP server (`@modelcontextprotocol/sdk`) over stdio. The sandbox
wraps `@executor-js/runtime-quickjs` (MIT, from executor.sh) and adds what a
chain gateway needs and a general code runner does not: a policy gate on every
tool leaving the sandbox, suspend/resume around human approval, and tx-intent
idempotency keyed on economic fields plus occurrence index. Chain access is
viem against mainnet forks and live Sepolia; routing and calldata come from
Uniswap's production Trading API, signed host-side. Hedera uses the Hiero SDK,
with recipient keys in a host keystore so an association can be signed without
key material entering the sandbox.

Two of the three integrations are **generic MCP-upstream adapters**: mdcp
connects to another MCP server as a client, discovers its tools at runtime,
converts their JSON Schema into compact TypeScript signatures, and re-exposes
them inside the sandbox. The Graph's server and Hedera's mirror-node server are
both mounted that way, unmodified. Upstream failures are returned as values
rather than thrown, so a program sweeping ten subgraphs survives the two that
are dead on the network.

Benchmarking is instrumented at the call level — every invocation logs argument
and result bytes, duration, and whether it crossed the model boundary — so the
context claims are measured rather than estimated.

### Repo

<https://github.com/ivanvolov/mdcp> — public.
Site: <https://ivanvolov.github.io/mdcp/>.
How to run it: [RUN.md](../RUN.md).

---

## 3. Per-track answers

Paste from these; each is written for that sponsor's question.

- **The Graph** — `the-graph/SUBMISSION.md` → "How did you use The Graph?"
  (includes which track to select if asked)
- **Uniswap** — `uniswap/SUBMISSION.md` → "How did you use Uniswap, and what
  feedback do you have?" The feedback form is **already submitted**.
- **Hedera** — `hedera/SUBMISSION.md` → "How did you use Hedera?" plus the
  rough-edges answer their track asks for.

---

## 4. Demo video

One recording, **2–4 minutes** (Hedera allows up to 5; the other two cap at 4,
so stay under 4). **≥720p. Your own voice — AI voiceover is automatic
rejection on the Uniswap and Graph tracks.**

Running order, with shot-by-shot detail in each folder's `DEMO.md`:

| time | beat | script |
| --- | --- | --- |
| 0:00–0:30 | the problem: agents rebuild the same executor every session | `uniswap/DEMO.md` |
| 0:30–1:30 | Uniswap: the 12-line skill port, live Sepolia transactions | `uniswap/DEMO.md` |
| 1:30–2:15 | The Graph: the unmodified MCP server, one program | `the-graph/DEMO.md` |
| 2:15–3:00 | Hedera: two surfaces, and the one where it did not help | `hedera/DEMO.md` |
| 3:00–3:30 | the safety model: key never in the sandbox, approval is code | `uniswap/DEMO.md` |
| 3:30–3:45 | close | — |

Pre-record checks: Hedera operator balance (a full pipeline costs ~14 testnet
HBAR), and `./mdcp surface all` if you want the 76-capabilities shot.

---

## 5. What is still an operator task

Nothing in this list is a repo state; all of it is you.

- [ ] Select the three partner prizes (§1)
- [ ] Record and upload the video (§4)
- [ ] Paste the general fields (§2) and the per-track answers (§3) into the form
- [ ] Submit before 16:00 UTC

Optional, only if time survives:

- [ ] Open the PR to `hedera-dev/mirrornode-mcp-server` — content is written and
      tested (`hedera/TODO.md`); it turns Hedera qualification requirement #1
      from "arguably" into unambiguous.
