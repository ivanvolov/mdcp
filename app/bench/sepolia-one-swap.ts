import { apiSwap } from "../src/tradingApi.js";
// buy back: 50 USDC -> WETH, the DCA direction, live on Sepolia
const r = await apiSwap({ tokenIn: "USDC", tokenOut: "WETH", amountIn: "50000000" });
console.log("RESULT", JSON.stringify(r));
