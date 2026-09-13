# Skills: official vs mdcp port

`uniswap-official/` is the Uniswap AI skill suite, copied verbatim from
github.com/Uniswap/uniswap-ai @ 5338d6e (2026-09-08, MIT — LICENSE included) so
the two versions can be read side by side.

`mdcp-port/` is the same DCA strategy skill with ONE change: the execution layer.
The strategy prompt is deliberately untouched — 12 lines of 126 differ, all of
them the delegation target (swap-integration + viem-integration -> mdcp-execute).
Compare them directly:

    diff uniswap-official/dca-bot/SKILL.md mdcp-port/dca-bot/SKILL.md

What the execution layer costs in instructions:

- official: swap-integration (62,499) + viem-integration (7,618) = 70,117 bytes
- mdcp:     mdcp-execute = 4,219 bytes   (16.6x smaller)

The strategy skill itself is the same size in both. The saving is entirely in
what an agent must carry to *execute*, not in the strategy prompt — which is the
point: mdcp replaces the execution layer, not the skill.

## Hedera (HTS)

Same play, second ecosystem. `hedera-official/` is the `hedera-token-service`
skill copied verbatim from github.com/hedera-dev/hedera-skills @ 8b1fccd
(`plugins/native-services-js`, Apache-2.0 — LICENSE included), evals included:
the official skill ships its own benchmark prompts in `evals/spec.json`, which
the bench reuses as scenarios.

`mdcp-port/hedera-token-service/` is the port. Unlike the Uniswap suite there
is no separate strategy skill to preserve — the official SKILL.md *is* the
execution layer (raw Hiero SDK instruction), so the port replaces it wholesale
with the `hts.*` capability catalog on the mdcp gateway:

- official: SKILL.md (11,517) + references (12,581) = 24,098 bytes
- mdcp:     hedera-token-service port = ~4.6KB (5.2x smaller), and the
  configure -> freeze -> sign -> execute -> receipt lifecycle, multi-party
  association signatures, and net-zero transfer legs move out of the model's
  hands entirely.

All Hedera runs are level 3 (live testnet — HTS is a native service, there is
no fork to run it on). `app/bench/arm-hedera.sh` is the arm;
`app/bench/hedera-probe.ts` replays the official evals' "GameGold" scenario
(create 8-decimal token, 1M supply, transfer 500 to a fresh account) as one
mdcp program, deterministically, before any model tokens are spent.
