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
