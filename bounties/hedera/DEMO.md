# Demo video — Hedera segment

Hedera's rule is more generous than the others: **≤ 5 minutes**. The project
video is one recording covering all three partner picks; this is the **~45-second
Hedera beat**. Human voice (AI voiceover is grounds for rejection on the other
tracks — keep it human throughout).

## Where this beat goes

1. ~0:00–0:30 — the problem: agents rebuild the same executor every session.
2. ~0:30–1:30 — Uniswap: the 12-line skill port, live Sepolia transactions.
3. ~1:30–2:15 — The Graph: the unmodified MCP server, one program.
4. **~2:15–3:00 — Hedera: this beat.**
5. ~3:00–3:30 — the safety model (key never in the sandbox, approval is code).
6. ~3:30–3:45 — close.

## The beat, shot by shot

**Shot 1 — the pipeline (~15s).** Terminal running the real thing:

```bash
bash bench/arm-hedera.sh execute @bench/programs/audit-trail.ts
```

Show the returned plan — six transactions across two services, nothing
broadcast yet.

> "One program. It creates a consensus topic, creates a token, mints it, and
> writes an audit event for every step. Hedera's official suite splits tokens
> and consensus into two skills you read separately — this is one catalog, and
> the agent wrote twenty-five lines instead of a hundred and eighty-one."

**Shot 2 — the gate (~10s).** Run `resume` with the execution id, then open the
topic on HashScan.

> "Nothing moved until the whole plan was approved as one unit. That's code, not
> a prompt instruction — and the operator key never entered the sandbox. Here's
> the audit trail on testnet."

**Shot 3 — the number (~15s).** Run the sweep, put the two figures on screen:

```bash
npx tsx bench/mirror-sweep.ts
```

> "Hedera also ships a mirror-node MCP server: forty-three tools, one per REST
> endpoint. Same six-endpoint question, conventionally, pulls forty-seven
> thousand bytes into the model's context. Through mdcp: four hundred and
> thirty-four. The filtering happens next to the data."

**Shot 4 — the honest line (~5s), optional but recommended.**

> "And where it doesn't win — against their script-writing skills — we said so
> in the benchmark. If a skill already tells the agent to write code, a gateway
> buys you safety, not tokens."

## Don't say

- "Faster and cheaper on Hedera." The Hedera number is **payload into context**,
  not agent tokens and not wall clock. Keep the tokens/speed claims on the
  Uniswap and Graph footage, where they were measured that way.
- "110x fewer tokens." The 110x is **bytes of payload into context** on a
  deterministic run, not agent tokens and not an agent run at all.

## Pre-record checklist

- [ ] Upstream MCP server running (`app/bench/upstream/README.md`) or Shot 3
      will fail on camera.
- [ ] Operator account funded — Shot 1/2 broadcast real transactions
      (~14 HBAR per full run; check the balance first).
- [ ] Use a fresh topic/token so the HashScan page is clean on screen.
- [ ] Terminal font large enough to read the plan output at 720p.
