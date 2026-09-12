#!/usr/bin/env node
/**
 * mdcp — code-mode MCP gateway for DeFi.
 *
 * Agent-facing surface is deliberately tiny (the token win):
 *   execute(code)  — run TypeScript in a sandbox with a lazy `tools.*` proxy
 *   skills(name)   — lazily fetched docs (calling convention lives HERE, not
 *                    in the always-loaded tool description)
 *   resume(id)     — continue an execution paused for wallet approval
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runInSandbox, resumeExecution } from "./sandbox.js";
import { SKILLS } from "./skills.js";
import { catalog } from "./catalog/index.js";

const integrationNames = [...new Set(catalog.map((t) => t.path.split(".")[0]))];

const server = new McpServer({ name: "mdcp", version: "0.0.1" });

server.tool(
  "execute",
  // Keep this description SHORT — it is the only always-loaded context cost.
  `Execute TypeScript in a sandboxed runtime with on-chain tool access. ` +
    `Call skills({name:"execute"}) once for the calling convention. ` +
    `Connected integrations: ${integrationNames.join(", ")}.`,
  { code: z.string().describe("TypeScript source. Use the global `tools` proxy.") },
  async ({ code }) => {
    const result = await runInSandbox(code);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.tool(
  "skills",
  "Fetch documentation on demand (e.g. the execute calling convention).",
  { name: z.enum(["execute", "policies", "signing"]) },
  async ({ name }) => ({ content: [{ type: "text", text: SKILLS[name] }] }),
);

server.tool(
  "resume",
  "Resume an execution paused for wallet approval, by executionId.",
  { executionId: z.string() },
  async ({ executionId }) => {
    const result = await resumeExecution(executionId);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
