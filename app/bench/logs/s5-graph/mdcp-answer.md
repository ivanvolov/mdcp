# WETH/USDC Venue Comparison — Ethereum Mainnet (Messari Subgraphs)

## 1. Protocol Snapshots

**Uniswap V3** — subgraph `4cKy6QQMc5tpfdx8yxfYeb9TLZmgLQe44ddW1G7NwkA6` ("Uniswap V3 Ethereum")
- Protocol: Uniswap V3, schemaVersion 4.0.0
- Latest daily snapshot: dailyVolumeUSD **$106,487,875** · totalValueLockedUSD **$136,254,483,845**

**SushiSwap** — subgraph `77jZ9KWeyi3CJ96zkkj5s1CojKPHt6XJKjLFzsDCd8Fd` ("Sushiswap Ethereum")
- Protocol: SushiSwap, schemaVersion 1.3.2
- Latest daily snapshot: dailyVolumeUSD **$1,140,465** · totalValueLockedUSD **$1,074,789,077,109**

**Curve Finance** — subgraph `3fy93eAT56UJsRCEht8iFhfi6wjHWXtZ9dnnbQmvFopF` ("Curve Finance Ethereum")
- Protocol: Curve Finance, schemaVersion 1.3.0
- Latest daily snapshot: dailyVolumeUSD **$9,619,177** · totalValueLockedUSD **$4,765,742,603**

*Note: the two protocol-level `totalValueLockedUSD` figures for Uniswap V3 and SushiSwap ($136B and $1.07T) are implausibly large relative to known real-world TVL and look like a data-quality artifact in those financialsDailySnapshots rows (pool-level TVLs below are far more sane). Volumes look consistent with expectations; treat the protocol TVL numbers with caution.*

## 2. Most-Traded WETH/USDC Pool (within top 50 pools by cumulativeVolumeUSD)

- **Uniswap V3**: "Uniswap V3 USD Coin/Wrapped Ether 0.05%" — TVL **$108,987,837** · cumulativeVolumeUSD **$605,438,240,265**
- **SushiSwap**: "SushiSwap USD Coin/Wrapped Ether" — TVL **$276,616** · cumulativeVolumeUSD **$31,552,773,520**
- **Curve Finance**: "TricryptoUSDC" (WBTC/USDC/WETH pool — the closest WETH/USDC exposure in Curve's top pools; no pure 2-asset WETH/USDC pool ranked in the top 50) — TVL **$4,787,437** · cumulativeVolumeUSD **$4,427,830,234**

## 3. Ranking by Latest dailyVolumeUSD

1. Uniswap V3 — $106,487,875
2. Curve Finance — $9,619,177
3. SushiSwap — $1,140,465

**Recommendation:** Uniswap V3 is the best venue for a WETH/USDC swap today — it has ~11x Curve's and ~93x SushiSwap's daily volume, plus by far the deepest WETH/USDC pool (~$109M TVL vs. Curve's ~$4.8M tricrypto pool and SushiSwap's ~$277K), meaning tighter spreads and lower slippage.
