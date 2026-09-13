import { account, publicClient, CHAIN_ID } from "../src/chain.js";
import { apiQuote } from "../src/tradingApi.js";
console.log("RESULT chain:", CHAIN_ID, "account:", account.address);
console.log("RESULT balance:", (await publicClient.getBalance({ address: account.address })).toString());
try {
  const q = await apiQuote({ tokenIn: "0x0000000000000000000000000000000000000000", tokenOut: "WETH", amountIn: "1000000000000000" });
  console.log("RESULT wrap quote:", JSON.stringify(q));
} catch (e: any) { console.log("RESULT wrap quote FAILED:", e.message.slice(0,200)); }
try {
  const q2 = await apiQuote({ tokenIn: "USDC", tokenOut: "WETH", amountIn: "1000000" });
  console.log("RESULT usdc quote:", JSON.stringify(q2));
} catch (e: any) { console.log("RESULT usdc quote FAILED:", e.message.slice(0,200)); }
