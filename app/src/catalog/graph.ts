/**
 * The Graph integration (Graph AI-tooling prize target):
 * subgraph discovery + GraphQL querying from inside the sandbox — pool/token
 * discovery feeds the Uniswap pipeline without any schema reaching the model.
 * TODO(h10-13): wire Subgraph Studio / Graph Market endpoints.
 */
import type { ToolDef } from "./index.js";

const todo = async () => ({ ok: false, error: { code: "not_implemented", retryable: false } });

export const graphTools: ToolDef[] = [
  {
    path: "graph.default.arbitrum.top_pools",
    summary: "Top Uniswap pools by TVL/volume from the standardized Uniswap subgraph",
    inputTS: "{ token0?: Address; token1?: Address; orderBy: 'tvl'|'volume'; limit?: number }",
    outputTS: "{ pools: { id: Address; feeTier: number; tvlUSD: number; volumeUSD: number }[] }",
    sideEffect: "view",
    invoke: todo,
  },
  {
    path: "graph.default.any.query",
    summary: "Raw GraphQL query against any allow-listed subgraph deployment",
    inputTS: "{ subgraph: string; query: string; variables?: Record<string, unknown> }",
    outputTS: "{ data: unknown }",
    sideEffect: "view",
    invoke: todo,
  },
];
