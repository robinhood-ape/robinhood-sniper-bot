import type { Address, Hex, Log } from "viem";
import { ADDRESSES, launchFactoryAbi, type Clients } from "./chain.js";
import { evaluateLaunch, type LaunchEvent } from "./filters.js";
import { buyToken } from "./buyer.js";
import type { PositionTracker } from "./positions.js";
import { logger } from "./logger.js";

type TokenLaunchedArgs = {
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
};

function toLaunch(args: TokenLaunchedArgs, log: Log): LaunchEvent {
  return {
    ...args,
    txHash: log.transactionHash ?? undefined,
    blockNumber: log.blockNumber ?? undefined,
  };
}

export function startLaunchWatcher(
  clients: Clients,
  tracker: PositionTracker,
): () => void {
  logger.info(`Watching TokenLaunched on ${ADDRESSES.launchFactory}`);

  const unwatch = clients.publicClient.watchContractEvent({
    address: ADDRESSES.launchFactory,
    abi: launchFactoryAbi,
    eventName: "TokenLaunched",
    onLogs: (logs) => {
      for (const log of logs) {
        void handleLaunch(clients, tracker, log);
      }
    },
    onError: (err) => {
      logger.error("Launch watcher error", err);
    },
  });

  return unwatch;
}

async function handleLaunch(
  clients: Clients,
  tracker: PositionTracker,
  log: Log & { args?: Partial<TokenLaunchedArgs> },
): Promise<void> {
  const args = log.args;
  if (
    !args?.token ||
    !args.deployer ||
    !args.dexFactory ||
    !args.pairToken ||
    !args.pool ||
    args.dexId === undefined ||
    args.launchConfigId === undefined ||
    args.positionId === undefined ||
    args.restrictionsEndBlock === undefined ||
    args.initialBuyAmount === undefined
  ) {
    logger.warn("Incomplete TokenLaunched log, skipping", log);
    return;
  }

  const launch = toLaunch(args as TokenLaunchedArgs, log);
  logger.info(
    `Launch detected token=${launch.token} deployer=${launch.deployer} pool=${launch.pool} tx=${launch.txHash ?? "?"}`,
  );

  if (tracker.has(launch.token)) {
    logger.info(`Already holding ${launch.token}, skip`);
    return;
  }

  const filter = await evaluateLaunch(clients, launch, tracker.size);
  if (!filter.ok) {
    logger.info(`Skipped: ${filter.reason}`);
    return;
  }

  logger.info(`Passed filters: ${filter.name} (${filter.symbol}) fee=${filter.poolFee}`);

  try {
    const buy = await buyToken(clients, launch.token, filter.poolFee);
    tracker.add({
      token: launch.token,
      pool: launch.pool,
      name: filter.name,
      symbol: filter.symbol,
      poolFee: filter.poolFee,
      entryWeth: buy.amountIn,
      tokenAmount: buy.tokenBalance,
      buyTxHash: buy.txHash as Hex | "dry-run",
      openedAt: Date.now(),
    });
  } catch (err) {
    logger.error(`Buy failed for ${filter.symbol} (${launch.token})`, err);
  }
}
