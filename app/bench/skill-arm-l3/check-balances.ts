import { createPublicClient, http, formatEther, formatUnits, parseAbi, isAddress } from 'viem';
import { sepolia } from 'viem/chains';

const RPC_URL = process.env.SEPOLIA_RPC_URL;
if (!RPC_URL) throw new Error('SEPOLIA_RPC_URL missing from .env');

const WALLET = '0xEEb84a3a4B4930311dD7385c10559Bd309944b3f';
const WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

for (const addr of [WALLET, WETH, USDC]) {
  if (!isAddress(addr)) throw new Error(`Invalid address: ${addr}`);
}

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

const client = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

async function main() {
  const [ethBalance, wethBalanceRaw, wethDecimals, usdcBalanceRaw, usdcDecimals] = await Promise.all([
    client.getBalance({ address: WALLET }),
    client.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [WALLET] }),
    client.readContract({ address: WETH, abi: erc20Abi, functionName: 'decimals' }),
    client.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [WALLET] }),
    client.readContract({ address: USDC, abi: erc20Abi, functionName: 'decimals' }),
  ]);

  const result = {
    wallet: WALLET,
    network: 'Ethereum Sepolia (chainId 11155111)',
    native_ETH: {
      raw_wei: ethBalance.toString(),
      human: formatEther(ethBalance),
    },
    WETH: {
      address: WETH,
      raw: wethBalanceRaw.toString(),
      decimals: wethDecimals,
      human: formatUnits(wethBalanceRaw, wethDecimals),
    },
    USDC: {
      address: USDC,
      raw: usdcBalanceRaw.toString(),
      decimals: usdcDecimals,
      human: formatUnits(usdcBalanceRaw, usdcDecimals),
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
