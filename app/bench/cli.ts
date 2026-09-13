#!/usr/bin/env tsx
/**
 * Benchmark harness CLI.
 *
 * Both arms of the experiment reach the chain through this one binary, so the
 * only difference measured is the *shape* of the interaction:
 *
 *   baseline:  one process call per capability  (9-ish round-trips)
 *   mdcp:      one process call carrying a program (1-2 round-trips)
 *
 * Every invocation appends a record to $BENCH_LOG.
 */
import fs from "node:fs";
import { TOOL_BY_PATH, TOOLS, jsonSafe } from "../src/tools.js";
import { execute, resume } from "../src/sandbox.js";
import { bytesOf, logCall } from "../src/instrument.js";
import { ensureGraphTools, closeGraphUpstream } from "../src/graphUpstream.js";
import { ensureMirrorTools, closeMirrorUpstream } from "../src/hederaUpstream.js";

const [, , command, payloadRaw] = process.argv;

function out(value: unknown) {
  const text = JSON.stringify(value);
  process.stdout.write(text + "\n");
  return text;
}

async function main() {
  // Graph scenarios opt in; Uniswap scenarios never pay the upstream handshake.
  if (process.env.GRAPH_UPSTREAM === "1") await ensureGraphTools();
  if (process.env.MIRROR_UPSTREAM === "1") await ensureMirrorTools();

  if (!command || command === "help") {
    out({
      usage: "cli.ts <tool-path|execute|resume> '<json>'",
      tools: TOOLS.map((t) => t.signature),
    });
    return;
  }

  // `execute` accepts {"code": "..."}, the program source directly, or
  // `@path/to/program.ts` to read the source from a file.
  //
  // The file form exists because the benchmark measured the cost of the
  // alternative: an agent composing a multi-line TypeScript program onto a
  // shell command line spends real time on quoting and escaping, and a stray
  // apostrophe in a comment costs a whole retry. Writing the program with the
  // Write tool and passing a path removes that failure mode entirely.
  let payload: any = {};
  if (payloadRaw) {
    if (command === "execute" && payloadRaw.startsWith("@")) {
      payload = { code: fs.readFileSync(payloadRaw.slice(1), "utf8") };
    } else {
      try {
        payload = JSON.parse(payloadRaw);
      } catch {
        if (command !== "execute") throw new Error(`invalid_json_args: ${payloadRaw}`);
        payload = { code: payloadRaw };
      }
    }
  }

  if (command === "execute") {
    const started = Date.now();
    const outcome = await execute(payload.code);
    const text = out(outcome);
    logCall({
      server: "mdcp",
      mcpTool: "execute",
      argsBytes: bytesOf(payload.code),
      resultBytes: bytesOf(text),
      durationMs: Date.now() - started,
      ok: outcome.status !== "error",
      boundary: true,
    });
    return;
  }

  if (command === "resume") {
    const started = Date.now();
    const outcome = await resume(payload.executionId, payload.approve !== false);
    const text = out(outcome);
    logCall({
      server: "mdcp",
      mcpTool: "resume",
      argsBytes: bytesOf(payloadRaw),
      resultBytes: bytesOf(text),
      durationMs: Date.now() - started,
      ok: outcome.status !== "error",
      boundary: true,
    });
    return;
  }

  const tool = TOOL_BY_PATH.get(command);
  if (!tool) {
    out({ error: `unknown_tool: ${command}`, known: [...TOOL_BY_PATH.keys()] });
    process.exitCode = 1;
    return;
  }

  const started = Date.now();
  let ok = true;
  let result: unknown;
  try {
    result = jsonSafe(await tool.invoke(payload));
  } catch (error: any) {
    ok = false;
    result = { error: String(error?.shortMessage ?? error?.message ?? error) };
  }
  const text = out(result);
  logCall({
    server: "baseline",
    mcpTool: command,
    argsBytes: bytesOf(payloadRaw ?? ""),
    resultBytes: bytesOf(text),
    durationMs: Date.now() - started,
    ok,
    boundary: true,
  });
}

main()
  .catch((error) => {
    out({ error: String(error?.message ?? error) });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeGraphUpstream();
    await closeMirrorUpstream();
  });
