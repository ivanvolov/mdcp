/**
 * The code-mode sandbox.
 *
 * Wraps @executor-js/runtime-quickjs (MIT, by Rhys Sullivan / executor.sh) with
 * the parts a chain gateway needs and a general code runner does not:
 *
 *   - a policy gate on every tool reaching out of the sandbox (view auto-allows,
 *     writes must be pre-authorised or the execution suspends)
 *   - suspension/resume, so a write can wait for a human signature without the
 *     agent re-running the whole strategy
 *   - tx-intent idempotency, so a resumed run can never double-spend
 */
import { makeQuickJsExecutor } from "@executor-js/runtime-quickjs";
import * as Effect from "effect/Effect";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TOOL_BY_PATH, TOOLS, jsonSafe, type ToolDef } from "./tools.js";
import { bytesOf, logCall } from "./instrument.js";

const executor = makeQuickJsExecutor({ timeoutMs: 30_000 });

/** Structural mirror of the runtime's result shape. */
interface ExecuteResult {
  result: unknown;
  error?: string;
  logs?: string[];
}

export type Policy = "auto" | "approve";

export interface PendingExecution {
  id: string;
  code: string;
  /** The call that tripped the gate. */
  awaiting: { path: string; args: unknown; intentHash: string };
  pausedAt: number;
  /** Intents already broadcast — replayed from the ledger instead of re-sent. */
  ledger: Record<string, unknown>;
  /** Every intent the operator has approved so far in this execution. */
  approved: Set<string>;
}

/**
 * Suspended executions survive process restarts.
 *
 * A long-lived MCP server could keep these in memory, but the benchmark harness
 * invokes the CLI as a fresh process per call — and an approval that cannot be
 * resumed across a restart is not much of an approval gate anyway.
 */
const PENDING_DIR = path.join(
  process.env.STATE_DIR ?? path.join(process.cwd(), ".state"),
  "pending",
);

function pendingPath(id: string) {
  if (!/^[A-Za-z0-9-]+$/.test(id)) throw new Error(`invalid_execution_id: ${id}`);
  return path.join(PENDING_DIR, `${id}.json`);
}

function savePending(entry: PendingExecution) {
  fs.mkdirSync(PENDING_DIR, { recursive: true });
  fs.writeFileSync(
    pendingPath(entry.id),
    JSON.stringify({ ...entry, approved: [...entry.approved] }),
  );
}

function loadPending(id: string): PendingExecution | null {
  const file = pendingPath(id);
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return { ...raw, approved: new Set<string>(raw.approved ?? []) };
}

