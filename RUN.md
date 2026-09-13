# Running mdcp

Everything a reviewer needs to run this repo, per sponsor track, without
reading the source. If you are an agent reading this on someone's behalf: every
command below was executed against live networks before it was written down,
and the outputs shown are real.

- **Judging one track?** Jump to [Per-track walkthroughs](#per-track-walkthroughs).
- **Just want to see the shape?** `./mdcp surface all` needs no credentials
  beyond an install and prints the whole capability catalog.
- **Reproducing a benchmark number?** [Reproducing the benchmarks](#reproducing-the-benchmarks).

---

## 1. Install

```bash
git clone https://github.com/ivanvolov/mdcp && cd mdcp
cd app && npm install && cd ..
cp app/.env.example app/.env     # then fill in what your track needs (§2)
```

Node 20+. No Rust toolchain is required for any track (§4 explains the Graph
fallback). No vault, no secret manager — `app/.env` is plain env, gitignored,
and `app/.env.example` documents every key.

Verify the install without any credentials at all:

```bash
./mdcp surface uniswap
```

That starts the MCP server over stdio the way an AI client would, lists the
tools it exposes, and prints the capabilities reachable inside them.

---

## 2. Credentials, and what each one unlocks

Nothing here needs mainnet funds. Every write path is a public testnet with a
throwaway key.

| variable | unlocks | how to get it |
| --- | --- | --- |
| `SEPOLIA_RPC_URL` | all Uniswap on-chain reads and writes | any provider (Alchemy, Infura, a public endpoint) |
| `UNISWAP_API_KEY` | `uniswap.apiQuote` / `uniswap.apiSwap` (production Trading API) | developers.uniswap.org dashboard — interactive login, no programmatic path |
| `SEPOLIA_BURNER_PK` + `SEPOLIA_BURNER_ADDRESS` | broadcasting Uniswap swaps | generate a throwaway key, fund from a Sepolia faucet |
| `GATEWAY_API_KEY` | all `graph.*` capabilities | thegraph.com/studio → **API Keys** tab. This is the Gateway key, **not** a subgraph deploy key — the deploy key answers `auth error: API key not found` on every query |
| `SUBGRAPH_MCP_BIN` | optional | path to a locally built `graphops/subgraph-mcp`. Leave empty and mdcp bridges to the hosted SSE service through `npx mcp-remote` instead |
| `HEDERA_OPERATOR_KEY` + `HEDERA_OPERATOR_EVM` | `hts.*` / `hcs.*` writes on Hedera testnet | generate an ECDSA key (one-liner in `.env.example`), fund the EVM alias at portal.hedera.com/faucet |
| `MIRRORNODE_MCP_BIN` | the 43 `mirror.*` read capabilities | path to `hedera-dev/mirrornode-mcp-server`'s stdio entrypoint — see `app/bench/upstream/README.md` |

**What runs with zero credentials:** `./mdcp surface <profile>`,
`./mdcp help`, and every byte-counting script in `app/bench/`
(`catalog-size.ts`, `graph-sweep.ts` in offline mode). Everything that touches a
network needs the relevant key above.

---

## 3. Capability profiles

One server, four profiles. `MDCP_PROFILE` decides which capability families are
mounted, so a reviewer looking at one sponsor sees that sponsor's surface and
nothing else.

| `MDCP_PROFILE` | families mounted | capabilities | `execute` description |
| --- | --- | --- | --- |
| `uniswap` | `chain.* token.* wallet.* uniswap.* state.*` | 13 | 2,600 B |
| `graph` | `graph.* state.*` | 11 | 1,769 B |
| `hedera` | `hts.* hcs.* mirror.* state.*` | 56 | 10,435 B |
| `all` | everything | 76 | 12,966 B |
| *unset* | whatever `GRAPH_UPSTREAM` / `HEDERA_TOOLS` / `MIRROR_UPSTREAM` enable | — | — |

Measured with `./mdcp surface <profile>`; reproduce them yourself with the same
command. Leaving `MDCP_PROFILE` unset is the historical behaviour on purpose —
every benchmark arm script in `app/bench/` predates profiles and must keep
producing the exact catalog its recorded numbers were measured against.

The last column is the point of the architecture: **76 capabilities sit behind
3 MCP tools and 12,966 bytes of always-loaded description.** A conventional MCP
server exposing the same 76 functions ships a JSON Schema per tool into every
request — that is the control arm, `./mdcp serve-baseline`.

---

## 4. Mounting in an AI client

`.mcp.json` at the repo root declares all four profiles. In Claude Code, open
the project and enable the one you want; the others cost nothing while off.

```jsonc
{
  "mcpServers": {
    "mdcp-hedera": { "command": "./mdcp", "args": ["serve"], "env": { "MDCP_PROFILE": "hedera" } }
  }
}
```

Or without the project file:

```bash
claude mcp add mdcp-hedera -e MDCP_PROFILE=hedera -- ./mdcp serve
claude mcp add mdcp-graph  -e MDCP_PROFILE=graph  -- ./mdcp serve
```

Any MCP host works — the server speaks stdio and declares three tools
(`execute`, `resume`, `skills`).

**Skills.** `skills/` holds the agent-facing instructions. To use them in Claude
Code, copy the ones for your track into `~/.claude/skills/`:

```bash
cp -r skills/mdcp-port/hedera-catalog ~/.claude/skills/     # Hedera
cp -r skills/mdcp-graph              ~/.claude/skills/      # The Graph
cp -r skills/mdcp-port/mdcp-execute  ~/.claude/skills/      # Uniswap (execution layer)
cp -r skills/mdcp-port/dca-bot       ~/.claude/skills/      # Uniswap (a strategy on top)
```

Each is self-contained: no prerequisite skill to read first.

---

## 5. The safety model, in one run

Reads execute immediately. Anything that moves funds does not broadcast on the
first call — the program runs to completion in a **planning pass** and hands
back every transaction it intends to make:

```bash
CHAIN_PROFILE=sepolia MDCP_PROFILE=uniswap ./mdcp execute \
  'return await tools["uniswap.apiSwap"]({tokenIn:"USDC",tokenOut:"WETH",amountIn:"25000000"});'
```

```json
{ "status": "awaiting_approval",
  "approval": {
    "executionId": "7721c217",
    "plan": [ { "tool": "uniswap.apiSwap",
                "args": { "tokenIn": "USDC", "tokenOut": "WETH", "amountIn": "25000000" },
                "intentHash": "c2de1d1844f8c306" } ],
    "reason": "1 transaction(s) need approval. Review them, then call resume({ executionId, approve: true }) once to run the whole strategy." } }
```

Nothing was broadcast. To continue:

```bash
CHAIN_PROFILE=sepolia MDCP_PROFILE=uniswap ./mdcp resume '{"executionId":"7721c217","approve":true}'
```

On approval the program re-runs against **live** state rather than replaying a
frozen snapshot, so quotes taken before you reviewed are recomputed — while
transactions that already landed replay from the intent ledger instead of being
sent twice. One approval covers a whole multi-leg strategy, which is why
approval cost does not grow with the number of legs.

The gate is a property of the capability (`sideEffect: "chain"` in
`app/src/tools.ts`), not an instruction in a prompt. A model cannot skip it, and
the private key never enters the sandbox — programs can *ask* for a swap, they
cannot produce a signature.

---

## 6. Per-track walkthroughs

### Uniswap

Needs `SEPOLIA_RPC_URL`, `UNISWAP_API_KEY`, and (for swaps) a funded
`SEPOLIA_BURNER_PK`.

```bash
# a live quote through the production Trading API
CHAIN_PROFILE=sepolia MDCP_PROFILE=uniswap ./mdcp execute \
  'const b = await tools["chain.block"]({});
   const q = await tools["uniswap.apiQuote"]({tokenIn:"USDC",tokenOut:"WETH",amountIn:"25000000"});
   return { block: b.number, out: q.amountOut };'
# -> {"status":"ok","result":{"block":"11695957","out":"931014270326573"},"logs":[]}
```

The swap path is §5 above. The side-by-side experiment lives in `skills/`:

```bash
diff skills/uniswap-official/dca-bot/SKILL.md skills/mdcp-port/dca-bot/SKILL.md
```

12 lines of 126 differ, all of them the delegation target. Feedback sent to the
Foundation is `FEEDBACK.md`; the integration code is `app/src/tradingApi.ts`.

### The Graph

Needs `GATEWAY_API_KEY`. No Rust toolchain — leave `SUBGRAPH_MCP_BIN` empty and
the hosted service is used over `npx mcp-remote`.

```bash
MDCP_PROFILE=graph ./mdcp execute \
  'const r = await tools["graph.search_subgraphs_by_keyword"]({keyword:"uniswap"});
   return { ok: !!r };'

# the cross-category program the benchmark measures: DEX + lending, 6 chains
cd app && bash bench/arm-graph-mdcp.sh execute @bench/programs/defi-scan.ts
```

mdcp mounts the official `graphops/subgraph-mcp` server **unmodified** as an MCP
client and re-exposes its 9 tools inside the sandbox. Both benchmark arms run
that same binary, so the upstream implementation is held constant.

### Hedera

Reads need nothing but an install. Writes need a funded testnet operator.

```bash
# read-only, costs no HBAR
MDCP_PROFILE=hedera ./mdcp execute 'return await tools["hts.network"]({});'
# -> {"status":"ok","result":{"network":"testnet","operatorId":"0.0.10521296","hbarBalance":"18.64231651"},"logs":[]}

# the two-service pipeline: create a topic, create and mint a token, write an
# audit event per step, read the trail back — one program, one approval
cd app
bash bench/arm-hedera.sh execute @bench/programs/audit-trail.ts
bash bench/arm-hedera.sh resume '{"executionId":"<id from the plan>","approve":true}'

# the mirror-node benchmark: 43 upstream tools, deterministic, zero HBAR
npx tsx bench/mirror-sweep.ts        # see bench/upstream/README.md for setup
```

The catalog skill covering both services is
`skills/mdcp-port/hedera-catalog/SKILL.md`; the official skills it is compared
against are vendored verbatim under `skills/hedera-official/`.

---

## 7. Reproducing the benchmarks

Both arms of every experiment call the **same capability registry**
(`app/src/tools.ts`). The only variable is the shape of the interaction:

- `./mdcp serve` — one `execute` tool; the loop runs in the sandbox
- `./mdcp serve-baseline` — one MCP tool per capability; the loop runs in the
  model's context

The arm scripts in `app/bench/` set the env each recorded run used:

```bash
cd app
bash bench/arm-mdcp.sh          help   # Uniswap, mainnet fork
bash bench/arm-baseline.sh      help   # ...its control arm
bash bench/arm-sepolia.sh       help   # Uniswap, live Sepolia + production API
bash bench/arm-graph-mdcp.sh    help   # The Graph
bash bench/arm-graph-baseline.sh help
bash bench/arm-hedera.sh        help   # Hedera native services
bash bench/arm-mirror.sh        help   # Hedera mirror-node MCP upstream
```

Raw logs are committed under `app/bench/logs/`, one numbered directory per
scenario, each with a `RESULTS.md`. Methodology and every caveat:
[BENCHMARK.md](./BENCHMARK.md).

**What traces to what.** Byte counts, call counts and payload sizes are derived
from the machine logs in `app/bench/logs/` and are independently checkable.
Token and wall-clock figures come from the agent runner's usage accounting and
are recorded in each scenario's `RESULTS.md` — a prose file, not a machine log.
Both are reported as measured; only the former can be recomputed from the repo.

**What will not reproduce exactly.** Agent runs are N=1 per configuration, and
the Graph scenarios query live subgraphs whose health changes within hours —
four Uniswap V3 deployments went healthy → "no allocations" inside one hour on
the morning of the recorded runs. The programs degrade gracefully by design
(errors arrive as values, not exceptions), so a rerun succeeds with a different
set of rows.

---

## 8. Troubleshooting

- **`auth error: API key not found` on every Graph query** — you used a subgraph
  *deploy* key. The Gateway key is a different key on the same Studio page.
- **A profile mounts fewer capabilities than the table in §3** — an upstream is
  unreachable. Upstream mounts fail soft on purpose (one dead upstream must not
  kill the server); run `./mdcp surface <profile>` directly to see the
  upstream's own stderr.
- **`resume` says it cannot find the execution** — pending executions are keyed
  by `STATE_DIR`. Use the same `STATE_DIR`/arm script for `resume` that you used
  for `execute`.
- **A Hedera write fails with `INSUFFICIENT_PAYER_BALANCE`** — a full
  `audit-trail.ts` pipeline costs roughly 14 testnet HBAR. Check with
  `./mdcp execute 'return await tools["hts.network"]({});'` and refill at the
  faucet.
- **A swap reverts `OutOfGas` on a fork** — the Trading API's `gasLimit` is
  estimated against live mainnet state. We drop it and let the node estimate;
  see `FEEDBACK.md` §4 for why.
- **`npx tsx` is slow to start** — every command here pays one tsx startup.
  `npm run build` in `app/` produces `dist/` if you would rather run compiled.
