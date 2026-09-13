/**
 * The canonical tool registry.
 *
 * Both servers expose exactly this capability set:
 *   - mcp-baseline.ts registers each entry as its own MCP tool (the usual way)
 *   - mcp-mdcp.ts hides them behind one `execute` tool and reaches them from
 *     inside the sandbox
 *
 * Keeping one registry is what makes the benchmark fair: the only thing that
 * differs between the two runs is how the agent reaches these functions.
 */
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import * as chain from "./chain.js";
import * as api from "./tradingApi.js";

/**
 * "chain" is the only class that moves funds and therefore the only one gated
 * behind operator approval. "local" still mutates something (a state file) but
 * is replayable and costs nothing, so gating it would add approval round-trips
 * that protect nobody.
 */
export type SideEffect = "view" | "local" | "chain";

export interface ToolDef {
  path: string;
  summary: string;
  /** Compact TypeScript signature — what the sandbox sees. Cheaper than JSON Schema. */
  signature: string;
  schema: z.ZodTypeAny;
  sideEffect: SideEffect;
  /**
   * Argument fields that identify the *economic intent* of a chain write.
   *
   * Deliberately excludes volatile fields such as `amountOutMinimum`: that bound
   * is re-derived from a fresh quote on every run, so hashing it would make the
   * same intent look new after the pool price moves — and a resumed run would
   * broadcast a second transaction. Learned the hard way; see bench/e2e.ts.
   */
  intentFields?: string[];
  /**
   * Extra fields merged over the generic planning stub. HTS pipelines feed one
   * receipt into the next call (createToken -> tokenId -> transfer), so the
   * planning pass must hand back something shaped like the real receipt or the
   * program dereferences undefined mid-plan.
   */
  planStub?: Record<string, unknown>;
  invoke: (args: any) => Promise<unknown>;
}

const STATE_DIR = process.env.STATE_DIR ?? path.join(process.cwd(), ".state");

function statePath(name: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error(`invalid_state_name: ${name}`);
  return path.join(STATE_DIR, `${name}.json`);
}

