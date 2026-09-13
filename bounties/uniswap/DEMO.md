# Demo video — Uniswap beats

Total video is 2–4 min across all bounties. Uniswap gets **~60 seconds**.
≥720p, **your voice** — AI voiceover is an automatic rejection. Don't speed it
up; cut dead time instead.

## The 60 seconds

**0:00–0:12 — the problem, said plainly.**
"Uniswap's Trading API routes and builds the calldata. It doesn't sign,
broadcast, or stop a retry from spending twice. So their own AI skills hand an
agent 70 kilobytes of instructions and ask it to build that executor itself —
every session."

Show on screen: `wc -c` on `swap-integration/SKILL.md` + `viem-integration/SKILL.md`
next to `mdcp-execute/SKILL.md`. 70,117 vs 4,219.

**0:12–0:25 — the experiment, and why it's fair.**
"So we took their skill files verbatim and changed twelve lines — only where
execution is delegated. Same strategy prompt, different hands."

Show on screen: the live diff.
```bash
diff skills/uniswap-official/dca-bot/SKILL.md skills/mdcp-port/dca-bot/SKILL.md
```

**0:25–0:45 — the run.** One `execute` call doing a real swap on Sepolia
through the production API, coming back `awaiting_approval` with the plan, then
`resume` landing it.

Show on screen: the plan JSON, then the tx hash, then that hash on
sepolia.etherscan.io. Let the explorer page sit for two seconds — it's the proof.

Say over it: "One round-trip. The gate is on — nothing broadcasts until the
plan is approved. The skill-only agent has no gate at all; its confirmation step
is a comment in the code it wrote."

**0:45–1:00 — the number and the honest edge.**
"Live Sepolia, fresh agent per operation: 1.4x fewer tokens, 2.3x faster. On a
three-leg basket, 2.8x and 11x. And our cost is flat — 55 thousand tokens
whether it's a balance read or a swap — because the executor is a commit, not a
lesson the agent re-learns."

Show on screen: the level-3 table from `BENCHMARK.md`.

## If you have 15 more seconds

The best moment in the whole project: their agent hit the Permit2-nonce wall and
spent twelve minutes and 180k tokens decoding selectors by hand to get out of
it. That work found a real bug in their docs — and it corrected an overstated
claim in our own feedback. Say that out loud; judges notice a team that
publishes its own retractions.

## Don't

- Don't claim LP, x402 or v4 SDK coverage — we have none.
- Don't cite the 20-fee-tier venue scan. It's excluded from our claims.
- Don't call any single ratio precise. Say "about" — every row is N=1.
