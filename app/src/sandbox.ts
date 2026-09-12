/**
 * QuickJS sandbox with the lazy `tools` proxy.
 * TODO(h2-7): real quickjs-emscripten async context; host functions for
 * search/describe/invoke; pause/resume via execution table.
 *
 * Crypto deltas vs a generic gateway (the point of the project):
 *  - write calls pause for approval; resume RE-QUOTES + RE-SIMULATES (staleness)
 *  - submitted txs are checkpoints keyed by intent hash (idempotency)
 *  - policy from ABI side-effect class (view auto-allow, write approve, dangerous block)
 */
import { searchCatalog, describeTool, catalog } from "./catalog/index.js";

interface PendingExecution {
  code: string;
  pausedAt: string; // tool path awaiting approval
  intentHash: string;
  slippageBound?: number;
}

const pending = new Map<string, PendingExecution>();

export async function runInSandbox(code: string): Promise<unknown> {
  // TODO: replace this stub with quickjs-emscripten newAsyncContext execution.
  // For now: prove the surface end-to-end so the MCP client wiring can be tested.
  void searchCatalog;
  void describeTool;
  void catalog;
  return {
    ok: false,
    error: { code: "sandbox_not_implemented", note: "scaffold — see TODO(h2-7)" },
    received: { codeLength: code.length },
  };
}

export async function resumeExecution(executionId: string): Promise<unknown> {
  const p = pending.get(executionId);
  if (!p) return { ok: false, error: { code: "unknown_execution" } };
  // TODO: re-quote, re-simulate against p.slippageBound, then continue the fiber.
  return { ok: false, error: { code: "resume_not_implemented" } };
}
