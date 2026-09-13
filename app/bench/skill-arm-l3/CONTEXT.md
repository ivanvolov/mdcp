# Environment: LIVE Ethereum Sepolia (public testnet)

- RPC: read SEPOLIA_RPC_URL from the .env file in the app directory.
- Wallet: read SEPOLIA_BURNER_PK from the same .env (never print either).
  Address: 0xEEb84a3a4B4930311dD7385c10559Bd309944b3f — a throwaway test wallet
  holding Sepolia ETH, WETH and USDC. Real public testnet: blocks ~12s.
- Trading API key: UNISWAP_API_KEY in the same .env. Use the Trading API as
  swap-integration prescribes (check_approval -> quote -> swap; chainId
  "11155111" for both tokenInChainId/tokenOutChainId; sign permitData if
  returned; broadcast yourself; let the node estimate gas).
- Tokens (Sepolia): USDC 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 (6 dec),
  WETH 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14 (18 dec).
- viem is installed; run scripts with npx tsx from app/. Put scripts in
  bench/skill-arm-l3/. STATE_DIR: bench/skill-arm-l3/.state
