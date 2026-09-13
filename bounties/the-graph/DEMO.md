# Demo video — The Graph segment

The video is one 2–4 min recording covering the whole project; this is the
**~45-second Graph beat** and where it sits. Requirements from the rules:
≥720p, **human voice** (AI voiceover = rejected), 2–4 minutes total.

## Where this beat goes

Rough shape of the full video:

1. ~0:00–0:30 — the problem: agents rebuild the same executor from 70KB of
   instructions, every session.
2. ~0:30–1:30 — Uniswap: the 12-line skill port, the live Sepolia transactions.
3. **~1:30–2:15 — The Graph: this beat.**
4. ~2:15–2:45 — the safety model (key never in the sandbox, approval is code).
5. ~2:45–3:00 — close.

## The beat, shot by shot

**Shot 1 — the setup (~10s).** Terminal, `skills/mdcp-graph/SKILL.md` open or
`bench/arm-graph-mdcp.sh help` listing the `graph.*` tools.

> "The Graph's Subgraph MCP is a real, open-source server with nine tools. We
> didn't fork it or rewrite it. mdcp mounts it unmodified and re-exposes those
> same nine tools inside the sandbox."

**Shot 2 — the program (~15s).** The cross-protocol program on screen — short
enough to read in one breath.

> "One query pattern, written once against the Messari standardized schema, run
> across ten subgraphs — four protocols, six chains. Live gateway data. The
> loop, the retries, the fifty-row pool lists all stay in the sandbox."

**Shot 3 — the numbers (~15s).** `s6-graph-sweep/chart.html` on screen, or the
side-by-side counters.

> "Same server, same data, same answers on both sides — the only difference is
> where the data lands. At three targets: nineteen tool calls versus three. At
> ten: forty-three versus five, three times faster, and twenty-five times less
> payload through the model's context. The gap grows with the task."

**Shot 4 — the honest note (~5s).** Optional but recommended.

> "Seventy percent of the conventional run's context was GraphQL schemas it
> read once. Standardized schemas are why our program never fetches one."

## Rules of the beat

- **Show the answer parity.** The strongest moment is two different shapes
  producing the same ranking. If you only show speed, it reads as a shortcut.
- **Never say the 1,238x number out loud** without saying "modeled." It is a
  cost model of transcript re-reading, not a measurement. The measured numbers
  are 1.16x and 1.34x on tokens, 1.6x and 3.1x on wall clock. Say those.
- **Don't claim Substreams.** We didn't touch it.
- **Say "unmodified" at least once.** It is the thing that makes the experiment
  credible and it is easy to miss on a quick watch.

## Assets ready to film

- `app/bench/logs/s6-graph-sweep/chart.html` — the two charts, light/dark aware,
  already rendered and verified in-browser
- `app/bench/logs/s7-graph-scale10/{baseline,mdcp}-answer.md` — the two verbatim
  deliverables, side by side, for the parity shot
- `bash bench/arm-graph-mdcp.sh execute @<program>` — live run if you want to
  film it executing rather than showing a still (~2 min at N=10; pre-record it,
  don't make the viewer wait)