export const TOOLS: ToolDef[] = [
  {
    path: "chain.block",
    summary: "Current block number and timestamp.",
    signature: "chain.block(): { number: string; timestamp: string; isoTime: string }",
    schema: z.object({}),
    sideEffect: "view",
    invoke: () => chain.blockInfo(),
  },
  {
    path: "token.info",
    summary: "Resolve a token symbol or address to its address, symbol and decimals.",
    signature:
      "token.info(a: { token: string }): { address: string; symbol: string; decimals: number }",
    schema: z.object({ token: z.string() }),
    sideEffect: "view",
    invoke: (a) => chain.tokenInfo(a.token),
  },
  {
    path: "wallet.balances",
    summary: "Native and known-token balances for the agent wallet (raw units).",
    signature:
      "wallet.balances(a?: { owner?: string }): { address: string; native: string; tokens: Record<string,string> }",
    schema: z.object({ owner: z.string().optional() }),
    sideEffect: "view",
    invoke: (a) => chain.balances(a?.owner),
  },
  {
    path: "uniswap.quote",
    summary: "Uniswap v3 exact-input quote via QuoterV2. Amounts are raw units.",
    signature:
      "uniswap.quote(a: { tokenIn: string; tokenOut: string; amountIn: string; fee?: number }): { amountOut: string; gasEstimate: string; fee: number }",
    schema: z.object({
      tokenIn: z.string(),
      tokenOut: z.string(),
      amountIn: z.string(),
      fee: z.number().optional(),
    }),
    sideEffect: "view",
    invoke: (a) => chain.quote(a),
  },
  {
    path: "uniswap.poolState",
    summary:
      "Depth and price of one v3 pool (one pair, one fee tier). Compare tiers to pick a venue.",
    signature:
      "uniswap.poolState(a: { tokenA: string; tokenB: string; fee: number }): { exists: boolean; pool: string; liquidity: string; sqrtPriceX96?: string; tick?: number }",
    schema: z.object({ tokenA: z.string(), tokenB: z.string(), fee: z.number() }),
    sideEffect: "view",
    invoke: (a) => chain.poolState(a),
  },
  {
    path: "wallet.swapHistory",
    summary:
      "Swaps a wallet received recently, decoded from pool logs. Input for copy-trading a leader.",
    signature:
      "wallet.swapHistory(a: { address: string; blocks?: number }): { address: string; fromBlock: string; toBlock: string; swaps: { pool: string; fee: number; pair: string; blockNumber: string; txHash: string; amount0: string; amount1: string }[] }",
    schema: z.object({ address: z.string(), blocks: z.number().optional() }),
    sideEffect: "view",
    invoke: (a) => chain.swapHistory(a),
  },
  {
    path: "uniswap.apiQuote",
    summary: "Live quote from the production Uniswap Trading API (BEST_PRICE routing).",
    signature:
      "uniswap.apiQuote(a: { tokenIn: string; tokenOut: string; amountIn: string }): { routing: string; amountOut: string; minimumAmountOut: string; gasFeeUSD: string; rawResponseBytes: number }",
    schema: z.object({ tokenIn: z.string(), tokenOut: z.string(), amountIn: z.string() }),
    sideEffect: "view",
    invoke: (a) => api.apiQuote(a),
  },
  {
    path: "uniswap.apiSwap",
    summary:
      "Full Trading API swap: check_approval -> quote -> permit -> swap tx, signed host-side and broadcast. One intent.",
    signature:
      "uniswap.apiSwap(a: { tokenIn: string; tokenOut: string; amountIn: string }): { routing: string; txHash: string; status: string; amountOut: string; approvalTxHash: string | null; rawApiBytesAbsorbed: number }",
    schema: z.object({ tokenIn: z.string(), tokenOut: z.string(), amountIn: z.string() }),
    sideEffect: "chain",
    intentFields: ["tokenIn", "tokenOut", "amountIn"],
    invoke: (a) => api.apiSwap(a),
  },
  {
    path: "token.allowance",
    summary: "ERC-20 allowance granted by the agent wallet to a spender (defaults to the router).",
    signature:
      "token.allowance(a: { token: string; spender?: string }): { allowance: string; spender: string }",
    schema: z.object({ token: z.string(), spender: z.string().optional() }),
    sideEffect: "view",
    invoke: (a) => chain.allowance(a),
  },
  {
    path: "token.approve",
    summary: "Approve an exact amount of an ERC-20 to a spender. Unlimited approvals are refused.",
    signature:
      "token.approve(a: { token: string; amount: string; spender?: string }): { txHash: string; status: string }",
    schema: z.object({
      token: z.string(),
      amount: z.string(),
      spender: z.string().optional(),
    }),
    sideEffect: "chain",
    intentFields: ["token", "amount", "spender"],
    invoke: (a) => chain.approve(a),
  },
  {
    path: "uniswap.swap",
    summary:
      "Execute a Uniswap v3 exact-input swap. amountOutMinimum is the slippage bound and is mandatory.",
    signature:
      "uniswap.swap(a: { tokenIn: string; tokenOut: string; amountIn: string; amountOutMinimum: string; fee?: number }): { txHash: string; status: string; gasUsed: string }",
    schema: z.object({
      tokenIn: z.string(),
      tokenOut: z.string(),
      amountIn: z.string(),
      amountOutMinimum: z.string(),
      fee: z.number().optional(),
    }),
    sideEffect: "chain",
    intentFields: ["tokenIn", "tokenOut", "amountIn", "fee"],
    invoke: (a) => chain.swap(a),
  },
  {
    path: "state.read",
    summary: "Read a strategy state file. Returns null when it does not exist yet.",
    signature: "state.read(a: { name: string }): unknown | null",
    schema: z.object({ name: z.string() }),
    sideEffect: "view",
    invoke: async (a) => {
      const p = statePath(a.name);
      if (!fs.existsSync(p)) return null;
      return JSON.parse(fs.readFileSync(p, "utf8"));
    },
  },
  {
    path: "state.write",
    summary: "Write a strategy state file (used for DCA idempotency).",
    signature: "state.write(a: { name: string; data: unknown }): { written: true }",
    schema: z.object({ name: z.string(), data: z.any() }),
    sideEffect: "local",
    invoke: async (a) => {
      fs.mkdirSync(STATE_DIR, { recursive: true });
      fs.writeFileSync(statePath(a.name), JSON.stringify(a.data, null, 2));
      return { written: true };
    },
  },
];

/**
 * HTS family — Hedera Token Service on live testnet, wrapping src/hedera.ts.
 *
 * Registered only when a Hedera operator key is configured, so the EVM bench
 * arms keep a byte-identical catalog to the recorded runs. The SDK is imported
 * lazily for the same reason: no Hedera scenario, no protobuf startup cost.
 *
 * intentFields deliberately exclude ids minted earlier in the same program
 * (tokenId, accountId): during the planning pass those are stub values, and
 * hashing them would make every real intent look new on resume — the same rule
 * that keeps amountOutMinimum out of swap intents.
 */
const hedera = () => import("./hedera.js");

