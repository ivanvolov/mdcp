/**
 * Chain layer: viem clients + Uniswap v3 read/write helpers.
 *
 * Deliberately thin. Both the baseline per-tool MCP server and the mdcp
 * code-mode server call exactly these functions, so a benchmark between the two
 * measures the *protocol shape*, not two different implementations.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  getAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

export const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";

/** Anvil's well-known account #0. Public test key — never holds real funds. */
const TEST_PK: Hex =
  (process.env.PRIVATE_KEY as Hex) ??
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export const account = privateKeyToAccount(TEST_PK);

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL),
});

export const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(RPC_URL),
});

export const ADDRESSES = {
  WETH: getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
  USDC: getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
  WBTC: getAddress("0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"),
  DAI: getAddress("0x6B175474E89094C44Da98b954EedeAC495271d0F"),
  LINK: getAddress("0x514910771AF9Ca656af840dff83E8264EcF986CA"),
  UNI: getAddress("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"),
  QUOTER_V2: getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e"),
  SWAP_ROUTER_02: getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),
} as const;

/** Symbol -> address, so agents can pass human names. */
export const TOKENS: Record<string, Address> = {
  WETH: ADDRESSES.WETH,
  USDC: ADDRESSES.USDC,
  WBTC: ADDRESSES.WBTC,
  DAI: ADDRESSES.DAI,
  LINK: ADDRESSES.LINK,
  UNI: ADDRESSES.UNI,
};

export function resolveToken(symbolOrAddress: string): Address {
  const upper = symbolOrAddress.toUpperCase();
  if (TOKENS[upper]) return TOKENS[upper];
  if (/^0x[a-fA-F0-9]{40}$/.test(symbolOrAddress)) return getAddress(symbolOrAddress);
  throw new Error(
    `unknown_token: ${symbolOrAddress} (known: ${Object.keys(TOKENS).join(", ")})`,
  );
}

const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const QUOTER_V2_ABI = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const SWAP_ROUTER_02_ABI = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)",
]);

const metaCache = new Map<Address, { symbol: string; decimals: number }>();

export async function tokenInfo(token: string) {
  const address = resolveToken(token);
  const cached = metaCache.get(address);
  if (cached) return { address, ...cached };
  const [symbol, decimals] = await Promise.all([
    publicClient.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }),
    publicClient.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }),
  ]);
  const meta = { symbol, decimals: Number(decimals) };
  metaCache.set(address, meta);
  return { address, ...meta };
}

export async function balances(owner?: string) {
  const who = owner ? getAddress(owner) : account.address;
  const [native, ...tokenBalances] = await Promise.all([
    publicClient.getBalance({ address: who }),
    ...Object.values(TOKENS).map((address) =>
      publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [who],
      }),
    ),
  ]);
  const tokens: Record<string, string> = {};
  Object.keys(TOKENS).forEach((symbol, i) => {
    tokens[symbol] = (tokenBalances[i] as bigint).toString();
  });
  return { address: who, native: native.toString(), tokens };
}

export async function quote(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  fee?: number;
}) {
  const tokenIn = resolveToken(params.tokenIn);
  const tokenOut = resolveToken(params.tokenOut);
  const fee = params.fee ?? 500;
  const { result } = await publicClient.simulateContract({
    address: ADDRESSES.QUOTER_V2,
    abi: QUOTER_V2_ABI,
    functionName: "quoteExactInputSingle",
    args: [
      {
        tokenIn,
        tokenOut,
        amountIn: BigInt(params.amountIn),
        fee,
        sqrtPriceLimitX96: 0n,
      },
    ],
    account: account.address,
  });
  const [amountOut, , , gasEstimate] = result as readonly [bigint, bigint, number, bigint];
  return {
    tokenIn,
    tokenOut,
    fee,
    amountIn: params.amountIn,
    amountOut: amountOut.toString(),
    gasEstimate: gasEstimate.toString(),
  };
}

export async function allowance(params: { token: string; spender?: string }) {
  const token = resolveToken(params.token);
  const spender = params.spender
    ? getAddress(params.spender)
    : ADDRESSES.SWAP_ROUTER_02;
  const value = await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, spender],
  });
  return { token, spender, allowance: value.toString() };
}

export async function approve(params: {
  token: string;
  amount: string;
  spender?: string;
}) {
  const token = resolveToken(params.token);
  const spender = params.spender
    ? getAddress(params.spender)
    : ADDRESSES.SWAP_ROUTER_02;
  const hash = await walletClient.writeContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, BigInt(params.amount)],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { txHash: hash, status: receipt.status, spender, amount: params.amount };
}

export async function swap(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOutMinimum: string;
  fee?: number;
}) {
  const tokenIn = resolveToken(params.tokenIn);
  const tokenOut = resolveToken(params.tokenOut);
  const hash = await walletClient.writeContract({
    address: ADDRESSES.SWAP_ROUTER_02,
    abi: SWAP_ROUTER_02_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn,
        tokenOut,
        fee: params.fee ?? 500,
        recipient: account.address,
        amountIn: BigInt(params.amountIn),
        amountOutMinimum: BigInt(params.amountOutMinimum),
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return {
    txHash: hash,
    status: receipt.status,
    gasUsed: receipt.gasUsed.toString(),
    blockNumber: receipt.blockNumber.toString(),
  };
}

export async function blockInfo() {
  const block = await publicClient.getBlock();
  return {
    number: block.number.toString(),
    timestamp: block.timestamp.toString(),
    isoTime: new Date(Number(block.timestamp) * 1000).toISOString(),
  };
}
