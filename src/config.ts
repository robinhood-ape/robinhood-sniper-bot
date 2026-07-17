import "dotenv/config";
import { type Address, type Hex, isAddress, isHex, parseEther } from "viem";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
}

function num(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Invalid number for ${name}: ${raw}`);
  return value;
}

const privateKeyRaw = required("PRIVATE_KEY");
if (!isHex(privateKeyRaw) || privateKeyRaw.length !== 66) {
  throw new Error("PRIVATE_KEY must be a 0x-prefixed 32-byte hex string");
}

const rpcUrl = optional("RPC_URL", "https://rpc.mainnet.chain.robinhood.com");
const wssRpcUrl = process.env.WSS_RPC_URL?.trim() || undefined;

const denyNameSubstrings = optional("DENY_NAME_SUBSTRINGS", "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const config = {
  privateKey: privateKeyRaw as Hex,
  rpcUrl,
  wssRpcUrl,
  dryRun: bool("DRY_RUN", true),
  buyAmountWei: parseEther(optional("BUY_AMOUNT_ETH", "0.01")),
  takeProfitPercent: num("TAKE_PROFIT_PERCENT", 50),
  stopLossPercent: num("STOP_LOSS_PERCENT", 0),
  slippageBps: num("SLIPPAGE_BPS", 500),
  minInitialBuyWei: parseEther(optional("MIN_INITIAL_BUY_ETH", "0")),
  maxOpenPositions: Math.max(1, Math.floor(num("MAX_OPEN_POSITIONS", 3))),
  denyNameSubstrings,
  pollMs: Math.max(500, Math.floor(num("POLL_MS", 2000))),
} as const;

export type AppConfig = typeof config;

export function assertAddress(value: string, label: string): Address {
  if (!isAddress(value)) throw new Error(`Invalid address for ${label}: ${value}`);
  return value;
}
