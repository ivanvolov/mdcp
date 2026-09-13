// Single-purpose script: get a live Uniswap Trading API quote on Sepolia.
// USDC -> WETH, 25 USDC (25000000 raw, 6 decimals). No approval, no swap, no broadcast.
import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const envPath = join(import.meta.dirname, "..", "..", ".env");
const env = loadEnv(envPath);

const API_KEY = env.UNISWAP_API_KEY;
if (!API_KEY) throw new Error("UNISWAP_API_KEY missing from .env");

const SWAPPER = "0xEEb84a3a4B4930311dD7385c10559Bd309944b3f"; // burner address (public)
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
const CHAIN_ID = "11155111"; // Sepolia

const AGENT_INFO = JSON.stringify({
  integration_name: "swap-integration",
  decision_origin: "autonomous",
  version: "1.5.0",
});

async function main() {
  const body = {
    swapper: SWAPPER,
    tokenIn: USDC,
    tokenOut: WETH,
    tokenInChainId: CHAIN_ID,
    tokenOutChainId: CHAIN_ID,
    amount: "25000000",
    type: "EXACT_INPUT",
    slippageTolerance: 0.5,
    routingPreference: "BEST_PRICE",
  };

  const res = await fetch("https://trade-api.gateway.uniswap.org/v1/quote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "x-universal-router-version": "2.0",
      "x-agent-info": AGENT_INFO,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Quote request failed:", res.status, JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));

  console.log("\n--- Summary ---");
  console.log("routing:", data.routing);
  if (data.routing === "CLASSIC" || data.routing === "WRAP" || data.routing === "UNWRAP") {
    console.log("output amount (raw WETH, 18 dec):", data.quote?.output?.amount);
  } else {
    const first = data.quote?.orderInfo?.outputs?.[0];
    console.log("output amount (best-case startAmount, raw WETH):", first?.startAmount);
    console.log("output amount (floor endAmount, raw WETH):", first?.endAmount);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
