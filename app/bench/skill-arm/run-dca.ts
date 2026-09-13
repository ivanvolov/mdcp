/**
 * dca-bot run — single self-contained invocation.
 *
 * Follows bench/skill-arm/skills/{dca-bot,execution-model,strategy-state,
 * swap-integration,viem-integration}.md. Deviation noted in CONTEXT.md: the
 * Trading API is unavailable here (needs an interactive-login API key), so
 * execution goes through the on-chain path the skills also document —
 * QuoterV2 for pricing and SwapRouter02 for the swap — with the same
 * shape as the Trading API flow: check_approval -> quote -> swap.
 *
 * Execution mode: `confirm`, pre-authorized by the operator for this one run
 * (50 USDC -> WETH, 0.5% slippage). See the report printed at the end for
 * where AskUserQuestion / per-tx confirmation would normally have fired.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  formatUnits,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ---- Template inputs (from CONTEXT.md; the "selected target-chain template") ----
const RPC_URL = "http://127.0.0.1:8545";
const CHAIN_ID = 1;
const PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const; // 6 decimals
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const; // 18 decimals
const QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e" as const;
const SWAP_ROUTER_02 = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45" as const;
const CANDIDATE_FEE_TIERS = [500, 3000, 10000] as const; // 0.05%, 0.3%, 1%

// ---- Task inputs (pre-authorized single run) ----
const BUY_AMOUNT_USDC = "50"; // human units
const SLIPPAGE_BPS = 50n; // 0.5% -> amountOutMinimum = quote * (10000-50)/10000

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
  ["QUOTER_V2", QUOTER_V2],
  ["SWAP_ROUTER_02", SWAP_ROUTER_02],
].forEach(([label, addr]) => assertAddress(addr, label));
assertAmount(BUY_AMOUNT_USDC, "BUY_AMOUNT_USDC");
if (CHAIN_ID !== mainnet.id) throw new Error("chain id mismatch with template");

// ---- State (per strategy-state.md) ----
const STATE_DIR = process.env.STATE_DIR || join(import.meta.dirname, ".state");
const STATE_FILE = join(STATE_DIR, "dca-bot.json");

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
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
]);

const quoterV2Abi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const swapRouter02Abi = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
]);

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

  // ---- Step 6 (guardrails: funding check) ----
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

  // ---- Step 3/5/7 (on-chain path, standing in for Trading API /quote): quote across fee tiers ----
  let bestFee: number | null = null;
  let bestQuote: bigint | null = null;
  for (const fee of CANDIDATE_FEE_TIERS) {
    try {
      const sim = await publicClient.simulateContract({
        address: QUOTER_V2,
        abi: quoterV2Abi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: USDC,
            tokenOut: WETH,
            amountIn,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
        account: account.address,
      });
      const [amountOut] = sim.result;
      if (bestQuote === null || amountOut > bestQuote) {
        bestQuote = amountOut;
        bestFee = fee;
      }
    } catch {
      // pool for this fee tier may not exist / no liquidity — try next tier
    }
  }

  if (bestFee === null || bestQuote === null) {
    const result = { outcome: "failed", reason: "no viable USDC/WETH pool found across candidate fee tiers" };
    state.lastAction = { type: "skip", amount: BUY_AMOUNT_USDC, error: result.reason };
    state.lastRunAt = new Date().toISOString();
    writeState(state);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const amountOutMinimum = (bestQuote * (10000n - SLIPPAGE_BPS)) / 10000n;

  // ---- Step 4 (allowance: legacy/backend pattern — approve directly to router, exact amount) ----
  const allowance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SWAP_ROUTER_02],
  });

  let approvalTxHash: string | undefined;
  if (allowance < amountIn) {
    // NOTE: in `confirm` execution mode this is where the per-transaction
    // AskUserQuestion gate would normally fire before broadcasting the
    // approval. Pre-authorized by the operator for this run.
    const { request } = await publicClient.simulateContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [SWAP_ROUTER_02, amountIn],
      account,
    });
    approvalTxHash = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash: approvalTxHash as `0x${string}` });
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

  const { request: swapRequest, result: simulatedAmountOut } = await publicClient.simulateContract({
    address: SWAP_ROUTER_02,
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: USDC,
        tokenOut: WETH,
        fee: bestFee,
        recipient: account.address,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
    account,
  });

  const swapTxHash = await walletClient.writeContract(swapRequest);
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
        feeTier: bestFee,
        quotedAmountOutWei: bestQuote.toString(),
        amountOutMinimumWei: amountOutMinimum.toString(),
        simulatedAmountOutWei: simulatedAmountOut.toString(),
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
