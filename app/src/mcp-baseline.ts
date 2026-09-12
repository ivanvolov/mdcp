#!/usr/bin/env node
/**
 * BASELINE server — the conventional MCP shape.
 *
 * Every capability is its own MCP tool, so the agent reaches the chain the way
 * the Uniswap AI trading skills prescribe: one model round-trip per step
 * (balances -> quote -> allowance -> approve -> swap -> state), with every
 * argument and every result passing through the transcript.
 *
 * This is the control arm of the benchmark, not a straw man: it exposes the
 * exact same functions as mdcp, with the same validation.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TOOLS, jsonSafe } from "./tools.js";
import { bytesOf, logCall, logSurface } from "./instrument.js";

const server = new McpServer({ name: "uniswap-baseline", version: "0.1.0" });

let surfaceBytes = 0;

for (const tool of TOOLS) {
  const shape = (tool.schema as any)._def?.shape?.() ?? {};
  surfaceBytes += bytesOf({
    name: tool.path,
    description: tool.summary,
    inputSchema: Object.keys(shape),
  });

  server.tool(
    tool.path.replace(".", "_"),
    tool.summary,
    shape,
    async (args: any) => {
      const started = Date.now();
      let ok = true;
      let payload: unknown;
      try {
        payload = jsonSafe(await tool.invoke(args));
      } catch (error: any) {
        ok = false;
        payload = { error: String(error?.shortMessage ?? error?.message ?? error) };
      }
      const text = JSON.stringify(payload);
      logCall({
        server: "baseline",
        mcpTool: tool.path,
        argsBytes: bytesOf(args),
        resultBytes: bytesOf(text),
        durationMs: Date.now() - started,
        ok,
      });
      return { content: [{ type: "text" as const, text }] };
    },
  );
}

logSurface("baseline", surfaceBytes, TOOLS.length);

await server.connect(new StdioServerTransport());
