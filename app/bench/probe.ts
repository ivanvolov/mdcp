import { quote } from "../src/chain.js";
const pairs: [string, number][] = [["WETH",500],["WBTC",3000],["DAI",100],["LINK",3000],["UNI",3000]];
for (const [t, fee] of pairs) {
  try {
    const q = await quote({ tokenIn: "USDC", tokenOut: t, amountIn: "50000000", fee });
    console.log(`RESULT USDC->${t} fee=${fee} out=${q.amountOut}`);
  } catch {
    console.log(`RESULT USDC->${t} fee=${fee} FAILED`);
  }
}
