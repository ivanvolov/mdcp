/**
 * End-to-end check of the mdcp path: one program does the whole DCA run,
 * suspends on the first write, resumes, and lands the swap.
 */
import { execute, resume } from "../src/sandbox.js";

const DCA_PROGRAM = `
const today = (await tools["chain.block"]()).isoTime.slice(0, 10);
const state = (await tools["state.read"]({ name: "dca" })) ?? { lastBuyPeriod: null };
if (state.lastBuyPeriod === today) {
  return { skipped: "already bought today", period: today };
}

const spend = "50000000"; // 50 USDC, 6 decimals
const bal = await tools["wallet.balances"]();
if (BigInt(bal.tokens.USDC) < BigInt(spend)) {
  return { skipped: "insufficient USDC", have: bal.tokens.USDC };
}

const q = await tools["uniswap.quote"]({
  tokenIn: "USDC", tokenOut: "WETH", amountIn: spend,
});
const minOut = (BigInt(q.amountOut) * 995n / 1000n).toString(); // 0.5% slippage

const allowance = await tools["token.allowance"]({ token: "USDC" });
if (BigInt(allowance.allowance) < BigInt(spend)) {
  await tools["token.approve"]({ token: "USDC", amount: spend });
}

const tx = await tools["uniswap.swap"]({
  tokenIn: "USDC", tokenOut: "WETH",
  amountIn: spend, amountOutMinimum: minOut,
});

await tools["state.write"]({ name: "dca", data: { lastBuyPeriod: today, txHash: tx.txHash } });
return { bought: q.amountOut, minOut, txHash: tx.txHash, status: tx.status, period: today };
`;

const t0 = Date.now();
let outcome = await execute(DCA_PROGRAM);
console.log("--- first execute ---");
console.log(JSON.stringify(outcome, null, 2));

let guard = 0;
while (outcome.status === "awaiting_approval" && guard++ < 5) {
  const id = outcome.approval!.executionId;
  console.log(`--- resuming ${id} (approving ${outcome.approval!.tool}) ---`);
  outcome = await resume(id, true);
  console.log(JSON.stringify(outcome, null, 2));
}

console.log("total_ms:", Date.now() - t0);
