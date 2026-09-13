# WETH/USDC Venue Comparison — Ethereum Mainnet (Messari subgraphs)

## 1. Protocol snapshots

**Uniswap V3 Ethereum**
- Subgraph ID: `4cKy6QQMc5tpfdx8yxfYeb9TLZmgLQe44ddW1G7NwkA6`
- Protocol: "Uniswap V3", schemaVersion 4.0.0
- Latest financialsDailySnapshot: dailyVolumeUSD **$106,487,875.40**; totalValueLockedUSD **$136,254,483,844.68**

**SushiSwap Ethereum**
- Subgraph ID: `77jZ9KWeyi3CJ96zkkj5s1CojKPHt6XJKjLFzsDCd8Fd`
- Protocol: "SushiSwap", schemaVersion 1.3.2
- Latest financialsDailySnapshot: dailyVolumeUSD **$1,140,465.35**; totalValueLockedUSD **$1,074,789,077,108.94**

**Curve Finance Ethereum**
- Subgraph ID: `3fy93eAT56UJsRCEht8iFhfi6wjHWXtZ9dnnbQmvFopF`
- Protocol: "Curve Finance", schemaVersion 1.3.0
- Latest financialsDailySnapshot: dailyVolumeUSD **$9,619,459.01**; totalValueLockedUSD **$4,765,742,602.98**

*Caveat: the SushiSwap and Uniswap V3 totalValueLockedUSD figures above are far above their known real-world TVL (~$100–200M for Sushi, ~$3–4B for Uniswap V3 mainnet) — likely a stale/corrupted price feed on one input token inflating the protocol-level USD aggregate in these subgraphs. Pool-level TVL figures below look sane and are used for the venue comparison.*

## 2. Most-traded WETH/USDC pool (top 50 liquidityPools by cumulativeVolumeUSD)

- **Uniswap V3** — "Uniswap V3 USD Coin/Wrapped Ether 0.05%" — totalValueLockedUSD **$108,988,086.45**; cumulativeVolumeUSD **$605,438,763,518.06** (two other WETH/USDC fee tiers, 0.3% and 0.01%, also appear in the top 50 but with lower cumulative volume)
- **SushiSwap** — "SushiSwap USD Coin/Wrapped Ether" — totalValueLockedUSD **$276,616.21**; cumulativeVolumeUSD **$31,552,773,519.52**
- **Curve Finance** — "TricryptoUSDC" (USDC/WBTC/WETH 3-asset pool) — totalValueLockedUSD **$4,787,436.57**; cumulativeVolumeUSD **$4,427,830,233.68**

## 3. Ranking by latest dailyVolumeUSD

1. **Uniswap V3** — $106.49M
2. **Curve Finance** — $9.62M
3. **SushiSwap** — $1.14M

**Recommendation:** Uniswap V3's 0.05% USDC/WETH pool is the best venue for a WETH/USDC swap today — it has by far the highest protocol-wide daily volume and the deepest pool liquidity (~$109M TVL vs. Curve's Tricrypto ~$4.8M and Sushi's ~$277K), meaning the tightest spreads and lowest slippage among the three.
