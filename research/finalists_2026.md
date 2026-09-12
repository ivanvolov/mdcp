# ETHGlobal 2026 finalists — verified research (2026-09-12)

Double-verified: (1) independent re-derivation from `data/projects/*.json`, (2) live crawl of
ethglobal.com showcase (every page per event, RSC payload parsed; finalists = projects carrying the
ETHGlobal-org prize, `type: "finalist"`) + ETHGlobal's X announcement for NY. Both passes matched
exactly on all counts and all 47 names.

## How "winning" works at ETHGlobal

- There is **no single grand winner**. The top tier is **"Finalist"** — the top ~10 teams picked by
  judges, who demo live at the closing ceremony. All finalists get the same pack (1000 USDC/member,
  flight reimbursement, perks). Site-wide prize taxonomy: `finalist` (ETHGlobal) + partner
  `tier`/`pool`/`track`. Nothing ranks above finalist.
- Everything else is sponsor prize tracks (World, 0G, Arc, Hedera, ENS, Uniswap Foundation, Ledger,
  Chainlink, …), awarded independently of finalist status.

## The five completed 2026 events

1,758 projects, 419 prize-winners, **47 finalists** total.

- **HackMoney 2026** (Jan 30–Feb 11, online) — 620 projects, 166 winners, 10 finalists:
  AutoPay, Blip Market, PulsePlay, claw2claw, GrimSwap, BorrowBot, Xpack, Oikonomos, router402, Magnee.
- **ETHGlobal Cannes 2026** (Apr 3–5) — 265 projects, 67 winners, 10 finalists:
  EVM PORST, maki, PaintGlobal, Défi, ALMA, npmguard, Corpus, VEIL VPN, DIVE, ENShell.
- **Open Agents** (Apr 24–May 6, online) — 468 projects, 32 winners, **7** finalists:
  Clan World: Ælder…, Mnemosyne, Aegis402, DAIO, Slopstock, Common OS, LPlens.
- **ETHGlobal New York 2026** (Jun 12–14) — 232 projects, 99 winners, 10 finalists:
  UNSU, Canary, Immunity, Distro, Accrue, Proof of Scan, The Wallet Shift, Void Tactics, Cumulant, LYNX.
- **ETHGlobal Lisbon 2026** (Jul 24–26) — 173 projects, 55 winners, 10 finalists:
  ArcBook, Glassbox402, KOLlateral, Hands Unchained, Lean Silicon, ethui agentic wallet, Carte Bleue,
  Lortnoc Tahc, explorador.pt, Happy Hour.
- **ETHOnline 2026** (Sep 4–16) — running now, no results yet.

## Agentic vs skill/MCP vs DeFi — the 47 finalists

- **AI-agent products: 10** (maki, ALMA, npmguard, Corpus, DIVE, BorrowBot, Oikonomos, Clan World,
  DAIO, LPlens)
- **MCP / skill / AI-tooling infrastructure: 10** (ENShell, claw2claw, router402, Mnemosyne,
  Aegis402, Common OS, Immunity, The Wallet Shift, Glassbox402, ethui agentic wallet)
- **DeFi (non-agentic): 9** (Défi, Blip Market, PulsePlay, GrimSwap, Canary, Cumulant, LYNX,
  ArcBook, explorador.pt)
- **Other: 18** (wallets, privacy, ZK hardware, gaming, consumer, security)

→ **20 of 47 finalists (43%) are AI-related**, split evenly between "an agent" and
"tooling/infra for agents". The tooling half trended UP through the year: Lisbon (July, latest)
had 5 of 10 finalists in the AI zone, 3 of them MCP-flavored.

## Precedents closest to "MCP/skill that makes DeFi protocols faster/cheaper for agents"

All prize-winners, several finalists — this exact pattern won at every 2026 event:

- **Orloj Finance Agents** (Lisbon, 0G prize) — turns verified smart contracts into MCPs; dedicated
  **Uniswap-API MCP** for swap routes + LP management. Closest existing project to the idea.
- **ethui agentic wallet** (Lisbon, **FINALIST**) — MCP servers so Claude/Codex/Cursor safely drive a
  real dev wallet + Anvil testnets.
- **router402** (HackMoney, **FINALIST** + LI.FI prize) — x402 pay-per-use LLM gateway + Li.Fi MCP server.
- **claw2claw** (HackMoney, **FINALIST**) — full DeFi market access for OpenClaw bots (Uniswap v4 hook,
  LI.FI, ENS).
- **Sentinel MCP Wallet** (HackMoney) — policy-governed MCP wallet: 4 MCP tools, trade-size/whitelist/
  slippage guardrails, gasless swaps.
- **Aigentpay** (HackMoney) — 7-tool MCP financial API for any agent (balances, gasless USDC, ENS).
- **us-agents** (HackMoney) — MCP server + OpenClaw **skill** ("circle-mcp") for cross-chain liquidity.
- **Cuttlefish** (HackMoney) — explicitly "an SDK/skill — DeFi rails for AI agents".
- **Keeper-Gate** (Open Agents) — 3-line adapter giving LangChain/ElizaOS/OpenClaw agents on-chain
  execution.
- **Skillname** (Open Agents, ENS 3rd) — ENS-resolved **skill discovery**: name → MCP-compatible tool
  bundle loaded at runtime.
- **Mars** (NY, Arc 1st) / **Aegis** (NY, Ledger 2nd + ENS 1st) — marketplaces/trust-checks for agent
  **skills** (SKILL.md, MCP servers).
- Agent-side proof of demand: ALMA (Cannes finalist, Uniswap 3rd), LPlens (OA finalist), Zuno/Moai
  (OA, Uniswap 1st/2nd), Tradewise Agentlab (OA, KeeperHub 1st) — agents managing Uniswap positions
  keep winning Uniswap's own prizes.

## ETHOnline 2026 tracks the idea maps onto (live now)

- **Uniswap Foundation $5k** — "build on or integrate any part of the Uniswap stack (API, v2–v4 AMM, CCA)".
- **The Graph $5k AI track** — explicitly rewards "tooling that makes The Graph easier to use from AI
  environments like Claude, Cursor, ChatGPT".
- **1inch $5k** — Aqua apps (sophisticated DeFi positions).
- **Bazantic $3k** — "agentify a new API", recipes across sponsor APIs.
- Plus agentic tracks: Arc (Circle Agent Stack), Hedera (agentic payments), Ledger (AI Agents x Ledger).

## Caveat / positioning note

"Make the existing flow 10x faster / 5x cheaper on tokens" as the headline is **differentiated**:
existing winners prove *access* (agent can touch Uniswap at all) or *safety* (guardrails); none of
them lead with **token-efficiency / latency of the agent loop itself** (deterministic protocol
adapters instead of LLM round-trips, compressed tool schemas, cached routes). That efficiency angle
is the open gap — but plain "MCP for Uniswap" alone is no longer novel; judges have seen it at
multiple 2026 events.
