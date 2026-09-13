// Two-service Hedera pipeline: HTS + HCS in one program.
//
// Mint a token and write a verifiable audit trail of every step to a consensus
// topic. This is the composition case: the token id produced by HTS flows into
// the HCS audit messages *inside the sandbox*. An agent calling these services
// tool-by-tool has to carry that id out to the model and back on every hop, and
// must read two separate official skills to know how.
//
// Run: bash bench/arm-hedera.sh execute @bench/programs/audit-trail.ts

const topic = await tools["hcs.createTopic"]({ memo: "mdcp asset audit trail" });

const token = await tools["hts.createToken"]({
  name: "GameGold",
  symbol: "GG",
  decimals: 8,
  initialSupply: "100000000000000", // 1,000,000 GG
});

await tools["hcs.submitMessage"]({
  topicId: topic.topicId,
  message: JSON.stringify({
    event: "token_created",
    tokenId: token.tokenId,
    symbol: "GG",
    initialSupply: "1000000",
  }),
});

const minted = await tools["hts.mint"]({
  tokenId: token.tokenId,
  amount: "50000000000", // +500 GG
});

await tools["hcs.submitMessage"]({
  topicId: topic.topicId,
  message: JSON.stringify({
    event: "minted",
    tokenId: token.tokenId,
    amount: "500",
    newTotalSupply: minted.newTotalSupply,
  }),
});

await tools["hcs.submitMessage"]({
  topicId: topic.topicId,
  message: JSON.stringify({ event: "sealed", tokenId: token.tokenId }),
});

// Read the trail back. The mirror node lags consensus ~3s, so a fresh topic can
// report fewer messages than were submitted — reported, not treated as failure.
const trail = await tools["hcs.messages"]({ topicId: topic.topicId, limit: 10 });

return {
  tokenId: token.tokenId,
  topicId: topic.topicId,
  newTotalSupply: minted.newTotalSupply,
  auditEventsSubmitted: 3,
  auditEventsReadBack: trail.messages.length,
  events: trail.messages.map((m) => m.contents),
  hashscanToken: token.hashscanUrl,
};
