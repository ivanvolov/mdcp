#!/usr/bin/env node
/**
 * mdcp — the code-mode server.
 *
 * Three tools regardless of how many chain capabilities exist behind them. The
 * agent writes one TypeScript program; the loop between quote, allowance,
 * approval and swap happens inside the sandbox instead of inside the model's
 * context.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execute, resume, catalogSignatures } from "./sandbox.js";
import { profileWants } from "./tools.js";
import { bytesOf, logSurface } from "./instrument.js";

// Upstream tools must land in the catalog before the execute description is
// built, so their signatures appear in the surface the model sees.
// A judge mounting one track should not lose the server because a different
// track's upstream is unreachable, so each mount is best-effort and reports to
// stderr rather than aborting startup.
if (profileWants("graph")) {
  try {
    const { ensureGraphTools } = await import("./graphUpstream.js");
    await ensureGraphTools();
  } catch (e) {
    console.error(`[mdcp] graph upstream unavailable, graph.* not mounted: ${e}`);
  }
}

if (profileWants("mirror")) {
  try {
    const { ensureMirrorTools } = await import("./hederaUpstream.js");
    const { registerTools } = await import("./tools.js");
    registerTools(await ensureMirrorTools());
  } catch (e) {
    console.error(`[mdcp] mirror-node upstream unavailable, mirror.* not mounted: ${e}`);
  }
}

const server = new McpServer({ name: "mdcp", version: "0.1.0" });

const EXECUTE_DESCRIPTION = `Run a TypeScript program against the connected chain integrations.

Call every capability as an async function on \`tools\`, e.g.
  const q = await tools["uniswap.quote"]({ tokenIn: "USDC", tokenOut: "WETH", amountIn: "50000000" });
Then \`return\` only the values you actually need — intermediate data stays in the
sandbox and never enters your context.

Available capabilities:
${catalogSignatures()}

Rules:
- Amounts are raw integer strings (USDC has 6 decimals, WETH 18).
- A \`write\` capability suspends the run for operator approval. You get back
  { status: "awaiting_approval", approval: { executionId, ... } }; call
  \`resume\` with that id. Work already done is NOT repeated, and a transaction
  that already landed is never sent twice.
- Errors come back as data, not exceptions you must guess about.`;

server.tool(
  "execute",
  EXECUTE_DESCRIPTION,
  { code: z.string().describe("TypeScript program body. Use await and return a result.") },
  async ({ code }) => {
    const outcome = await execute(code);
    return { content: [{ type: "text", text: JSON.stringify(outcome) }] };
  },
);

server.tool(
  "resume",
  "Approve or reject a suspended execution and continue it where it stopped.",
  {
    executionId: z.string(),
    approve: z.boolean().describe("true to sign and continue, false to abort"),
  },
  async ({ executionId, approve }) => {
    const outcome = await resume(executionId, approve);
    return { content: [{ type: "text", text: JSON.stringify(outcome) }] };
  },
);

server.tool(
  "skills",
  "Read the calling convention, the policy model, the signing model, or how to query The Graph.",
  { topic: z.enum(["execute", "policies", "signing", "graph"]) },
  async ({ topic }) => {
    const { SKILLS } = await import("./skills.js");
    return { content: [{ type: "text", text: SKILLS[topic] ?? "unknown topic" }] };
  },
);

logSurface(
  "mdcp",
  bytesOf(EXECUTE_DESCRIPTION) + bytesOf("resume") + bytesOf("skills"),
  3,
);

await server.connect(new StdioServerTransport());
