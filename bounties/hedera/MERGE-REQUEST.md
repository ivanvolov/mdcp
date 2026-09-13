# Merge request — hedera track

For the merging session. Two parts: **(A) disclosure** of shared files I already
changed before the freeze brief arrived, and **(B) edits I am requesting** but
have not made.

---

## A. Shared files I already edited (pre-brief) — please review

These were committed and pushed **before** the FINISH & FREEZE brief reached me,
in commits `3b7e1c5` and `e554f96`. I have not touched them since. Flagging so
you can re-merge, revert or reflow as you see fit.

1. **`README.md` (root)** — replaced the single-line Hedera bullet under
   `## Integrations` with a fuller entry (two-surfaces table, the 110x result,
   the upstream defects, HashScan links), and added a Hedera block to
   `## Quickstart`.
2. **`skills/README.md`** — rewrote the `## Hedera (HTS)` section as
   `## Hedera — one catalog skill for every native service`, and appended a
   `### The other Hedera surface` subsection. Uniswap and Graph sections
   untouched; the only line removed that mentioned them was a passing
   "Unlike the Uniswap suite…" clause inside the Hedera section.
3. **`bounties/README.md`** — added one row to the status table:

   ```
   | `hedera/` | Hedera | $2,000 / Improve the Harness | qualification met, needs video; upstream PR would make it unambiguous |
   ```

---

## B. Honesty-pass edits I am requesting in `skills/README.md`

Two phrases in the section I wrote narrate us choosing a favourable target.
Literal replacements below. (My own `BENCHMARK.md` §4–§6 has already had this
pass applied.)

### B1. Replace this paragraph

```
The first Hedera round (`mdcp-port/hedera-token-service/`, kept for
reproducibility — BENCHMARK.md §4) deliberately tested the *single*-service
case and found mdcp cost-neutral and slower. That is the honest degenerate
case: one well-documented service has nothing for a gateway to collapse. The
catalog skill exists to test the axis that actually matters — composition.
```

with

```
The first Hedera round (`mdcp-port/hedera-token-service/`, kept for
reproducibility — BENCHMARK.md §4) tested the single-service case and found
mdcp cost-neutral and slower: one well-documented service has nothing for a
gateway to collapse. The catalog skill extends the same comparison to two
services (§5), which changed the artifact ratios but not the agent cost.
```

### B2. Replace this heading

```
### The other Hedera surface — where the shape actually wins
```

with

```
### The other Hedera surface — the mirror-node MCP server
```

---

## C. Suggested text if you want a Hedera line elsewhere

Use or discard. One-liner for any summary table:

```
Hedera — measured against both official AI surfaces. Against the `hedera-skills`
SKILL.md suite: no improvement (1.06x tokens, ~2x slower), because those skills
already tell the agent to write a script. Against the 43-tool
`mirrornode-mcp-server`: 47,766 -> 434 bytes into context, 6 round-trips -> 1.
```

---

## D. Files I own and have finished

- `app/src/hedera.ts`, `app/src/hederaUpstream.ts`
- `skills/hedera-official/**`, `skills/mdcp-port/hedera-token-service/**`,
  `skills/mdcp-port/hedera-catalog/**`
- `app/bench/arm-hedera.sh`, `app/bench/arm-mirror.sh`,
  `app/bench/hedera-probe.ts`, `app/bench/mirror-sweep.ts`,
  `app/bench/catalog-size.ts`, `app/bench/programs/audit-trail.ts`,
  `app/bench/upstream/**`, `app/bench/skill-arm-hedera/**`
- `app/bench/logs/hedera-*.jsonl`, `hedera-skill-arms.json`,
  `mirror-sweep*.json*`
- `BENCHMARK.md` §4, §5, §6
- `bounties/hedera/**`

## E. Shared files I touched that are NOT on your list

- **`app/bench/cli.ts`** — added `execute @path/to/file.ts` (reads the program
  from a file instead of a shell-quoted string) and a `MIRROR_UPSTREAM=1` hook
  plus `closeMirrorUpstream()` in the shutdown path. Additive; no existing
  behaviour changed. It is not on your do-not-touch list, but it is shared, so
  flagging it.
- **`app/src/tools.ts`, `app/src/sandbox.ts`** — these ARE on your list and I
  edited them earlier in the session, before the brief. Details in section F,
  because one of them was a regression fix you will want to know about.

## F. Regression I introduced and fixed — please keep the fix

While adding the Hedera tools I gated them on the presence of
`HEDERA_OPERATOR_KEY`. Every arm script sources the same `.env`, so once that
key existed the **Uniswap arm's catalog silently grew from 13 tools to 21**,
inflating the `execute` description its recorded §1 numbers were measured
against. Now gated on an explicit `HEDERA_TOOLS=1`, mirroring `GRAPH_UPSTREAM=1`.

Verified just now:

```
arm-mdcp.sh   -> 13 tools, 0 leaked
arm-hedera.sh -> 24 tools, 11 hedera family
arm-mirror.sh -> 67 tools, 43 mirror
```

If you reflow `tools.ts`, **do not revert to keying off `HEDERA_OPERATOR_KEY`** —
that silently corrupts the Uniswap numbers.

Also in `sandbox.ts` (both additive, needed for multi-transaction Hedera
pipelines, no effect when unused): per-tool `planStub` merged into the planning
stub, and a guard so a `view` whose arguments came from a planned-but-not-yet-
executed write returns its declared shape instead of doing a live lookup of a
nonexistent entity. Both are written up as bugs 4 and 5 in BENCHMARK.md.
