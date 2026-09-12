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

export const TOOL_BY_PATH = new Map(TOOLS.map((t) => [t.path, t]));

/** JSON-safe: bigints never survive JSON.stringify otherwise. */
export function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}