const HTS_TOOLS: ToolDef[] = [
  {
    path: "hts.network",
    summary: "Hedera network, operator account id, and its HBAR balance.",
    signature: "hts.network(): { network: string; operatorId: string; hbarBalance: string }",
    schema: z.object({}),
    sideEffect: "view",
    invoke: async () => (await hedera()).networkInfo(),
  },
  {
    path: "hts.tokenInfo",
    summary: "Token metadata from the mirror node (lags writes by ~3s).",
    signature:
      "hts.tokenInfo(a: { tokenId: string }): { tokenId: string; name: string; symbol: string; type: string; decimals: number; totalSupply: string; treasury: string }",
    schema: z.object({ tokenId: z.string() }),
    sideEffect: "view",
    invoke: async (a) => (await hedera()).tokenInfo(a),
  },
  {
    path: "hts.balances",
    summary: "HBAR and token balances of an account (defaults to the operator).",
    signature:
      "hts.balances(a?: { accountId?: string }): { accountId: string; hbar: string; tokens: Record<string,string> }",
    schema: z.object({ accountId: z.string().optional() }),
    sideEffect: "view",
    invoke: async (a) => (await hedera()).accountBalances(a),
  },
  {
    path: "hts.createToken",
    summary:
      "Create an HTS token (fungible or NFT collection). Treasury is the operator; admin+supply keys are set host-side.",
    signature:
      "hts.createToken(a: { name: string; symbol: string; decimals?: number; initialSupply?: string; tokenType?: 'fungible'|'nft'; maxSupply?: string }): { tokenId: string; status: string; txId: string; hashscanUrl: string }",
    schema: z.object({
      name: z.string(),
      symbol: z.string(),
      decimals: z.number().optional(),
      initialSupply: z.string().optional(),
      tokenType: z.enum(["fungible", "nft"]).optional(),
      maxSupply: z.string().optional(),
    }),
    sideEffect: "chain",
    intentFields: ["name", "symbol", "tokenType"],
    planStub: { tokenId: "0.0.0-planned" },
    invoke: async (a) => (await hedera()).createToken(a),
  },
  {
    path: "hts.mint",
    summary:
      "Mint supply: amount for fungible, metadata array (one per serial) for NFTs.",
    signature:
      "hts.mint(a: { tokenId: string; amount?: string; metadata?: string[] }): { status: string; txId: string; newTotalSupply?: string; serials?: string[] }",
    schema: z.object({
      tokenId: z.string(),
      amount: z.string().optional(),
      metadata: z.array(z.string()).optional(),
    }),
    sideEffect: "chain",
    intentFields: ["amount", "metadata"],
    planStub: { newTotalSupply: "0", serials: ["1"] },
    invoke: async (a) => (await hedera()).mint(a),
  },
  {
    path: "hts.createAccount",
    summary:
      "Create a Hedera account with a host-generated key (key never enters the sandbox). Use as recipient in demos.",
    signature:
      "hts.createAccount(a?: { initialHbar?: number; maxAutoAssociations?: number }): { accountId: string; status: string; txId: string }",
    schema: z.object({
      initialHbar: z.number().optional(),
      maxAutoAssociations: z.number().optional(),
    }),
    sideEffect: "chain",
    intentFields: ["maxAutoAssociations"],
    planStub: { accountId: "0.0.0-planned" },
    invoke: async (a) => (await hedera()).createAccount(a),
  },
  {
    path: "hts.associate",
    summary:
      "Associate an account with a token before it can receive it. Signed host-side with the account's stored key.",
    signature:
      "hts.associate(a: { accountId: string; tokenId: string }): { status: string; txId: string }",
    schema: z.object({ accountId: z.string(), tokenId: z.string() }),
    sideEffect: "chain",
    intentFields: [],
    invoke: async (a) => (await hedera()).associate(a),
  },
  {
    path: "hts.transfer",
    summary:
      "Transfer HTS tokens (amount, fungible) or one NFT (serial). Debit/credit legs net to zero by construction.",
    signature:
      "hts.transfer(a: { tokenId: string; to: string; amount?: string; serial?: number; from?: string }): { status: string; txId: string; hashscanUrl: string }",
    schema: z.object({
      tokenId: z.string(),
      to: z.string(),
      amount: z.string().optional(),
      serial: z.number().optional(),
      from: z.string().optional(),
    }),
    sideEffect: "chain",
    intentFields: ["amount", "serial"],
    invoke: async (a) => (await hedera()).transfer(a),
  },
];

if (process.env.HEDERA_OPERATOR_KEY) TOOLS.push(...HTS_TOOLS);

export const TOOL_BY_PATH = new Map(TOOLS.map((t) => [t.path, t]));

/**
 * Late registration for tools discovered at runtime (MCP upstreams). The
 * catalog stays one registry — both servers and the sandbox see the same set —
 * it just grows after an upstream handshake.
 */
export function registerTools(defs: ToolDef[]) {
  for (const def of defs) {
    if (TOOL_BY_PATH.has(def.path)) continue;
    TOOLS.push(def);
    TOOL_BY_PATH.set(def.path, def);
  }
}

/** JSON-safe: bigints never survive JSON.stringify otherwise. */
export function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}
