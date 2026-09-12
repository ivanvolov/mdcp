/**
 * Uniswap integration (Uniswap Foundation prize target).
 * TODO(h2-7): wire real viem calls — QuoterV2 / UniversalRouter / v4 PositionManager on Sepolia.
 */
import type { ToolDef } from "./index.js";

const todo = async () => ({ ok: false, error: { code: "not_implemented", retryable: false } });

export const uniswapTools: ToolDef[] = [
  {
    path: "uniswap.default.sepolia.quote",
    summary: "Quote a swap (exact-in) via QuoterV2; returns amountOut and route",
    inputTS: "{ tokenIn: Address; tokenOut: Address; amountIn: bigint; feeTier?: 500|3000|10000 }",
    outputTS: "{ amountOut: bigint; route: string; gasEstimate: bigint }",
    sideEffect: "view",
    invoke: todo,
  },
  {
    path: "uniswap.default.sepolia.swap",
    summary: "Execute a swap through UniversalRouter (simulates first; pauses for approval)",
    inputTS: "{ tokenIn: Address; tokenOut: Address; amountIn: bigint; slippageBps: number }",
    outputTS: "{ txHash: Hex; amountOut: bigint }",
    sideEffect: "write",
    invoke: todo,
  },
  {
    path: "uniswap.default.sepolia.lp_mint",
    summary: "Mint a concentrated-liquidity position in a tick range around current price",
    inputTS: "{ pool: Address; amount0: bigint; amount1: bigint; rangePct: number }",
    outputTS: "{ txHash: Hex; tokenId: bigint; tickLower: number; tickUpper: number }",
    sideEffect: "write",
    invoke: todo,
  },
  {
    path: "uniswap.default.sepolia.pool_state",
    summary: "Read pool slot0: price, tick, liquidity, fee",
    inputTS: "{ pool: Address }",
    outputTS: "{ sqrtPriceX96: bigint; tick: number; liquidity: bigint; fee: number }",
    sideEffect: "view",
    invoke: todo,
  },
];
