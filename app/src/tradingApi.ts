/**
 * Uniswap Trading API client — the "level 2" execution path.
 *
 * Routing and calldata come from the real production API
 * (trade-api.gateway.uniswap.org); signing and broadcast stay host-side. On a
 * mainnet fork the API's mainnet transactions execute unmodified because the
 * fork keeps chainId 1.
 *
 * The gateway's job here is compression with receipts: a raw /quote response is
 * ~3KB; what a strategy needs from it is ~5 fields. We return the summary and
 * record the raw size so the benchmark can cite it.
 */
import { getAddress, parseAbi, type Address, type Hex } from "viem";
import { account, publicClient, walletClient, resolveToken, CHAIN_ID } from "./chain.js";

const ERC20 = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const PERMIT2 = getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3");

const PERMIT2_ABI = parseAbi([
  "function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
  "function approve(address token, address spender, uint160 amount, uint48 expiration)",
]);

/** uint48 max. Computed with BigInt on purpose: `(1 << 48) - 1` silently
 *  truncates to 32 bits in JS and yields 65535, which reads as "expired". */
const UINT48_MAX = (1n << 48n) - 1n;
const UINT160_MAX = (1n << 160n) - 1n;

/**
 * Ensure the router can pull `amount` of `token`, the "Legacy" way.
 *
 * swap-integration documents two approval targets: Permit2 (a fresh EIP-712
 * signature per swap, for frontends with a user present) and Legacy (approve
 * the Universal Router directly, once, no per-swap authorization) — explicitly
 * "for backend services". A gateway is a backend service, so Legacy is simply
 * the correct choice here.
 *
 * It is also the only one that survives a non-mainnet environment: the permit
 * nonce the API signs is read from live mainnet, so on a fork or a simulation
 * the second permit-consuming swap always reverts once local state diverges.
 */
