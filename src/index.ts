import { formatEther } from "viem";
import { config } from "./config.js";
import { createClients, NOXA_UI_URL } from "./chain.js";
import { logger } from "./logger.js";
import { PositionTracker } from "./positions.js";
import { startLaunchWatcher } from "./watcher.js";

async function main(): Promise<void> {
  const clients = createClients();

  logger.info("NOXA Fun sniper starting");
  logger.info(`UI: ${NOXA_UI_URL}`);
  logger.info(`Wallet: ${clients.account.address}`);
  logger.info(`DRY_RUN=${config.dryRun}`);
  logger.info(`Buy amount: ${formatEther(config.buyAmountWei)} ETH`);
  logger.info(`Take profit: ${config.takeProfitPercent}%`);
  logger.info(`Stop loss: ${config.stopLossPercent > 0 ? `${config.stopLossPercent}%` : "off"}`);
  logger.info(`Transport: ${config.wssRpcUrl ? "WebSocket" : "HTTP"}`);

  const tracker = new PositionTracker(clients);
  tracker.start();

  const unwatch = startLaunchWatcher(clients, tracker);

  const shutdown = () => {
    logger.info("Shutting down...");
    unwatch();
    tracker.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  logger.info("Listening for TokenLaunched events...");
}

main().catch((err) => {
  logger.error("Fatal error", err);
  process.exit(1);
});
 