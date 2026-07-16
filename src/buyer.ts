import { formatEther, type Address, type Hex } from "viem";
import { config } from "./config.js";
import {
  ADDRESSES,
  erc20Abi,
  quoterV2Abi,
  swapRouter02Abi,
  wethAbi,
  type Clients,
} from "./chain.js";
import { logger } from "./logger.js";

function applySlippageMinOut(quotedOut: bigint, slippageBps: number): bigint {
  return (quotedOut * BigInt(10_000 - slippageBps)) / 10_000n;
}

export async function ensureWethBalance(clients: Clients, amountWei: bigint): Promise<void> {
  const balance = await clients.publicClient.readContract({
    address: ADDRESSES.weth,
    abi: wethAbi,
    functionName: "balanceOf",
    args: [clients.account.address],
  });

  if (balance >= amountWei) return;

  const need = amountWei - balance;
  logger.info(`Wrapping ${formatEther(need)} ETH -> WETH`);

  if (config.dryRun) {
    logger.info("[DRY_RUN] skip WETH deposit");
    return;
  }

  const hash = await clients.walletClient.writeContract({
    address: ADDRESSES.weth,
    abi: wethAbi,
    functionName: "deposit",
    value: need,
    account: clients.account,
    chain: clients.walletClient.chain,
  });
  await clients.publicClient.waitForTransactionReceipt({ hash });
  logger.info(`WETH deposit confirmed: ${hash}`);
}

export async function ensureAllowance(
  clients: Clients,
  token: Address,
  spender: Address,
  amount: bigint,
): Promise<void> {
  const allowance = await clients.publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [clients.account.address, spender],
  });

  if (allowance >= amount) return;

  logger.info(`Approving ${spender} for ${token}`);
  if (config.dryRun) {
    logger.info("[DRY_RUN] skip approve");
    return;
  }

  const hash = await clients.walletClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
    account: clients.account,
    chain: clients.walletClient.chain,
  });
  await clients.publicClient.waitForTransactionReceipt({ hash });
  logger.info(`Approve confirmed: ${hash}`);
}

export async function quoteExactInputSingle(
  clients: Clients,
  tokenIn: Address,
  tokenOut: Address,
  fee: number,
  amountIn: bigint,
): Promise<bigint> {
  const result = await clients.publicClient.simulateContract({
    address: ADDRESSES.quoterV2,
    abi: quoterV2Abi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        tokenIn,
        tokenOut,
        amountIn,
        fee,
        sqrtPriceLimitX96: 0n,
      },
    ],
    account: clients.account.address,
  });
  return result.result[0];
}

export type BuyResult = {
  txHash: Hex | "dry-run";
  amountIn: bigint;
  amountOut: bigint;
  tokenBalance: bigint;
};

export async function buyToken(
  clients: Clients,
  token: Address,
  poolFee: number,
): Promise<BuyResult> {
  const amountIn = config.buyAmountWei;
  await ensureWethBalance(clients, amountIn);
  await ensureAllowance(clients, ADDRESSES.weth, ADDRESSES.swapRouter02, amountIn);

  let quotedOut = 0n;
  try {
    quotedOut = await quoteExactInputSingle(
      clients,
      ADDRESSES.weth,
      token,
      poolFee,
      amountIn,
    );
  } catch (err) {
    logger.warn("Quote failed; using amountOutMinimum=0 (higher slippage risk)", err);
  }

  const amountOutMinimum =
    quotedOut > 0n ? applySlippageMinOut(quotedOut, config.slippageBps) : 0n;

  logger.info(
    `Buying ${token} with ${formatEther(amountIn)} WETH (fee=${poolFee}, minOut=${amountOutMinimum})`,
  );

  if (config.dryRun) {
    logger.info("[DRY_RUN] skip buy swap");
    return {
      txHash: "dry-run",
      amountIn,
      amountOut: quotedOut,
      tokenBalance: quotedOut > 0n ? quotedOut : 1n,
    };
  }

  const hash = await clients.walletClient.writeContract({
    address: ADDRESSES.swapRouter02,
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: ADDRESSES.weth,
        tokenOut: token,
        fee: poolFee,
        recipient: clients.account.address,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
    account: clients.account,
    chain: clients.walletClient.chain,
  });

  await clients.publicClient.waitForTransactionReceipt({ hash });

  const tokenBalance = await clients.publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [clients.account.address],
  });

  logger.info(`Buy confirmed ${hash}, balance=${tokenBalance}`);
  return { txHash: hash, amountIn, amountOut: tokenBalance, tokenBalance };
}
