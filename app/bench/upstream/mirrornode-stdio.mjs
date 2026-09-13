#!/usr/bin/env bun
/**
 * stdio launcher for hedera-dev/mirrornode-mcp-server.
 *
 * NOT a reimplementation: it imports the upstream's own `openApiZod.ts`
 * (the OpenAPI-derived endpoint definitions — names, descriptions, zod
 * parameter schemas, and the zodios client that calls the real mirror node)
 * and applies the same GET-only conversion their `mcpServer.js` does.
 *
 * Only the transport differs. The upstream hardcodes SSE via fastmcp 1.20.5,
 * and that path returns HTTP 500 "Error creating server" on a clean clone with
 * its own pinned dependencies — so the tools it defines are unreachable as
 * shipped. This serves the identical tool set over stdio using the official
 * MCP SDK so they can actually be called.
 *
 * Upstream files are left untouched; this is an additional file in the clone.
 */
import { endpointDefinitions, createApiClient } from "./openApiZod.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const BASE = process.env.MIRRORNODE_BASE ?? "https://testnet.mirrornode.hedera.com";
const api = createApiClient(BASE, { validate: "request" });

const server = new McpServer({ name: "hederaTestnetMirrorNodeApi", version: "0.0.0" });

let registered = 0;
for (const endpoint of endpointDefinitions) {
  const { method, alias, description, parameters } = endpoint;
  if (!method || method.toLowerCase() !== "get") continue; // same filter as upstream

  const shape = {};
  for (const p of parameters ?? []) shape[p.name] = p.schema;

  server.tool(alias, description ?? alias, shape, async (inputs) => {
    const params = {};
    const queries = {};
    for (const p of parameters ?? []) {
      const t = (p.type ?? "").toLowerCase();
      if (t === "path") params[p.name] = inputs[p.name];
      else if (t === "query") queries[p.name] = inputs[p.name];
    }
    try {
      const result = await api[alias]({ params, queries });
      return { content: [{ type: "text", text: JSON.stringify(result, undefined, 1) }] };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: String(error?.message ?? error) }],
      };
    }
  });
  registered++;
}

console.error(`mirror-node stdio: ${registered} GET tools registered against ${BASE}`);
await server.connect(new StdioServerTransport());