function dropPending(id: string) {
  const file = pendingPath(id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

/** Signal used to unwind the sandbox when a write needs human approval. */
class ApprovalRequired extends Error {
  constructor(
    readonly path: string,
    readonly args: unknown,
    readonly intentHash: string,
  ) {
    super("approval_required");
  }
}

/**
 * A transaction intent is identified by what it would *do*, not by the exact
 * numbers a particular run happened to compute. Only the tool's declared
 * `intentFields` participate, so a slippage bound re-derived from a fresher
 * quote does not turn an already-broadcast swap into a "new" one.
 */
export function intentHash(tool: ToolDef, args: any): string {
  const fields = tool.intentFields;
  const material = fields
    ? Object.fromEntries(fields.map((f) => [f, args?.[f] ?? null]))
    : args;
  return createHash("sha256")
    .update(JSON.stringify({ path: tool.path, material }))
    .digest("hex")
    .slice(0, 16);
}

function policyFor(tool: ToolDef): Policy {
  return tool.sideEffect === "chain" ? "approve" : "auto";
}

interface RunOptions {
  /** Intent hashes the operator has signed off on. */
  approved?: Set<string>;
  /** Results of intents already executed, replayed instead of re-broadcast. */
  ledger?: Record<string, unknown>;
}

async function runCode(code: string, options: RunOptions = {}) {
  const approved = options.approved ?? new Set<string>();
  const ledger = { ...(options.ledger ?? {}) };
  let tripped: ApprovalRequired | null = null;

  const toolInvoker = {
    invoke: ({ path, args }: { path: string; args: unknown }) =>
      Effect.tryPromise({
        try: async () => {
          const tool = TOOL_BY_PATH.get(path);
          if (!tool) {
            const known = TOOLS.map((t) => t.path).join(", ");
            throw new Error(`tool_not_found: ${path}. Available: ${known}`);
          }

          const hash = intentHash(tool, args);

          // Idempotency: a transaction that already landed is never sent twice,
          // no matter how often the surrounding code re-runs.
          if (tool.sideEffect === "chain" && hash in ledger) {
            return { ...(ledger[hash] as object), replayed: true };
          }

          if (policyFor(tool) === "approve" && !approved.has(hash)) {
            tripped = new ApprovalRequired(path, args, hash);
            throw tripped;
          }

          const started = Date.now();
          const result = jsonSafe(await tool.invoke(args));
          logCall({
            server: "mdcp",
            mcpTool: "execute",
            innerTool: path,
            argsBytes: bytesOf(args),
            resultBytes: bytesOf(result),
            durationMs: Date.now() - started,
            ok: true,
          });
          if (tool.sideEffect === "chain") ledger[hash] = result as object;
          return result;
        },
        catch: (error) => error,
      }),
  };

  const result: ExecuteResult = await Effect.runPromise(
    executor.execute(code, toolInvoker),
  );
  return { result, tripped: tripped as ApprovalRequired | null, ledger };
}

export interface ExecuteOutcome {
  status: "ok" | "awaiting_approval" | "error";
  result?: unknown;
  logs?: string[];
  error?: string;
  approval?: {
    executionId: string;
    tool: string;
    args: unknown;
    intentHash: string;
    reason: string;
  };
}

export async function execute(code: string): Promise<ExecuteOutcome> {
  const { result, tripped, ledger } = await runCode(code);

  if (tripped) {
    const id = randomUUID().slice(0, 8);
    savePending({
      id,
      code,
      awaiting: {
        path: tripped.path,
        args: tripped.args,
        intentHash: tripped.intentHash,
      },
      pausedAt: Date.now(),
      ledger,
      approved: new Set(),
    });
    return {
      status: "awaiting_approval",
      approval: {
        executionId: id,
        tool: tripped.path,
        args: tripped.args,
        intentHash: tripped.intentHash,
        reason:
          "This call changes chain state. Approve it with resume({ executionId, approve: true }).",
      },
    };
  }

  if (result.error) {
    return { status: "error", error: result.error, logs: result.logs };
  }
  return { status: "ok", result: result.result, logs: result.logs };
}

export async function resume(
  executionId: string,
  approve: boolean,
): Promise<ExecuteOutcome> {
  const entry = loadPending(executionId);
  if (!entry) {
    return { status: "error", error: `unknown_execution: ${executionId}` };
  }
  if (!approve) {
    dropPending(executionId);
    return { status: "error", error: "rejected_by_operator" };
  }

  // Re-run the same code with this intent approved. Writes that already landed
  // replay from the ledger, so the re-run cannot double-spend; anything the
  // chain moved under our feet is re-read live.
  const approved = new Set(entry.approved).add(entry.awaiting.intentHash);
  const { result, tripped, ledger } = await runCode(entry.code, {
    approved,
    ledger: entry.ledger,
  });

  if (tripped) {
    savePending({
      ...entry,
      awaiting: {
        path: tripped.path,
        args: tripped.args,
        intentHash: tripped.intentHash,
      },
      ledger,
      approved,
    });
    return {
      status: "awaiting_approval",
      approval: {
        executionId,
        tool: tripped.path,
        args: tripped.args,
        intentHash: tripped.intentHash,
        reason: "Another state-changing call needs approval.",
      },
    };
  }

  dropPending(executionId);
  if (result.error) return { status: "error", error: result.error, logs: result.logs };
  return { status: "ok", result: result.result, logs: result.logs };
}

/** Compact catalog handed to the model inside the `execute` description. */
export function catalogSignatures(): string {
  return TOOLS.map((t) => `${t.signature}  // ${t.sideEffect}`).join("\n");
}
