/**
 * Catalog surface: what a per-tool MCP server puts in the model's context
 * versus what mdcp's single `execute` tool does.
 *
 * This is the axis executor.sh's headline actually measures (1,640 tools ≈
 * 278,800 tokens -> 1 tool ≈ 1,044). It is a *catalog-scaling* claim: the
 * saving is proportional to how many tool schemas you would otherwise load.
 * Reported here honestly at our real catalog size, which is two orders of
 * magnitude smaller than theirs.
 *
 * Run: HEDERA_TOOLS=1 GRAPH_UPSTREAM=1 npx tsx bench/catalog-size.ts
 */
import { TOOLS } from "../src/tools.js";
import { catalogSignatures } from "../src/sandbox.js";
import { ensureGraphTools, closeGraphUpstream } from "../src/graphUpstream.js";
import { zodToJsonSchema } from "zod-to-json-schema";

if (process.env.GRAPH_UPSTREAM === "1") await ensureGraphTools();

let baseline = 0;
for (const t of TOOLS) {
  let schema = "{}";
  try {
    schema = JSON.stringify(zodToJsonSchema(t.schema));
  } catch {
    /* upstream tools may carry a passthrough schema */
  }
  baseline += t.path.length + t.summary.length + schema.length;
}

const sigs = catalogSignatures().length;

console.log(
  JSON.stringify(
    {
      tools: TOOLS.length,
      perToolMcpBytes: baseline,
      mdcpSignatureBytes: sigs,
      ratio: Number((baseline / sigs).toFixed(2)),
      note: "mdcp still ships the signatures inside execute's description; the saving is schema overhead, not the catalog itself",
    },
    null,
    2,
  ),
);

if (process.env.GRAPH_UPSTREAM === "1") await closeGraphUpstream();
process.exit(0);
