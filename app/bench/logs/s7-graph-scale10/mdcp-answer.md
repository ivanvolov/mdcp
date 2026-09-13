# DEX Market Scan — Messari EXCHANGE Subgraphs (The Graph, live)
# ARM: mdcp (code mode) — 71,004 agent tokens, 5 tool invocations, 154s

Data collected live from The Graph via Messari EXCHANGE-schema subgraphs (`dexAmmProtocols` / `financialsDailySnapshots` / `liquidityPools`, ordered by `timestamp desc` / `cumulativeVolumeUSD desc`).

## 1. Per-target results

- **Uniswap V3 Ethereum** — subgraph `4cKy6QQMc5tpfdx8yxfYeb9TLZmgLQe44ddW1G7NwkA6` · protocol "Uniswap V3" (MAINNET) · latest dailyVolumeUSD **$106,487,875** (snapshot 2026-09-13 00:00 UTC) · top pool: "Uniswap V3 USD Coin/Wrapped Ether 0.05%", cumulativeVolumeUSD **$605,439,356,179**
- **Sushiswap Ethereum** — subgraph `77jZ9KWeyi3CJ96zkkj5s1CojKPHt6XJKjLFzsDCd8Fd` · protocol "SushiSwap" (MAINNET) · latest dailyVolumeUSD **$1,146,632** (2026-09-13 09:53 UTC) · top pool: "SushiSwap USD Coin/Wrapped Ether", cumulativeVolumeUSD **$31,552,773,520**
- **Curve Finance Ethereum** — subgraph `3fy93eAT56UJsRCEht8iFhfi6wjHWXtZ9dnnbQmvFopF` · protocol "Curve Finance" (MAINNET) · latest dailyVolumeUSD **$9,693,526** (2026-09-13 09:54 UTC) · top pool: "reUSD/sfrxUSD", cumulativeVolumeUSD **~$1.38×10^24** (outlier)
- **Uniswap V3 Arbitrum** — subgraph `FQ6JYszEKApsBpAmiHesRsd9Ygc6mzmpNRANeVQFYoVX` · protocol "Uniswap V3" (ARBITRUM_ONE) · latest dailyVolumeUSD **$18,395,083** (2026-09-13 00:00 UTC) · top pool: "Uniswap V3 WETH/USDC 0.05%", cumulativeVolumeUSD **$58,591,355,585**
- **Uniswap V3 Base** — subgraph `FUbEPQw1oMghy39fwWBFY5fE6MXPXZQtjncQy2cXdrNS` · protocol "Uniswap V3" (BASE) · latest dailyVolumeUSD **$35,499,012** (2026-09-13 00:00 UTC) · top pool: "Uniswap V3 Wrapped Ether/USD Coin 0.05%", cumulativeVolumeUSD **$50,205,827,579**
- **Uniswap V3 Polygon** — subgraph `BvYimJ6vCLkk63oWZy7WB5cVDTVVMugUAF35RAUZpQXE` · protocol "Uniswap V3" (MATIC) · latest dailyVolumeUSD **$7,620,535** (2026-09-13 00:00 UTC) · top pool: "Uniswap V3 USD Coin (PoS)/Wrapped Ether 0.05%", cumulativeVolumeUSD **$22,971,751,289**
- **Uniswap V3 Optimism** — subgraph `EgnS9YE1avupkvCNj9fHnJxppfEmNNywYJtghqiu2pd9` · protocol "Uniswap V3" (OPTIMISM) · latest dailyVolumeUSD **$56,707** (2026-09-13 00:00 UTC) · top pool: "Uniswap V3 Wrapped Ether/USD Coin 0.05%", cumulativeVolumeUSD **$11,749,074,138**
- **Uniswap V3 BSC** — subgraph `8f1KyiuNYiNGrjagzEVpf6k6KkPG517prtjdrJihgHw` · protocol "Uniswap V3" (BSC) · latest dailyVolumeUSD **$30,966,323** (2026-09-13 00:00 UTC) · top pool: "Uniswap V3 quq/Tether USD 0.01%", cumulativeVolumeUSD **$66,397,474,085**
- **Sushiswap Arbitrum** — subgraph `9tSS5FaePZnjmnXnSKCCqKVLAqA6eGg6jA2oRojsXUbP` · protocol "SushiSwap" (ARBITRUM_ONE) · latest dailyVolumeUSD **$8,934** (2026-09-13 09:53 UTC) · top pool: "SushiSwap Wrapped Ether/USD Coin (Arb1)", cumulativeVolumeUSD **$4,359,446,368**
- **Pancakeswap V3 BSC** — subgraph `ChmxqA9bX71cB2cQTRRULbWUBKoMRk7oh3JnpZShDQ2V` · protocol "PancakeSwap V3" (BSC) · latest dailyVolumeUSD **$399,029,796** (snapshot 2026-08-03 00:00 UTC — **stale, ~41 days old**) · top pool: "PancakeSwap V3 Tether USD/Wrapped BNB 0.01%", cumulativeVolumeUSD **$162,752,776,529**

## 2. Ranking by latest dailyVolumeUSD

1. Pancakeswap V3 BSC — $399,029,796 (stale snapshot, Aug 3)
2. Uniswap V3 Ethereum — $106,487,875
3. Uniswap V3 Base — $35,499,012
4. Uniswap V3 BSC — $30,966,323
5. Uniswap V3 Arbitrum — $18,395,083
6. Curve Finance Ethereum — $9,693,526
7. Uniswap V3 Polygon — $7,620,535
8. Sushiswap Ethereum — $1,146,632
9. Uniswap V3 Optimism — $56,707
10. Sushiswap Arbitrum — $8,934

## 3. Takeaways

Uniswap V3 Ethereum is clearly the healthiest, most current, most liquid venue in the set (largest lifetime pool volume at $605B and a solid $106M/day), and Uniswap V3 as a protocol dominates cross-chain, leading on five of six chains it's deployed on — SushiSwap trails far behind on both Ethereum and Arbitrum by 1-2 orders of magnitude. Two anomalies stand out: Pancakeswap V3 BSC's top-ranked "$399M/day" is actually a 41-day-stale indexer snapshot (last updated Aug 3, not Sept 13 like every other target), and Curve Finance Ethereum's top pool (reUSD/sfrxUSD) reports a nonsensical cumulativeVolumeUSD on the order of 10^24 — almost certainly a decimals/unit bug in that subgraph's data rather than real volume.
