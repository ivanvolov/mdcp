# Scenario 6 — Scaling sweep: where does the gap go as the task grows?

Deterministic, no model in the loop. Scenarios 5 and 7 measure real agents at
two task sizes; this sweep fills in the curve between and past them by doing
the same work at N = 1, 2, 3, 4, 6, 8, 10 targets in both interaction shapes
and measuring actual bytes.

Run: 2026-09-13, live Graph gateway through the unmodified official
`graphops/subgraph-mcp`. Script: `app/bench/graph-sweep.ts`.
Outputs: `sweep.csv`, `sweep.json`, `chart.html` (slide-ready, light/dark).

## What is held identical

Both arms do **exactly the same upstream work per target** — search (discovery),
schema fetch, financials query, top-50 pools query — against the same live
subgraphs. No caching, no shortcuts on either side. The only difference is
where the results land:

- **baseline**: every call is a boundary crossing; all payloads enter the
  model's transcript. 4N round-trips.
- **mdcp**: one `execute()` program; payloads stay in the sandbox and only the
  compact aggregate crosses. 1 round-trip, at any N.

## Results

    N   baseline calls   baseline kTok   mdcp kTok   processed-context ratio
    1        4               14.8           0.46           36x
    2        8               25.8           0.56          106x
    3       12               35.6           0.65          197x
    4       16               50.5           0.74          315x
    6       24               61.2           0.80          615x
    8       32               71.6           0.87          943x
    10      40               97.4           1.06        1,238x

Two different quantities, deliberately kept apart:

- **Transcript tokens** (columns 3–4) — the tool payload that enters context.
  Baseline grows roughly linearly with N (14.8k → 97.4k); mdcp is nearly flat
  (0.46k → 1.06k, growing only with the size of the returned summary). At N=10
  that is a **92x** difference in what the model must read.
- **Processed context** (column 5) — the modeled cumulative cost of an agent
  loop, where the whole transcript is re-read on every turn. This grows
  quadratically in the number of boundary crossings, so a shape with 4N
  crossings and one with 1 diverge fast: 36x at N=1, **1,238x at N=10**.

The processed-context model is the same one `bench/analyze.ts` uses for the
Uniswap scenarios: start with the instruction surface, add each call's payload
to the carried context, charge the carried total once per turn, and charge one
final turn for writing the answer (both arms pay that last turn — omitting it
would flatter mdcp, whose entire transcript is a single call).

## Honesty notes

- This is a **model of** agent cost, not a measurement of one. Real agents
  think, retry, and re-plan; scenarios 5 and 7 are the empirical anchors
  (1.16x and 1.34x measured agent tokens at N=3 and N=10). The sweep isolates
  the mechanical component, which is why its ratios are much larger than the
  end-to-end agent ratios: agent totals are dominated by the fixed system
  prompt and the deliverable, which are identical in both arms.
- The sweep's mdcp arm fetches schemas it does not need, purely to keep the
  upstream work identical to the baseline. A real mdcp program skips them
  (as the scenario-7 agent did), so this understates the practical gap.
- Wall-clock is not reported as a headline here: both arms are dominated by the
  same live gateway latency, and a deterministic script pays no inference time.
  Scenario 7 has the real wall-clock comparison (3.1x).
- Targets are the 10 Messari standardized subgraphs verified healthy on
  2026-09-13. Unhealthy deployments (PancakeSwap Ethereum, Balancer V2,
  Camelot, QuickSwap, Aerodrome) were excluded at probe time, not silently
  skipped mid-run.
