/**
 * Tool catalog: every on-chain action normalized to one manifest shape.
 * Addressing: <integration>.<owner>.<wallet-or-chain>.<action>
 */
export type SideEffect = "view" | "write" | "blocked";

export interface ToolDef {
  path: string; // e.g. "uniswap.default.sepolia.quote"
  summary: string; // one line, shown in search results
  inputTS: string; // compact TypeScript type (NOT JSON Schema)
  outputTS: string;
  sideEffect: SideEffect;
  invoke: (args: unknown) => Promise<unknown>;
}

import { uniswapTools } from "./uniswap.js";
import { graphTools } from "./graph.js";
import { walletTools } from "./wallet.js";

export const catalog: ToolDef[] = [...uniswapTools, ...graphTools, ...walletTools];

export function searchCatalog(query: string, limit = 8) {
  const q = query.toLowerCase().split(/\s+/);
  const scored = catalog
    .map((t) => ({
      t,
      score: q.filter((w) => (t.path + " " + t.summary).toLowerCase().includes(w)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return {
    items: scored.map(({ t }) => ({ path: t.path, summary: t.summary })),
    total: scored.length,
  };
}

export function describeTool(path: string) {
  const t = catalog.find((t) => t.path === path);
  if (!t) {
    const near = catalog
      .filter((c) => c.path.includes(path.split(".").pop() ?? ""))
      .map((c) => c.path)
      .slice(0, 5);
    return { ok: false as const, error: { code: "tool_not_found", suggestions: near } };
  }
  return { ok: true as const, inputTS: t.inputTS, outputTS: t.outputTS, sideEffect: t.sideEffect };
}
