// Single-purpose script: execute ONE live swap on Sepolia via the Uniswap
// Trading API. 25 USDC (25000000 raw, 6 dec) -> WETH, 0.5% slippage.
// Flow: check_approval -> quote -> swap -> sign (permit if needed) -> broadcast -> wait receipt.
//
// Non-interactive run, pre-authorised by the operator for exactly this one
// operation (25 USDC -> WETH, 0.5% slippage). Where the skill calls for
// AskUserQuestion before broadcasting, that confirmation is what's already
// been given for this run — noted here instead of prompting.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  isHex,
  parseAbi,
  formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

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
const RPC_URL = env.SEPOLIA_RPC_URL;
const PK = env.SEPOLIA_BURNER_PK;
if (!API_KEY) throw new Error("UNISWAP_API_KEY missing from .env");
if (!RPC_URL) throw new Error("SEPOLIA_RPC_URL missing from .env");
if (!PK) throw new Error("SEPOLIA_BURNER_PK missing from .env");

const API_URL = "https://trade-api.gateway.uniswap.org/v1";
const CHAIN_ID = 11155111;
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
const AMOUNT_RAW = "25000000"; // 25 USDC, 6 decimals

for (const addr of [USDC, WETH]) {
  if (!isAddress(addr)) throw new Error(`Invalid address: ${addr}`);
}

const AGENT_INFO = JSON.stringify({
  integration_name: "swap-integration",
  decision_origin: "autonomous",
  version: "1.5.0",
});

const account = privateKeyToAccount(PK as `0x${string}`);
if (account.address.toLowerCase() !== "0xeeb84a3a4b4930311dd7385c10559bd309944b3f") {
  throw new Error(`Unexpected signer address: ${account.address}`);
}

const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
]);

const STATE_DIR = join(import.meta.dirname, ".state");
mkdirSync(STATE_DIR, { recursive: true });

function saveState(name: string, data: unknown) {
  writeFileSync(join(STATE_DIR, name), JSON.stringify(data, null, 2));
}

function isUniswapXRouting(routing: string): boolean {
  return routing === "DUTCH_V2" || routing === "DUTCH_V3" || routing === "PRIORITY";
}

function prepareSwapRequest(quoteResponse: any, signature?: string): Record<string, unknown> {
  const { permitData, permitTransaction, ...cleanQuote } = quoteResponse;
  const request: Record<string, unknown> = { ...cleanQuote };

  if (isUniswapXRouting(quoteResponse.routing)) {
    if (signature) request.signature = signature;
  } else {
    if (signature && permitData && typeof permitData === "object") {
      request.signature = signature;
      request.permitData = permitData;
    }
  }
  return request;
}

async function tradingApi(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
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
    throw new Error(`${path} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  console.log("=== Step 0: pre-swap balances ===");
  const wethBefore: bigint = await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log("WETH before:", formatUnits(wethBefore, 18));

  console.log("\n=== Step 1: check_approval ===");
  const approvalData = await tradingApi("/check_approval", {
    walletAddress: account.address,
    token: USDC,
    amount: AMOUNT_RAW,
    chainId: CHAIN_ID,
  });
  saveState("1-check_approval.json", approvalData);
  console.log(JSON.stringify(approvalData, null, 2));

  if (approvalData.approval) {
    console.log("\nApproval needed. Broadcasting approval tx...");
    // (Would normally AskUserQuestion here before spending gas; pre-authorised for this run.)
    const approvalHash = await walletClient.sendTransaction({
      to: approvalData.approval.to,
      data: approvalData.approval.data,
      value: BigInt(approvalData.approval.value || "0"),
    });
    console.log("approval tx hash:", approvalHash);
    const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });
    console.log("approval receipt status:", approvalReceipt.status);
    saveState("1b-approval-receipt.json", {
      hash: approvalHash,
      status: approvalReceipt.status,
      blockNumber: approvalReceipt.blockNumber.toString(),
    });
  } else {
    console.log("Token already approved. Skipping approval tx.");
  }

  console.log("\n=== Step 2: quote ===");
  const quoteResponse = await tradingApi("/quote", {
    swapper: account.address,
    tokenIn: USDC,
    tokenOut: WETH,
    tokenInChainId: String(CHAIN_ID),
    tokenOutChainId: String(CHAIN_ID),
    amount: AMOUNT_RAW,
    type: "EXACT_INPUT",
    slippageTolerance: 0.5,
    routingPreference: "BEST_PRICE",
  });
  saveState("2-quote.json", quoteResponse);
  console.log("routing:", quoteResponse.routing);
  console.log(JSON.stringify(quoteResponse, null, 2));

  console.log("\n=== Step 3: sign permitData (if present) ===");
  let signature: string | undefined;
  if (quoteResponse.permitData && typeof quoteResponse.permitData === "object") {
    const { domain, types, values, primaryType } = quoteResponse.permitData;
    // viem's signTypedData needs a primaryType; derive it if not provided
    // (Permit2 permitData typically has exactly one non-EIP712Domain type key).
    const derivedPrimaryType =
      primaryType ||
      Object.keys(types).find((k) => k !== "EIP712Domain");
    if (!derivedPrimaryType) throw new Error("Could not determine primaryType for permitData signature");
    signature = await walletClient.signTypedData({
      account,
      domain,
      types,
      primaryType: derivedPrimaryType,
      message: values,
    });
    console.log("signed permitData, primaryType:", derivedPrimaryType);
    saveState("3-signature.json", { primaryType: derivedPrimaryType, signature });
  } else {
    console.log("No permitData returned by quote — no signature needed.");
  }

  console.log("\n=== Step 4: swap ===");
  const swapRequest = prepareSwapRequest(quoteResponse, signature);
  const swapData = await tradingApi("/swap", swapRequest);
  saveState("4-swap.json", swapData);
  console.log(JSON.stringify(swapData, null, 2));

  const swap = swapData.swap;
  if (!swap?.data || swap.data === "" || swap.data === "0x") {
    throw new Error("swap.data is empty - quote may have expired");
  }
  if (!isHex(swap.data)) throw new Error("swap.data is not valid hex");
  if (!isAddress(swap.to) || !isAddress(swap.from)) {
    throw new Error("Invalid address in swap response");
  }

  console.log("\n=== Step 5: broadcast ===");
  // (Would normally AskUserQuestion here before broadcasting; pre-authorised for this run:
  //  one swap of 25 USDC -> WETH, 0.5% slippage.)
  const hash = await walletClient.sendTransaction({
    to: swap.to,
    data: swap.data,
    value: BigInt(swap.value || "0"),
  });
  console.log("swap tx hash:", hash);

  console.log("\n=== Step 6: wait for receipt ===");
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("status:", receipt.status);
  console.log("blockNumber:", receipt.blockNumber.toString());
  console.log("gasUsed:", receipt.gasUsed.toString());

  const wethAfter: bigint = await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  const wethReceived = wethAfter - wethBefore;

  const summary = {
    txHash: hash,
    status: receipt.status,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    wethBefore: formatUnits(wethBefore, 18),
    wethAfter: formatUnits(wethAfter, 18),
    wethReceived_raw: wethReceived.toString(),
    wethReceived_human: formatUnits(wethReceived, 18),
    routing: quoteResponse.routing,
  };
  saveState("5-summary.json", summary);

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