async function ensureLegacyAllowance(token: Address, spender: Address, amount: bigint) {
  const hashes: Hex[] = [];

  // The router never pulls tokens directly — it goes through Permit2. So the
  // standing path is two approvals, not the one the skill's table implies:
  //   token -> Permit2 (ERC-20), then Permit2 -> router (AllowanceTransfer).
  const erc20Allowance = (await publicClient.readContract({
    address: token,
    abi: ERC20,
    functionName: "allowance",
    args: [account.address, PERMIT2],
  })) as bigint;

  if (erc20Allowance < amount) {
    const hash = await walletClient.writeContract({
      address: token,
      abi: ERC20,
      functionName: "approve",
      args: [PERMIT2, UINT160_MAX],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    hashes.push(hash);
  }

  const [allowed, expiration] = (await publicClient.readContract({
    address: PERMIT2,
    abi: PERMIT2_ABI,
    functionName: "allowance",
    args: [account.address, token, spender],
  })) as readonly [bigint, number, number];

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (allowed < amount || BigInt(expiration) <= now) {
    const hash = await walletClient.writeContract({
      address: PERMIT2,
      abi: PERMIT2_ABI,
      functionName: "approve",
      args: [token, spender, UINT160_MAX, Number(UINT48_MAX)],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    hashes.push(hash);
  }

  return hashes.length ? hashes[hashes.length - 1] : null;
}

const API = "https://trade-api.gateway.uniswap.org/v1";

function headers() {
  const key = process.env.UNISWAP_API_KEY;
  if (!key) throw new Error("missing_uniswap_api_key");
  return {
    "Content-Type": "application/json",
    "x-api-key": key,
    "x-universal-router-version": "2.0",
    // Attribution per the swap-integration skill. Our writes pause for operator
    // approval, so decision_origin is honestly human_mediated.
    "x-agent-info": JSON.stringify({
      integration_name: "mdcp",
      decision_origin: "human_mediated",
      version: "0.1.0",
    }),
  };
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`trading_api_${res.status}: ${text.slice(0, 300)}`);
  }
  return { data: JSON.parse(text), rawBytes: text.length };
}

/** Live quote from the production API. Read-only, no wallet required. */
export async function apiQuote(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
}) {
  const NATIVE0 = "0x0000000000000000000000000000000000000000";
  const { data, rawBytes } = await post("/quote", {
    swapper: account.address,
    tokenIn: params.tokenIn === NATIVE0 ? NATIVE0 : resolveToken(params.tokenIn),
    tokenOut: params.tokenOut === NATIVE0 ? NATIVE0 : resolveToken(params.tokenOut),
    tokenInChainId: String(CHAIN_ID),
    tokenOutChainId: String(CHAIN_ID),
    amount: params.amountIn,
    type: "EXACT_INPUT",
    slippageTolerance: 0.5,
    routingPreference: "BEST_PRICE",
  });
  const q = data.quote ?? {};
  return {
    routing: data.routing,
    amountOut: q.output?.amount ?? null,
    minimumAmountOut: q.output?.minimumAmount ?? null,
    gasFeeUSD: q.gasFeeUSD ?? null,
    // receipt of what the gateway absorbed so the model didn't have to
    rawResponseBytes: rawBytes,
  };
}

/**
 * Full API swap: check_approval -> quote -> permit signature -> /swap ->
 * sign & broadcast. One intent from the strategy's point of view.
 */
export async function apiSwap(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
}) {
  const NATIVE = "0x0000000000000000000000000000000000000000";
  const tokenIn =
    params.tokenIn === NATIVE ? NATIVE : resolveToken(params.tokenIn);
  const tokenOut =
    params.tokenOut === NATIVE ? NATIVE : resolveToken(params.tokenOut);
  let absorbed = 0;

  // 1. quote
  const quoteRes = await post("/quote", {
    swapper: account.address,
    tokenIn,
    tokenOut,
    tokenInChainId: String(CHAIN_ID),
    tokenOutChainId: String(CHAIN_ID),
    amount: params.amountIn,
    type: "EXACT_INPUT",
    slippageTolerance: 0.5,
    routingPreference: "BEST_PRICE",
  });
  absorbed += quoteRes.rawBytes;
  const { quote, routing } = quoteRes.data;
  if (routing !== "CLASSIC" && routing !== "WRAP" && routing !== "UNWRAP") {
    // UniswapX order flow needs an off-chain filler; out of scope here.
    throw new Error(`unsupported_routing: ${routing} (gateway handles CLASSIC/WRAP/UNWRAP)`);
  }

  // 2. build the swap tx. permitData/signature are omitted deliberately —
  //    this is the Legacy approval path (see ensureLegacyAllowance).
  const swapRes = await post("/swap", { quote });
  absorbed += swapRes.rawBytes;
  const tx = swapRes.data.swap;

  // 3. approve the router the tx actually targets, exact amount, once.
  let approvalHash: Hex | null = null;
  if (params.tokenIn !== NATIVE) {
    approvalHash = await ensureLegacyAllowance(
      tokenIn as Address,
      getAddress(tx.to),
      BigInt(params.amountIn),
    );
  }

  // 5. sign & broadcast (on the fork: chainId 1 matches mainnet-built calldata)
  // Deliberately ignore the API's gasLimit: it is estimated against live
  // mainnet warm/cold storage and can under-provision a fork. Let the node
  // estimate against the state it will actually execute in.
  const hash = await walletClient.sendTransaction({
    to: getAddress(tx.to),
    data: tx.data as Hex,
    value: BigInt(tx.value ?? 0),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return {
    routing,
    txHash: hash,
    status: receipt.status,
    gasUsed: receipt.gasUsed.toString(),
    approvalTxHash: approvalHash,
    amountOut: quote.output?.amount ?? null,
    minimumAmountOut: quote.output?.minimumAmount ?? null,
    rawApiBytesAbsorbed: absorbed,
  };
}
