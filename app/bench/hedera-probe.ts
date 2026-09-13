/**
 * Deterministic level-3 probe for the HTS tool family — the "GameGold"
 * scenario from the official skill's own evals
 * (hedera-skills/plugins/native-services-js/skills/hedera-token-service/evals/
 * spec.json, eval id 0): create a fungible token with 8 decimals, 1M initial
 * supply, then transfer 500 to another account.
 *
 * Runs the whole pipeline as ONE mdcp program through execute() -> resume(),
 * exactly as the agent arm would, so it validates plan-stub flow, intent
 * hashing across receipt-derived ids, keystore signing, and live consensus —
 * before any model tokens are spent. Requires a funded HEDERA_OPERATOR_KEY.
 *
 * Run (from app/):
 *   set -a; . ./.env; set +a
 *   STATE_DIR=.state-hedera BENCH_LOG=bench/logs/hedera-probe.jsonl \
 *     SANDBOX_TIMEOUT_MS=120000 npx tsx bench/hedera-probe.ts
 */
import { execute, resume } from "../src/sandbox.js";

const program = `
  const net = await tools["hts.network"]({});

  // GameGold: 8 decimals, 1M human units minted at creation (raw = 1e6 * 1e8).
  const token = await tools["hts.createToken"]({
    name: "GameGold", symbol: "GG", decimals: 8,
    initialSupply: "100000000000000",
  });

  // Recipient with NO auto-association slots, so the association step is real.
  const recipient = await tools["hts.createAccount"]({ maxAutoAssociations: 0 });
  await tools["hts.associate"]({ accountId: recipient.accountId, tokenId: token.tokenId });

  // 500 GG in raw units.
  const tx = await tools["hts.transfer"]({
    tokenId: token.tokenId, to: recipient.accountId, amount: "50000000000",
  });

  return {
    operator: net.operatorId,
    tokenId: token.tokenId,
    recipient: recipient.accountId,
    transferStatus: tx.status,
    hashscanUrl: tx.hashscanUrl,
  };
`;

const planned = await execute(program);
console.log("RESULT plan:", JSON.stringify(planned, null, 2));

if (planned.status !== "awaiting_approval") {
  console.log("RESULT probe FAILED: expected awaiting_approval");
  process.exit(1);
}

// Operator approval, pre-authorized for the probe.
const outcome = await resume(planned.approval!.executionId, true);
console.log("RESULT outcome:", JSON.stringify(outcome, null, 2));

if (outcome.status === "ok") {
  const r = outcome.result as any;
  console.log(`RESULT verify: https://hashscan.io/testnet/token/${r.tokenId}`);
} else {
  process.exit(1);
}
