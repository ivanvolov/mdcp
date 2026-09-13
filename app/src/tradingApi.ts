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
import { getAddress, type Hex } from "viem";
import { account, publicClient, walletClient, resolveToken, CHAIN_ID } from "./chain.js";

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

  // 1. approval (approves Permit2, not the router; native ETH needs none)
  const approvalRes = params.tokenIn === NATIVE
    ? { data: { approval: null }, rawBytes: 0 }
    : await post("/check_approval", {
    walletAddress: account.address,
    token: tokenIn,
    amount: params.amountIn,
    chainId: CHAIN_ID,
  });
  absorbed += approvalRes.rawBytes;
  const approvalTx = approvalRes.data.approval;
  let approvalHash: Hex | null = null;
  if (approvalTx) {
    approvalHash = await walletClient.sendTransaction({
      to: getAddress(approvalTx.to),
      data: approvalTx.data as Hex,
      value: BigInt(approvalTx.value ?? 0),
    });
    await publicClient.waitForTransactionReceipt({ hash: approvalHash });
  }

  // 2. quote (the full object must round-trip into /swap)
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
  const { quote, permitData, routing } = quoteRes.data;
  if (routing !== "CLASSIC" && routing !== "WRAP" && routing !== "UNWRAP") {
    // UniswapX order flow needs an off-chain filler; out of scope here.
    throw new Error(`unsupported_routing: ${routing} (gateway handles CLASSIC/WRAP/UNWRAP)`);
  }

  // 3. permit2 signature, if the API asks for one
  let permitPayload = {};
  if (permitData) {
    const signature = await account.signTypedData({
      domain: permitData.domain,
      types: permitData.types,
      primaryType: Object.keys(permitData.types).find((t) => t !== "EIP712Domain")!,
      message: permitData.values,
    });
    permitPayload = { permitData, signature };
  }

  // 4. build the swap tx
  const swapRes = await post("/swap", { quote, ...permitPayload });
  absorbed += swapRes.rawBytes;
  const tx = swapRes.data.swap;

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
