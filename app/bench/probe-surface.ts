/**
 * Verify what a given MDCP_PROFILE actually mounts.
 *
 * Starts src/mcp-mdcp.ts over stdio exactly the way an AI client would, then
 * prints the MCP tool list, the byte size of the `execute` description (the
 * always-loaded surface) and the capability names visible inside it.
 *
 *   npx tsx bench/probe-surface.ts uniswap
 *   npx tsx bench/probe-surface.ts hedera
 *   npx tsx bench/probe-surface.ts graph
 *   npx tsx bench/probe-surface.ts all
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const profile = process.argv[2] ?? "all";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "src/mcp-mdcp.ts"],
  env: { ...(process.env as Record<string, string>), MDCP_PROFILE: profile },
  stderr: "inherit",
});

const client = new Client({ name: "probe-surface", version: "0.1.0" }, { capabilities: {} });
await client.connect(transport);

const { tools } = await client.listTools();
const execute = tools.find((t) => t.name === "execute");
const description = execute?.description ?? "";
const capabilities = (description.match(/^[a-z]+\.[A-Za-z_0-9]+\(/gm) ?? []).map((s) => s.slice(0, -1));

console.log(
  JSON.stringify(
    {
      profile,
      mcpTools: tools.map((t) => t.name),
      executeDescriptionBytes: Buffer.byteLength(description),
      capabilityCount: capabilities.length,
      capabilities,
    },
    null,
    2,
  ),
);

await client.close();
process.exit(0);
