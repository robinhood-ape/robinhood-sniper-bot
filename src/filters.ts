import { formatEther, type Address } from "viem";
import { config } from "./config.js";
import { ADDRESSES, erc20Abi, launchFactoryAbi, type Clients } from "./chain.js";
import { logger } from "./logger.js";

export type LaunchEvent = {
  token: Address;
  deployer: Address;
  dexFactory: Address;
  pairToken: Address;
  pool: Address;
  dexId: bigint;
  launchConfigId: bigint;
  positionId: bigint;
  restrictionsEndBlock: bigint;
  initialBuyAmount: bigint;
  txHash?: `0x${string}`;
  blockNumber?: bigint;
};

export type FilterResult =
  | { ok: true; name: string; symbol: string; poolFee: number }
  | { ok: false; reason: string };

export async function evaluateLaunch(
  clients: Clients,
  launch: LaunchEvent,
  openPositionCount: number,
): Promise<FilterResult> {
  if (openPositionCount >= config.maxOpenPositions) {
    return { ok: false, reason: `max open positions (${config.maxOpenPositions})` };
  }

  if (launch.pairToken.toLowerCase() !== ADDRESSES.weth.toLowerCase()) {
    return { ok: false, reason: `pairToken is not WETH (${launch.pairToken})` };
  }

  if (launch.initialBuyAmount < config.minInitialBuyWei) {
    return {
      ok: false,
      reason: `initialBuy ${formatEther(launch.initialBuyAmount)} ETH < min ${formatEther(config.minInitialBuyWei)}`,
    };
  }

  let name = "unknown";
  let symbol = "???";
  try {
    const [n, s] = await Promise.all([
      clients.publicClient.readContract({
        address: launch.token,
        abi: erc20Abi,
        functionName: "name",
      }),
      clients.publicClient.readContract({
        address: launch.token,
        abi: erc20Abi,
        functionName: "symbol",
      }),
    ]);
    name = n;
    symbol = s;
  } catch (err) {
    logger.warn(`Could not read name/symbol for ${launch.token}`, err);
  }

  const haystack = `${name} ${symbol}`.toLowerCase();
  for (const deny of config.denyNameSubstrings) {
    if (haystack.includes(deny)) {
      return { ok: false, reason: `name/symbol matched deny "${deny}" (${name} / ${symbol})` };
    }
  }

  let poolFee = 10_000;
  try {
    const launched = await clients.publicClient.readContract({
      address: ADDRESSES.launchFactory,
      abi: launchFactoryAbi,
      functionName: "getLaunchedToken",
      args: [launch.token],
    });

    if (!launched.exists) {
      return { ok: false, reason: "getLaunchedToken.exists = false" };
    }
    poolFee = Number(launched.poolFee);
  } catch (err) {
    logger.warn(`getLaunchedToken failed for ${launch.token}, defaulting fee 10000`, err);
  }

  return { ok: true, name, symbol, poolFee };
}
 