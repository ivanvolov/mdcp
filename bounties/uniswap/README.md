# Uniswap Foundation — $5,000

What we built for this bounty, which track it qualifies for, and where the
evidence lives. Form answers: `SUBMISSION.md`.

## The one-sentence version

The Trading API is a brain with no hands — it routes, quotes and builds
calldata, but nothing executes — so we built the hands once as a gateway, then
proved it by taking **Uniswap's own skill files**, changing **12 lines of 126**,
and racing them against each other on live Sepolia.

## Track

**Best Uniswap Stack Contribution — $3,000** (up to 3 teams × $1,000).
Classic / From Scratch. Eligible.

The second Uniswap track ($2,000) is Continuity-only — **not eligible**, this
project was built inside the event window.

## What we integrated

**The Trading API, the documented way.** Full flow in
[`app/src/tradingApi.ts`](../../app/src/tradingApi.ts):

- `apiQuote` — line 125 — live `/quote`, BEST_PRICE routing
- `apiSwap` — line 157 — `/quote` → `/swap` → host-side sign → broadcast → receipt
- `ensureLegacyAllowance` — line 46 — the standing-Permit2 approval path
  (ERC-20 → Permit2, then `Permit2.approve(token, router, amount, expiration)`)
- `headers()` — line 94 — `x-api-key`, `x-universal-router-version: 2.0`, and
  **`x-agent-info` with `integration_name: "mdcp"`** on every request (line 103),
  so this traffic is attributable in your analytics

**The on-chain stack** in [`app/src/chain.ts`](../../app/src/chain.ts):

- QuoterV2 exact-input quoting — line 157 (`0x61fFE014bA17989E743c5F6cB21bF9697530B21e`)
- SwapRouter02 `exactInputSingle` — line 225 (`0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`)
- v3 pool depth per fee tier via the factory — line 266
- swap-log decoding for copy-trading — line 305
- exact-amount ERC-20 approvals (never unlimited) — line 206
- Sepolia deployments wired for the live arm — lines 70–72

**Your skills, ported.** [`skills/uniswap-official/`](../../skills/uniswap-official/)
is your suite copied verbatim (MIT, LICENSE included);
[`skills/mdcp-port/`](../../skills/mdcp-port/) is the same strategy prompt with
only the delegation target changed:

```bash
diff skills/uniswap-official/dca-bot/SKILL.md skills/mdcp-port/dca-bot/SKILL.md   # 12 of 126 lines
diff skills/uniswap-official/index-bot/SKILL.md skills/mdcp-port/index-bot/SKILL.md # 20 of 158 lines
```

`swap-integration` + `viem-integration` (70,117 bytes of "here is how to build
an executor") are replaced by `mdcp-execute` (4,219 bytes of "here are the
functions").

**The safety layer** in [`app/src/sandbox.ts`](../../app/src/sandbox.ts) —
the part the skills describe in prose and nothing enforces:

- side-effect policy, chain writes gated — line 141
- transaction-intent identity (economic fields only) — line 114
- occurrence index, so three identical mirrors stay three — line 135
- plan-once / approve-once, replay from the ledger on resume — lines 292, 318

## Results

Their skill vs. the same skill on mdcp, identical tasks, identical on-chain
outcomes. Full methodology and caveats in [`BENCHMARK.md`](../../BENCHMARK.md).

**Live Sepolia, production Trading API** (four public transactions):

| operation | official | mdcp | |
| --- | --- | --- | --- |
| quote 25 USDC→WETH | 86,474 tok / 47s | 54,683 / 21s | 1.58x / 2.2x |
| wallet balances | 60,168 / 62s | 55,124 / 31s | 1.09x / 2.0x |
| swap 25 USDC→WETH | 85,794 / 145s | 55,965 / 57s | 1.53x / 2.5x |
| swap 0.002 WETH→USDC | 83,066 / 109s | 56,366 / 49s | 1.47x / 2.2x |

Totals: **315,502 → 222,138 tokens (1.42x), 363s → 158s (2.3x).**

**index-bot, 3-leg basket via the Trading API:** 179,979 → 64,126 tokens
(2.81x), 738s → 67s (11x). The official arm's number includes diagnosing the
Permit2-nonce wall unaided — real work, stated as a caveat, and the reason our
feedback got corrected.

Two things the ratios hide: **mdcp's cost is flat** (54.7k–56.4k regardless of
operation) while the official arm swings 60k–86k, and **the approval gate was
switched on** for every mdcp swap — we are faster with the seatbelt on.

## Feedback

[`FEEDBACK.md`](../../FEEDBACK.md) — seven findings, each verified against the
live API or the shipped packages, plus a "did not survive verification" section
where we withdraw two of our own claims. Highlights:

- no official executor exists (SDKs state they don't execute;
  `@uniswap/client-trading` is protobuf types, referenced nowhere)
- the skill's Legacy approval path **as documented does not work** — approving
  directly to the Universal Router reverts (`0xd81b2f2e`), because the router
  pulls through Permit2
- Permit2 nonces are read from live mainnet, so the second swap on any fork or
  simulation reverts as an undecoded `0x2c4029e9`
- `routingPreference: "CLASSIC"` is documented but rejected by the live API
- the `(1 << 48) - 1` uint48 truncation trap, hit independently by our gateway
  and by your own skill's agent

## Live transaction trail

Burner wallet
[`0xEEb84a3a…944b3f`](https://sepolia.etherscan.io/address/0xEEb84a3a4B4930311dD7385c10559Bd309944b3f)
— every transaction built by the Trading API, every request tagged `mdcp`.
