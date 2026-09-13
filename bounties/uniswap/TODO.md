# TODO — Uniswap submission

Hard cutoff: **12:00 EDT / 16:00 UTC, Sun 2026-09-13.**

Legend: **[you]** needs a human · **[claude]** I can do it · **[done]** shipped.

## Blocking — the bounty is not eligible without these

- [ ] **[you] Submit the Uniswap Developer Feedback Form.**
      https://developers.uniswap.org/hackathon-feedback
      This is a **hard qualification requirement**, not a nicety: the prize text
      says a completed form *"that includes the link to your FEEDBACK.md file"*.
      Paste this link:
      `https://github.com/ivanvolov/mdcp/blob/main/FEEDBACK.md`
      Ready-to-paste summary answers are in `SUBMISSION.md` → "Feedback form".
      I cannot do this one — it needs your logged-in session.

- [ ] **[you] Pick the 3 partner prizes** at submission. Uniswap is one
      candidate among four (see `../README.md`). Both Uniswap tracks belong to
      one partner, but only the $3,000 Classic track is open to us, so
      selecting Uniswap spends one slot for one track.

- [ ] **[you] Record the demo video** — 2–4 min, ≥720p, **human voice**
      (AI voiceover is an automatic rejection). Uniswap beats: `DEMO.md`.

- [ ] **[you] Paste the submission answers** from `SUBMISSION.md` into the
      ETHGlobal form (drafted; needs your voice-check).

- [x] **[done] Public GitHub repo, open source** — https://github.com/ivanvolov/mdcp,
      MIT, all work inside the event window, incremental commit history.

- [x] **[done] FEEDBACK.md exists and is substantive** — 7 verified findings,
      2 claims withdrawn after checking. `../../FEEDBACK.md`.

- [x] **[done] README points at the integration code** — the prize text asks
      that judges can verify the integration. `../../README.md` links the
      benchmark and architecture; this folder's `README.md` carries the
      file:line evidence map.

## Should do — materially strengthens the claim

- [ ] **[claude] Third bot: copy-trade skill-vs-skill.** We have dca-bot (3
      levels, both directions) and index-bot (level 2). copy-trade is ported the
      same minimal way and would make it three of their three trading-tools
      bots. ~40 min. Say the word and I run it.

- [ ] **[claude] Rerun the index-bot official arm on a warm script.** Its
      179,979 tokens include diagnosing the Permit2 wall from scratch. An
      honest "second encounter" number alongside it would pre-empt the obvious
      objection. ~15 min.

- [ ] **[claude] More live Sepolia transactions.** Four today. A longer trail on
      the burner address makes the integration look used rather than
      demonstrated. Cheap — the bot script exists (`app/bench/sepolia-bot.ts`).

## Judged, not required — where we are weak

Scored on Technicality, Originality, Practicality, Usability, WOW.

- **Practicality** is the soft spot: this is a gateway with a CLI and an MCP
  server, no UI. Mitigation is the live transaction trail and the
  judges-can-run-it quickstart in the root README.
- **Coverage**: `lp-integration`, x402 / `pay-with-any-token`, and the v4 SDK
  are untouched. Stated in the README limitations — do not let the video imply
  otherwise.
- **N=1** on every benchmark row. The trend across three levels and two bots is
  the defensible claim, not any single ratio.

## Do not do

- Do not claim the Continuity track — we are From Scratch.
- Do not cite the 20-fee-tier venue scan (44 → 3). It is excluded from all
  claims because it forced the baseline to do routing the Trading API does
  server-side. It stays in the logs, not in the pitch.
