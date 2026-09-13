/**
 * Level 3: the live Sepolia transaction trail.
 *
 * Runs the ported DCA strategy shape for real on the public testnet through the
 * production Trading API — wrap a little ETH, then trade WETH<->USDC back and
 * forth in small fixed sizes. Every request carries the mdcp x-agent-info
 * attribution; every transaction is publicly visible on sepolia.etherscan.io.
 */
import { account, publicClient } from "../src/chain.js";
import { apiSwap } from "../src/tradingApi.js";

const NATIVE = "0x0000000000000000000000000000000000000000";
const CYCLES = Number(process.env.BOT_CYCLES ?? 8);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

console.log(`bot wallet ${account.address}, cycles ${CYCLES}`);

// Seed: wrap 0.02 ETH once so there is WETH to trade with.
try {
  const wrap = await apiSwap({ tokenIn: NATIVE, tokenOut: "WETH", amountIn: "20000000000000000" });
  console.log(`WRAP ${wrap.status} ${wrap.txHash}`);
} catch (e: any) {
  console.log(`WRAP failed: ${e.message.slice(0, 160)}`);
}

for (let i = 1; i <= CYCLES; i++) {
  // sell a sliver of WETH into USDC
  try {
    const sell = await apiSwap({ tokenIn: "WETH", tokenOut: "USDC", amountIn: "2000000000000000" });
    console.log(`[${i}] SELL ${sell.status} ${sell.txHash} out=${sell.amountOut}`);
  } catch (e: any) {
    console.log(`[${i}] SELL failed: ${e.message.slice(0, 160)}`);
  }
  await sleep(15_000);
  // buy back with whatever USDC we hold (fixed small size)
  try {
    const buy = await apiSwap({ tokenIn: "USDC", tokenOut: "WETH", amountIn: "50000" });
    console.log(`[${i}] BUY ${buy.status} ${buy.txHash} out=${buy.amountOut}`);
  } catch (e: any) {
    console.log(`[${i}] BUY failed: ${e.message.slice(0, 160)}`);
  }
  await sleep(15_000);
}

console.log("final ETH:", (await publicClient.getBalance({ address: account.address })).toString());
