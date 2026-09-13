// Create a fungible HTS token (GameGold / GG, 8 decimals, 1,000,000 initial supply)
// on Hedera testnet, create a fresh recipient account, and transfer 500 GG to it.
//
// Follows ../../../skills/hedera-official/hedera-token-service/SKILL.md verbatim:
// Client + setOperator, TokenCreateTransaction, AccountCreateTransaction with
// setMaxAutomaticTokenAssociations(-1) (auto-association, no separate
// TokenAssociateTransaction needed), TransferTransaction with addTokenTransfer.
//
// Env (HEDERA_NETWORK, HEDERA_OPERATOR_KEY) must already be exported into the
// process, e.g.: (set -a; . ./.env; set +a; node bench/skill-arm-hedera/create-and-transfer.mjs)

import {
    Client,
    AccountId,
    PrivateKey,
    Hbar,
    TokenCreateTransaction,
    TokenType,
    TokenSupplyType,
    AccountCreateTransaction,
    TransferTransaction,
} from "@hiero-ledger/sdk";

const OPERATOR_ID = "0.0.10521296";
const NETWORK = process.env.HEDERA_NETWORK || "testnet";
const OPERATOR_KEY_HEX = process.env.HEDERA_OPERATOR_KEY;

if (!OPERATOR_KEY_HEX) {
    console.error("Missing HEDERA_OPERATOR_KEY in environment");
    process.exit(1);
}

const DECIMALS = 8;
const INITIAL_SUPPLY_DISPLAY = 1_000_000n; // GG
const INITIAL_SUPPLY_RAW = INITIAL_SUPPLY_DISPLAY * 10n ** BigInt(DECIMALS);
const TRANSFER_AMOUNT_DISPLAY = 500n; // GG
const TRANSFER_AMOUNT_RAW = TRANSFER_AMOUNT_DISPLAY * 10n ** BigInt(DECIMALS);

async function main() {
    const operatorId = AccountId.fromString(OPERATOR_ID);
    const operatorKey = PrivateKey.fromStringECDSA(OPERATOR_KEY_HEX);

    const client = Client.forName(NETWORK).setOperator(operatorId, operatorKey);

    try {
        // 1. Create the fungible token, treasury = operator.
        const tokenCreateReceipt = await (
            await new TokenCreateTransaction()
                .setTokenName("GameGold")
                .setTokenSymbol("GG")
                .setTokenType(TokenType.FungibleCommon)
                .setDecimals(DECIMALS)
                .setInitialSupply(INITIAL_SUPPLY_RAW)
                .setSupplyType(TokenSupplyType.Infinite)
                .setTreasuryAccountId(operatorId)
                .setAdminKey(operatorKey)
                .setSupplyKey(operatorKey)
                .execute(client)
        ).getReceipt(client);

        const tokenId = tokenCreateReceipt.tokenId;
        console.error(`[ok] token created: ${tokenId.toString()}`);

        // 2. Create a fresh recipient account with unlimited auto token association,
        //    so we don't need a separate TokenAssociateTransaction.
        const recipientKey = PrivateKey.generateECDSA();
        const accountCreateReceipt = await (
            await new AccountCreateTransaction()
                .setKeyWithoutAlias(recipientKey.publicKey)
                .setInitialBalance(new Hbar(5))
                .setMaxAutomaticTokenAssociations(-1)
                .execute(client)
        ).getReceipt(client);

        const recipientId = accountCreateReceipt.accountId;
        console.error(`[ok] recipient account created: ${recipientId.toString()}`);

        // 3. Transfer 500 GG from operator (treasury) to the new recipient.
        const transferResponse = await new TransferTransaction()
            .addTokenTransfer(tokenId, operatorId, -TRANSFER_AMOUNT_RAW)
            .addTokenTransfer(tokenId, recipientId, TRANSFER_AMOUNT_RAW)
            .execute(client);

        const transferReceipt = await transferResponse.getReceipt(client);
        console.error(`[ok] transfer status: ${transferReceipt.status.toString()}`);

        const summary = {
            tokenId: tokenId.toString(),
            recipientAccountId: recipientId.toString(),
            transferStatus: transferReceipt.status.toString(),
            transferTransactionId: transferResponse.transactionId.toString(),
            recipientPrivateKeyECDSA: recipientKey.toStringRaw(),
        };

        console.log(JSON.stringify(summary));
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
