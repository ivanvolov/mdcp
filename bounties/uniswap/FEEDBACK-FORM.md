# Uniswap Developer Feedback Form — fill-in sheet

Form: https://developers.uniswap.org/hackathon-feedback

**This form is a hard qualification requirement for the $3,000 track.** The
prize text requires a completed submission *that includes the link to your
FEEDBACK.md file*. No form, no prize.

Fields are listed in the order the page shows them. Answers below are drawn
from what we actually did — check them in your own voice before pasting.

---

## Identity

- **First name** *(required)* — yours
- **Last name** — yours
- **Email** *(required)* — yours
- **Telegram handle** *(required)* — yours
- **Which hackathon did you participate in?** *(required)* — `ETHOnline 2026`

---

## Dropdowns

**Did you complete a project during the hackathon?** *(required)*
> **Yes**

**Are you building an AI-powered or agentic project?** *(required)*
> **Yes: building AI tooling (Cursor/Claude Code plugins, MCP servers)**

That option is literally us — mdcp is an MCP server. The "bot that executes
onchain actions" option is also true but describes what runs *on top* of the
gateway, not the gateway.

**Were you able to successfully integrate Uniswap into your project?** *(required)*
> **Yes**

**How long did it take to get your first successful integration working?** *(required)*
> **1-4 hours** — the first live quote was quick; the full swap flow with
> Permit2 took longer. Pick **4-8 hours** instead if you want the number to
> include the Permit2-nonce diagnosis, which is closer to the real experience.

**Do you plan to continue building the project you started at this hackathon?** *(required)*
> **Yes**

**Can we follow up with you about your feedback?**
> **Yes**

**I agree to Uniswap Labs Terms of Service and Privacy Policy** *(required)*
> Tick it — but read it first; it's your agreement, not mine to accept.

---

## Ratings (1–5)

**How helpful was the Uniswap documentation for your use case?** *(required)*
> **3**

Reasoning, in case you want to defend it: the API reference is good and
`execution-model.md` is genuinely strong. But execution isn't covered at all,
the Legacy approval path is documented incorrectly, and
`routingPreference: "CLASSIC"` is listed in the docs and rejected by the live
API. Not a 2 — there's real quality here. Not a 4 — we lost hours to things a
one-line doc fix would have prevented.

**How would you rate the support Uniswap provided overall?** *(required)*
> **3** — we didn't contact anyone, so this is "neutral, untested". If rating
> support you never used feels wrong, put **4** and say so in
> *"What support was missing"*.

---

## Multi-select

**What type of support did you use?** *(required)*
> Tick **Technical docs** and **Code examples / templates**.
> Leave Developer office hours / Mentorship / Discord support unticked — we
> didn't use them.

---

## Text fields

### What did you build? *(required)*

```
An MCP standard for DeFi that makes Uniswap's own skills about 2x cheaper on
tokens and 2-11x faster, depending on the task. Benchmarked their skills against
the same skills ported to it: https://github.com/ivanvolov/mdcp/blob/main/FEEDBACK.md
```

### What was the biggest blocker you faced?

```
There is no official executor. The SDKs state they don't execute;
@uniswap/client-trading on npm is protobuf types referenced by neither the docs
nor the skills. So everything between "API response" and "confirmed
transaction" is DIY, and the agent following swap-integration wrote a fresh
~10KB viem script every session before its first trade.

Two concrete bugs cost me time. The Legacy approval path as documented does
not work: approving directly to the Universal Router reverts with 0xd81b2f2e,
because the router pulls through Permit2 — the working path is ERC-20 approve
to Permit2, then Permit2.approve(token, router, amount, expiration). And
routingPreference "CLASSIC" is listed in the docs but rejected by the live API
(only BEST_PRICE and FASTEST are accepted).
```

### If applicable: what was the hardest part of building an agentic app on Uniswap?

```
Permit2 nonces are read from live mainnet state, so the second permit-consuming
swap on a fork or simulation always reverts — surfacing as an undecoded custom
error 0x2c4029e9 wrapping selector 0x756688fe, with no mention of nonces or
Permit2 anywhere the caller can see. The fix (the Legacy path) is documented,
but nothing connects the failure to it: an agent following the skill end to end
spent 12 minutes, 180k tokens and three failed diagnostic scripts decoding
selectors by hand to bridge that gap.

Also, swap-integration is 62KB and contains zero occurrences of signTypedData.
The permit request *shape* is specified in detail — both-or-neither, strip
nulls, routing-type differences — but the act of producing the signature is
never shown, and the response omits the primaryType that viem needs.
```

### What support was missing, or could have been better?

```
An official executor package, or one blessed pattern. Permit2 errors decoded
into the /swap response. One sentence in the Permit2 section saying the nonce
is derived from live mainnet state and to use the Legacy path anywhere else. A
corrected Legacy snippet. And published token budgets per skill — context size
is the dominant cost of an agent integration and it is currently invisible.
```

### Any additional feedback?

**The FEEDBACK.md link must appear somewhere on this form. Put it here.**

```
Full verified feedback, including two of our own claims that we withdrew after
testing them against the live API:
https://github.com/ivanvolov/mdcp/blob/main/FEEDBACK.md

Credit where due: execution-model.md is the best-specified agent-safety
document we've seen from a protocol — confirm vs autonomous modes, and the rule
that autonomous requires spend caps, an allowlist, a dry-run and a kill switch.
And x-agent-info with an explicit decision_origin is a genuinely good idea we
hadn't seen elsewhere.
```

---

## Before you hit Submit

- [ ] `https://github.com/ivanvolov/mdcp/blob/main/FEEDBACK.md` appears in the
      form — it's in two fields above on purpose, belt and braces.
- [ ] The repo is public and the link opens in a logged-out browser.
- [ ] Ratings are yours, not mine. If you'd score the docs a 2 or a 4, score it
      that way — a form that reads as honest is worth more than one that reads
      as coached.
