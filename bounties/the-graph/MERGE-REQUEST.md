# Merge requests — the-graph

Changes needed in files owned by the merging session. Literal replacement text,
in priority order.

---

## 1. `app/.env.example` — BLOCKER for fresh-clone repro

The Graph path needs two vars that are not in the template. A judge who copies
`.env.example` today cannot run the Graph track at all. Append:

```
# The Graph gateway key — thegraph.com/studio -> API Keys tab.
# NOTE: this is the Gateway API key, NOT a subgraph deploy key; the deploy key
# returns "auth error: API key not found" on every query.
GATEWAY_API_KEY=

# Optional: path to a locally built graphops/subgraph-mcp binary.
#   git clone https://github.com/graphops/subgraph-mcp && cargo build --release
# Leave empty to use the hosted SSE service via `npx mcp-remote` instead
# (no Rust toolchain needed; verified working).
SUBGRAPH_MCP_BIN=
```

---

## 2. `README.md` (root) — honesty pass on text I wrote

Line ~98 currently reads `the only variable is interaction shape — arguably our
cleanest experiment.` That is selection-flattering framing of exactly the kind
the brief asks to cut. Replace that sentence with:

> so the upstream implementation is held constant and the only variable is
> interaction shape.

Same fix already applied in `BENCHMARK.md` §3, which I own.

Also in that block, two number corrections (see §4 below): `70%` → `69%`, and
the `tool invocations | 19 → 3 | 43 → 5` row should read
`agent tool invocations`.

---

## 3. `bounties/README.md` — status row

Replace the `the-graph` row with:

```
| `the-graph/` | The Graph | $15,000 / 3 tracks | complete — code, benchmarks, skill, paperwork all in |
```

(The old row said "needs video"; video is an operator task, not a repo state,
and the operator asked for it to stop appearing in repo docs.)

---

## 4. Number corrections that may have been copied into merger-owned files

I found two figures in my own docs that did not trace exactly to the logs and
have corrected them everywhere I own. If either was copied into the root
README, `skills/README.md`, or the BENCHMARK intro, apply the same fix:

- **`112,810` → `112,996`** and **`70%` → `69%`** — schema-fetch bytes at N=3.
  The old figure summed result bytes only; the transcript total it is compared
  against (162,069) includes argument bytes, so the two were computed
  differently. Verified against `app/bench/logs/s5-graph/baseline.jsonl`.
- **`tool invocations: 43 → 5`** should be labelled **`agent tool
  invocations`**. That number is the agent runner's total tool-use count. The
  calls that actually crossed into mdcp were **42 → 1** — the difference is the
  agent writing its program file with Bash. Both numbers are true and now both
  are stated; the unlabelled version invited reading a runner metric as a
  boundary-crossing metric.

---

## 5. `.gitignore` — minor, keeps a judge's tree clean

The bench arm scripts write their default `BENCH_LOG` to
`app/bench/logs/<track>-{baseline,mdcp}.jsonl`, so running any documented
command leaves untracked files behind. Curated evidence lives in the numbered
`s*/` directories and is committed; these top-level run logs are scratch. If
you are touching `.gitignore` anyway:

```
app/bench/logs/*.jsonl
```

(The `s*/` subdirectories are unaffected by that pattern.)

---

## 6. `.mcp.json` / mounting profiles — FYI, no action needed

`skills/mdcp-graph/SKILL.md` documents mounting with `GRAPH_UPSTREAM=1`, which
your `profileWants()` still honors, so nothing is broken. If you would rather
the docs use `MDCP_PROFILE=graph` for consistency with the per-track profiles,
say so and I will change the skill — I did not touch it since the profile
mechanism is yours.

Verified after your `tools.ts` / `mcp-mdcp.ts` / `mcp-baseline.ts` changes
landed: `bash bench/arm-graph-baseline.sh help` lists all 9 `graph.*` tools,
and `bash bench/arm-graph-mdcp.sh execute @bench/programs/defi-scan.ts` runs
clean.
