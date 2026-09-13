/**
 * dca-bot run — Trading API arm, single self-contained invocation.
 *
 * Follows bench/skill-arm/skills/{dca-bot,execution-model,strategy-state,
 * swap-integration,viem-integration}.md, executing via the Uniswap Trading
 * API path (check_approval -> quote -> swap) as swap-integration prescribes,
 * with viem used only for signing/broadcast/receipt-waiting per
 * viem-integration. This is the "dca-api" state key, distinct from the
 * on-chain-quoter arm's "dca-bot" state key (bench/skill-arm/run-dca.ts).
 *
 * Fork-specific deviation (per the operator's environment note, not a skill
 * deviation): broadcast uses node-estimated gas rather than trusting the
 * API's gasLimit, since the API estimates against live mainnet warm storage
 * and this is a local fork.
 *
 * Execution mode: `confirm`, pre-authorized by the operator for this one run
 * (50 USDC -> WETH, 0.5% slippage). Comments mark where AskUserQuestion /
 * per-transaction confirmation would normally fire.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  formatUnits,
  isAddress,
  isHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Minimal .env loader (no dotenv dependency in this project) — only fills
// vars not already set in the environment.
function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvFile(join(import.meta.dirname, "..", "..", ".env"));

// ---- Template inputs (selected target-chain template: Ethereum mainnet fork) ----
const RPC_URL = "http://127.0.0.1:8545";
const CHAIN_ID = 1;
const PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const; // 6 decimals
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const; // 18 decimals

const API_URL = "https://trade-api.gateway.uniswap.org/v1";
const API_KEY = process.env.UNISWAP_API_KEY;
if (!API_KEY) throw new Error("UNISWAP_API_KEY missing from environment (.env)");

// decision_origin: this run is a non-interactive scheduled DCA wake with no
// per-action human approval at execution time (operator pre-authorized the
// whole run) -> "autonomous" per swap-integration's Agent Attribution rules.
const AGENT_INFO = JSON.stringify({
  integration_name: "swap-integration",
  decision_origin: "autonomous",
  version: "1.5.0",
});

const TRADING_API_HEADERS = {
  "Content-Type": "application/json",
  "x-api-key": API_KEY,
  "x-universal-router-version": "2.0",
  "x-agent-info": AGENT_INFO,
};

// ---- Task inputs (pre-authorized single run) ----
const BUY_AMOUNT_USDC = "50"; // human units
const SLIPPAGE_TOLERANCE = 0.5; // percent, per skill instructions

// ---- Input validation (per skills' Input Validation Rules) ----
function assertAddress(a: string, label: string) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(a)) throw new Error(`${label} is not a valid address: ${a}`);
  if (!isAddress(a)) throw new Error(`${label} failed viem isAddress check: ${a}`);
}
function assertAmount(a: string, label: string) {
  if (!/^[0-9]+\.?[0-9]*$/.test(a)) throw new Error(`${label} is not a valid non-negative amount: ${a}`);
}
[
  ["USDC", USDC],
  ["WETH", WETH],
].forEach(([label, addr]) => assertAddress(addr, label));
assertAmount(BUY_AMOUNT_USDC, "BUY_AMOUNT_USDC");
if (CHAIN_ID !== mainnet.id) throw new Error("chain id mismatch with template");

// ---- State (per strategy-state.md) ----
const STATE_DIR = process.env.STATE_DIR || join(import.meta.dirname, ".state");
const STATE_FILE = join(STATE_DIR, "dca-api.json");

type State = {
  version: number;
  skill: string;
  chainId: number;
  lastRunAt?: string;
  lastBuyPeriod?: string;
  lastAction?: { type: string; txHash?: string; amount?: string; error?: string };
};

function readState(): State {
  if (!existsSync(STATE_FILE)) {
    return { version: 1, skill: "dca-bot", chainId: CHAIN_ID };
  }
  return JSON.parse(readFileSync(STATE_FILE, "utf8"));
}
function writeState(s: State) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + "\n");
}

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
]);

async function tradingApi(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: TRADING_API_HEADERS,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${data?.detail ?? JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: mainnet, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(RPC_URL) });

  // ---- Step 1 & 2: read state, check cadence/idempotency ----
  const state = readState();
  const todayUTC = new Date().toISOString().slice(0, 10); // daily cadence -> UTC day key

  if (state.lastBuyPeriod === todayUTC) {
    console.log(
      JSON.stringify(
        {
          outcome: "skipped",
          reason: "buy already recorded for today's UTC period",
          period: todayUTC,
          lastAction: state.lastAction,
        },
        null,
        2
      )
    );
    return;
  }

  const amountIn = (BigInt(Math.round(Number(BUY_AMOUNT_USDC))) * 10n ** 6n); // USDC has 6 decimals, whole-dollar amount

  // ---- Step 2/6 (guardrails: funding check) ----
  const usdcBalance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (usdcBalance < amountIn) {
    const result = {
      outcome: "skipped",
      reason: "insufficient USDC balance",
      required: formatUnits(amountIn, 6),
      available: formatUnits(usdcBalance, 6),
    };
    state.lastAction = { type: "skip", amount: BUY_AMOUNT_USDC, error: result.reason };
    state.lastRunAt = new Date().toISOString();
    writeState(state);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const ethBalance = await publicClient.getBalance({ address: account.address });
  if (ethBalance === 0n) {
    const result = { outcome: "skipped", reason: "no native gas token to broadcast" };
    state.lastAction = { type: "skip", amount: BUY_AMOUNT_USDC, error: result.reason };
    state.lastRunAt = new Date().toISOString();
    writeState(state);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // ---- Step 3: check_approval ----
  const approvalData = await tradingApi("/check_approval", {
    walletAddress: account.address,
    token: USDC,
    amount: amountIn.toString(),
    chainId: CHAIN_ID,
  });

  let approvalTxHash: `0x${string}` | undefined;
  if (approvalData.approval) {
    const approval = approvalData.approval;
    if (!isAddress(approval.to) || !isAddress(approval.from)) {
      throw new Error("check_approval returned invalid address");
    }
    // NOTE: in `confirm` execution mode this is where the per-transaction
    // AskUserQuestion gate would normally fire before broadcasting the
    // approval. Pre-authorized by the operator for this run.
    const gas = await publicClient.estimateGas({
      account,
      to: approval.to,
      data: approval.data,
      value: BigInt(approval.value || "0"),
    });
    approvalTxHash = await walletClient.sendTransaction({
      to: approval.to,
      data: approval.data,
      value: BigInt(approval.value || "0"),
      gas,
    });
    await publicClient.waitForTransactionReceipt({ hash: approvalTxHash });
  }

  // ---- Step 4: quote ----
  const quoteResponse = await tradingApi("/quote", {
    swapper: account.address,
    tokenIn: USDC,
    tokenOut: WETH,
    tokenInChainId: String(CHAIN_ID),
    tokenOutChainId: String(CHAIN_ID),
    amount: amountIn.toString(),
    type: "EXACT_INPUT",
    slippageTolerance: SLIPPAGE_TOLERANCE,
    // Force CLASSIC (on-chain AMM) routing via protocols, not routingPreference:
    // this is a local fork, so UniswapX's off-chain filler network (which
    // BEST_PRICE routing on mainnet typically returns) has no fillers watching
    // it and would never get an order filled.
    protocols: ["V2", "V3", "V4"],
  });

  const isUniswapX =
    quoteResponse.routing === "DUTCH_V2" ||
    quoteResponse.routing === "DUTCH_V3" ||
    quoteResponse.routing === "PRIORITY";

  // ---- Sign permitData if present (EIP-712) ----
  let signature: string | undefined;
  if (quoteResponse.permitData && typeof quoteResponse.permitData === "object") {
    const { domain, types, values } = quoteResponse.permitData;
    signature = await walletClient.signTypedData({
      account,
      domain,
      types,
      primaryType: "PermitSingle" in types ? "PermitSingle" : Object.keys(types).find((k) => k !== "EIP712Domain")!,
      message: values,
    });
  }

  // ---- Step 5: build /swap request (routing-aware permitData handling) ----
  const { permitData, permitTransaction, ...cleanQuote } = quoteResponse;
  const swapRequest: Record<string, unknown> = { ...cleanQuote };
  if (isUniswapX) {
    if (signature) swapRequest.signature = signature;
  } else {
    if (signature && permitData && typeof permitData === "object") {
      swapRequest.signature = signature;
      swapRequest.permitData = permitData;
    }
  }

  const swapData = await tradingApi("/swap", swapRequest);

  // ---- Pre-broadcast validation ----
  const swap = swapData.swap;
  if (!swap?.data || swap.data === "" || swap.data === "0x") {
    throw new Error("swap.data is empty - quote may have expired");
  }
  if (!isHex(swap.data)) throw new Error("swap.data is not valid hex");
  if (!isAddress(swap.to) || !isAddress(swap.from)) {
    throw new Error("Invalid address in swap response");
  }

  // ---- Step 7: execute swap ----
  // NOTE: in `confirm` execution mode this is where the per-transaction
  // AskUserQuestion gate would normally fire, showing token/amount/chain/gas
  // estimate before broadcast. Pre-authorized by the operator for this run
  // (50 USDC -> WETH, 0.5% slippage bound).
  const wethBalanceBefore = await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });

  // Fork-specific: let the node estimate gas rather than trusting the API's
  // gasLimit, which is estimated against live mainnet warm storage.
  const gas = await publicClient.estimateGas({
    account,
    to: swap.to,
    data: swap.data,
    value: BigInt(swap.value || "0"),
  });

  const swapTxHash = await walletClient.sendTransaction({
    to: swap.to,
    data: swap.data,
    value: BigInt(swap.value || "0"),
    gas,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: swapTxHash });

  const wethBalanceAfter = await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  const wethReceived = wethBalanceAfter - wethBalanceBefore;

  // ---- Step 8: update state ----
  state.lastRunAt = new Date().toISOString();
  state.lastBuyPeriod = todayUTC;
  state.lastAction = {
    type: "swap",
    txHash: swapTxHash,
    amount: BUY_AMOUNT_USDC,
  };
  writeState(state);

  console.log(
    JSON.stringify(
      {
        outcome: "executed",
        period: todayUTC,
        routing: quoteResponse.routing,
        approvalTxHash,
        swapTxHash,
        status: receipt.status,
        wethReceivedWei: wethReceived.toString(),
        wethReceived: formatUnits(wethReceived, 18),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
