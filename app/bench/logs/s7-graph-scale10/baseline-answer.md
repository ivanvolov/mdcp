# DEX Market Scan — Messari EXCHANGE Subgraphs (The Graph, live)
# ARM: baseline (per-tool MCP) — 95,481 agent tokens, 43 tool invocations, 479s

## 1. Per-target snapshot

- **Uniswap V3 Ethereum** — subgraph_id `4cKy6QQMc5tpfdx8yxfYeb9TLZmgLQe44ddW1G7NwkA6` — protocol: Uniswap V3 — dailyVolumeUSD: **$106,487,875.40** — top pool: Uniswap V3 USD Coin/Wrapped Ether 0.05% — cumulativeVolumeUSD: $605,439,356,277.15
- **Sushiswap Ethereum** — subgraph_id `77jZ9KWeyi3CJ96zkkj5s1CojKPHt6XJKjLFzsDCd8Fd` — protocol: SushiSwap — dailyVolumeUSD: **$1,146,680.28** — top pool: SushiSwap USD Coin/Wrapped Ether — cumulativeVolumeUSD: $31,552,773,520.51
- **Curve Finance Ethereum** — subgraph_id `3fy93eAT56UJsRCEht8iFhfi6wjHWXtZ9dnnbQmvFopF` — protocol: Curve Finance — dailyVolumeUSD: **$9,696,940.79** — top pool: reUSD/sfrxUSD — cumulativeVolumeUSD: $1,384,473,417,460,874,274,632,939.64 *(data anomaly)*
- **Uniswap V3 Arbitrum** — subgraph_id `FQ6JYszEKApsBpAmiHesRsd9Ygc6mzmpNRANeVQFYoVX` — protocol: Uniswap V3 — dailyVolumeUSD: **$18,395,083.36** — top pool: Uniswap V3 WETH/USDC 0.05% — cumulativeVolumeUSD: $58,591,355,584.62
- **Uniswap V3 Base** — deployment `QmawEzRNeDyaTgjPKb1eRrbyzxczgSHUYzvTMaMnN8jyuh` (top Messari deployment by query fees for Base factory; no healthy registry subgraph_id surfaced by keyword search) — protocol: Uniswap V3 — dailyVolumeUSD: **$35,499,012.07** — top pool: Uniswap V3 Wrapped Ether/USD Coin 0.05% — cumulativeVolumeUSD: $50,205,829,451.71
- **Uniswap V3 Polygon** — deployment `QmZetW4DWc8PM8YPN59Y7DfCKxdZWKP1wH4PfmvJsnR4MA` (same reason as Base) — protocol: Uniswap V3 — dailyVolumeUSD: **$7,620,535.03** — top pool: Uniswap V3 USD Coin (PoS)/Wrapped Ether 0.05% — cumulativeVolumeUSD: $22,971,751,388.59
- **Uniswap V3 Optimism** — subgraph_id `EgnS9YE1avupkvCNj9fHnJxppfEmNNywYJtghqiu2pd9` — protocol: Uniswap V3 — dailyVolumeUSD: **$56,706.61** — top pool: Uniswap V3 Wrapped Ether/USD Coin 0.05% — cumulativeVolumeUSD: $11,749,074,141.34
- **Uniswap V3 BSC** — subgraph_id `8f1KyiuNYiNGrjagzEVpf6k6KkPG517prtjdrJihgHw` — protocol: Uniswap V3 — dailyVolumeUSD: **$30,966,322.98** — top pool: Uniswap V3 quq/Tether USD 0.01% — cumulativeVolumeUSD: $66,397,478,479.04 *(low-quality/wash-traded pair)*
- **Sushiswap Arbitrum** — subgraph_id `9tSS5FaePZnjmnXnSKCCqKVLAqA6eGg6jA2oRojsXUbP` — protocol: SushiSwap — dailyVolumeUSD: **$8,972.75** — top pool: SushiSwap Wrapped Ether/USD Coin (Arb1) — cumulativeVolumeUSD: $4,359,446,367.56
- **Pancakeswap V3 BSC** — subgraph_id `ChmxqA9bX71cB2cQTRRULbWUBKoMRk7oh3JnpZShDQ2V` — protocol: PancakeSwap V3 — dailyVolumeUSD: **$399,029,795.83** *(snapshot ~41 days older than every other target — stale)* — top pool: PancakeSwap V3 Tether USD/Wrapped BNB 0.01% — cumulativeVolumeUSD: $162,752,776,529.44

## 2. Ranking by latest dailyVolumeUSD

1. Pancakeswap V3 BSC — $399,029,795.83 *(stale snapshot, ~41 days old)*
2. Uniswap V3 Ethereum — $106,487,875.40
3. Uniswap V3 Base — $35,499,012.07
4. Uniswap V3 BSC — $30,966,322.98
5. Uniswap V3 Arbitrum — $18,395,083.36
6. Curve Finance Ethereum — $9,696,940.79
7. Uniswap V3 Polygon — $7,620,535.03
8. Sushiswap Ethereum — $1,146,680.28
9. Uniswap V3 Optimism — $56,706.61
10. Sushiswap Arbitrum — $8,972.75

## 3. Takeaways

Excluding the stale Pancakeswap snapshot, Uniswap V3 dominates the scan outright — it holds 4 of the top 5 slots across five different chains, with Ethereum mainnet alone doing roughly 3x the volume of the next-largest live venue (Base), while Sushiswap and the L2/BSC Uniswap V3 deployments trail far behind. Two anomalies stand out: Curve Finance Ethereum's top pool reports a cumulativeVolumeUSD in the sextillions (clearly a decimal/unit overflow bug in that subgraph rather than real volume), and Uniswap V3 BSC's top pool by volume is a "quq/USDT" pair, which reads as a low-liquidity or wash-traded token skewing the pool-level ranking rather than genuine organic flow.
