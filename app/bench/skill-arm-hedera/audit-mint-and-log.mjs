// Hedera testnet, real execution (no bench CLI / gateway / mdcp — SDK only):
//   1. Create an HCS topic to serve as an audit log (memo: "asset audit trail").
//   2. Mint 500 more GG into the existing HTS token 0.0.10521642 (8 decimals).
//   3. Submit one JSON audit event to the topic recording the mint (token id,
//      amount, new total supply).
//   4. Read the topic back from the mirror node (REST API) to confirm the
//      event landed on the ledger.
//
// Follows ../../../skills/hedera-official/hedera-token-service/SKILL.md and
// ../../../skills/hedera-official/hedera-consensus-service/SKILL.md verbatim:
// Client + setOperator, TopicCreateTransaction, TokenMintTransaction,
// TopicMessageSubmitTransaction. Mirror-node read-back uses the public REST
// API (https://testnet.mirrornode.hedera.com) rather than the SDK's
// long-lived TopicMessageQuery gRPC subscription, since a one-shot poll is
// simpler and won't hang the process.
//
// Env (HEDERA_NETWORK, HEDERA_OPERATOR_KEY) must already be exported into the
// process, e.g.:
//   (set -a; . ./.env; set +a; node bench/skill-arm-hedera/audit-mint-and-log.mjs)

import {
    Client,
    AccountId,
    PrivateKey,
    TopicCreateTransaction,
    TokenMintTransaction,
    TokenId,
    TopicMessageSubmitTransaction,
    TopicId,
} from "@hiero-ledger/sdk";

const OPERATOR_ID = "0.0.10521296";
const TOKEN_ID_STR = "0.0.10521642";
const DECIMALS = 8;
const MINT_AMOUNT_DISPLAY = 500n; // GG
const MINT_AMOUNT_RAW = MINT_AMOUNT_DISPLAY * 10n ** BigInt(DECIMALS);

const NETWORK = process.env.HEDERA_NETWORK || "testnet";
const OPERATOR_KEY_HEX = process.env.HEDERA_OPERATOR_KEY;

const MIRROR_BASE =
    NETWORK === "testnet"
        ? "https://testnet.mirrornode.hedera.com"
        : `https://${NETWORK}.mirrornode.hedera.com`;

if (!OPERATOR_KEY_HEX) {
    console.error("Missing HEDERA_OPERATOR_KEY in environment");
    process.exit(1);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const operatorId = AccountId.fromString(OPERATOR_ID);
    const operatorKey = PrivateKey.fromStringECDSA(OPERATOR_KEY_HEX);
    const tokenId = TokenId.fromString(TOKEN_ID_STR);

    const client = Client.forName(NETWORK).setOperator(operatorId, operatorKey);

    try {
        // 1. Create the HCS audit-log topic.
        const topicCreateReceipt = await (
            await new TopicCreateTransaction()
                .setTopicMemo("asset audit trail")
                .setAdminKey(operatorKey)
                .setSubmitKey(operatorKey)
                .execute(client)
        ).getReceipt(client);

        const topicId = topicCreateReceipt.topicId;
        console.error(`[ok] topic created: ${topicId.toString()}`);

        // 2. Mint 500 more GG into the existing token (operator holds supply key).
        const mintResponse = await new TokenMintTransaction()
            .setTokenId(tokenId)
            .setAmount(MINT_AMOUNT_RAW)
            .execute(client);

        const mintReceipt = await mintResponse.getReceipt(client);
        const newTotalSupplyRaw = mintReceipt.totalSupply; // Long
        const newTotalSupplyRawStr = newTotalSupplyRaw.toString();
        const newTotalSupplyDisplay =
            BigInt(newTotalSupplyRawStr) / 10n ** BigInt(DECIMALS);

        console.error(
            `[ok] mint status: ${mintReceipt.status.toString()}, ` +
                `newTotalSupply(raw)=${newTotalSupplyRawStr} ` +
                `(${newTotalSupplyDisplay} GG)`,
        );

        // 3. Submit one JSON audit event describing the mint.
        const auditEvent = {
            type: "hts.mint",
            tokenId: tokenId.toString(),
            amountRaw: MINT_AMOUNT_RAW.toString(),
            amountDisplay: `${MINT_AMOUNT_DISPLAY} GG`,
            decimals: DECIMALS,
            newTotalSupplyRaw: newTotalSupplyRawStr,
            newTotalSupplyDisplay: `${newTotalSupplyDisplay} GG`,
            mintTransactionId: mintResponse.transactionId.toString(),
            timestamp: new Date().toISOString(),
        };
        const auditEventJson = JSON.stringify(auditEvent);

        const submitResponse = await new TopicMessageSubmitTransaction()
            .setTopicId(topicId)
            .setMessage(auditEventJson)
            .execute(client);

        const submitReceipt = await submitResponse.getReceipt(client);
        console.error(
            `[ok] audit event submitted: seq=${submitReceipt.topicSequenceNumber.toString()}, ` +
                `status=${submitReceipt.status.toString()}`,
        );

        // 4. Read the topic back from the mirror node to confirm it landed.
        // Mirror node lags consensus by ~3s; poll for a few seconds.
        const mirrorUrl = `${MIRROR_BASE}/api/v1/topics/${topicId.toString()}/messages`;
        let messages = [];
        for (let attempt = 0; attempt < 10; attempt++) {
            await sleep(3000);
            try {
                const res = await fetch(mirrorUrl);
                if (res.ok) {
                    const body = await res.json();
                    messages = body.messages || [];
                    if (messages.length > 0) break;
                } else {
                    console.error(`[warn] mirror node HTTP ${res.status} (attempt ${attempt + 1})`);
                }
            } catch (err) {
                console.error(`[warn] mirror node fetch failed (attempt ${attempt + 1}): ${err.message}`);
            }
        }

        const decodedMessages = messages.map((m) => {
            const contents = Buffer.from(m.message, "base64").toString("utf8");
            let parsed;
            try {
                parsed = JSON.parse(contents);
            } catch {
                parsed = contents;
            }
            return {
                sequenceNumber: m.sequence_number,
                consensusTimestamp: m.consensus_timestamp,
                contents: parsed,
            };
        });

        console.error(`[ok] mirror node read-back: ${decodedMessages.length} message(s)`);
        for (const dm of decodedMessages) {
            console.error(`  #${dm.sequenceNumber} @ ${dm.consensusTimestamp}: ${JSON.stringify(dm.contents)}`);
        }

        const summary = {
            topicId: topicId.toString(),
            mintTransactionId: mintResponse.transactionId.toString(),
            mintStatus: mintReceipt.status.toString(),
            newTotalSupplyRaw: newTotalSupplyRawStr,
            newTotalSupplyDisplay: `${newTotalSupplyDisplay} GG`,
            auditEventSubmitted: auditEvent,
            auditSubmitTransactionId: submitResponse.transactionId.toString(),
            auditSubmitSequenceNumber: submitReceipt.topicSequenceNumber.toString(),
            mirrorMessagesReadBack: decodedMessages,
        };

        console.log(JSON.stringify(summary, null, 2));
    } finally {
        client.close();
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
