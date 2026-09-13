# Scenario 8 — one query pattern across protocol *categories*

Not a benchmark — a capability demonstration, and the strongest form of the
standardization argument. Scenarios 5–7 reuse one query across many DEXes.
This one reuses the *same* query across DEXes **and lending markets**.

Run: 2026-09-13, live gateway. Program: `app/bench/programs/defi-scan.ts`.
Raw output: `output.json`. Call log: `mdcp.jsonl`.

## Why it works

Messari's standardized subgraphs are usually described as "one schema per
protocol type". But the base entities — `protocols` and
`financialsDailySnapshots` — are identical *across* types. So this query:

    protocols(first: 1) { name schemaVersion type }
    financialsDailySnapshots(first: 1, orderBy: timestamp, orderDirection: desc) {
      timestamp totalValueLockedUSD
    }

answers correctly against Uniswap V3, SushiSwap, Curve, PancakeSwap, Aave v2,
Aave v3 and Compound III without modification. Only one small fragment differs
per category (`liquidityPools` vs `markets`), and even that is the same shape.

One run spanned **five schema versions** — EXCHANGE 1.3.0, 1.3.2, 4.0.0, 4.0.1
and LENDING 3.1.0 — across six chains. Without the standard this is nine schema
explorations (30–50 KB of SDL each) and nine bespoke queries; with it, it is one
pattern in a loop.

## What the program returns

    pattern.schemaVersionsSpanned  EXCHANGE:4.0.0, 4.0.1, 1.3.2, 1.3.0, LENDING:3.1.0
    pattern.categories             dex 3, lending 3   (after quarantine)
    ranked                         6 protocols by TVL, DEX and lending interleaved
    excluded                       SushiSwap Ethereum — implausible TVL ($1.1T)
                                   PancakeSwap V3 BSC — stale (995.4h ≈ 41 days)
    skipped                        Uniswap V3 Base — unhealthy on the network

The ranking puts Uniswap V3 Ethereum ($136B) above Aave v3 ($24.6B) above Curve
($4.8B) above Compound III ($1.9B) — a cross-category comparison that is only
possible because the TVL field means the same thing in both schemas.

## The part worth arguing for

**Data quality is decided in the sandbox, in code, before anything is ranked.**
Two failure modes are live in this dataset and neither raises an error:

- a snapshot that stopped updating still returns a confident number
  (PancakeSwap's 41-day-old row would otherwise rank *first*)
- junk-token pricing inflates protocol TVL past any real figure
  (SushiSwap reporting $1.1T)

Handled conventionally, the model receives nine raw rows and has to audit them
itself — which costs context and depends on the model noticing. Here the model
receives a clean ranking plus a named list of what was excluded and why. The
benchmark agents in scenarios 5 and 7 *did* notice both traps unprompted, which
is to their credit; this program means noticing is not required.

## Reproducibility note

Subgraph health on the decentralized network drifts fast. Within one hour on
the day of this run, four Uniswap V3 deployments (Base, Polygon, Optimism, BSC)
went from healthy to "no allocations" — visible in the difference between
scenario 7's run and `dex-scan.ts`'s. The programs treat that as data and keep
going, so a rerun degrades gracefully rather than failing; it will not reproduce
the same set of rows.
