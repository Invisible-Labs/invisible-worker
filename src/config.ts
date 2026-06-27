import type { CoordinatorPoolConfig } from "@invisible-labs/sdk";
import { invisibleDev, invisibleProd } from "@invisible-labs/sdk/presets";

const COORDINATOR_POOL_ENV = "INVISIBLE_COORDINATOR_POOL_JSON";
const COORDINATOR_PRESET_ENV = "INVISIBLE_COORDINATOR_PRESET";
const SERVER_PORT_ENV = "PORT";
const PROD_PRESET = "prod";
const DEFAULT_PORT = 8787;

type Env = Record<string, string | undefined>;

export function loadCoordinatorPool(env: Env = process.env): CoordinatorPoolConfig {
  const rawPool = env[COORDINATOR_POOL_ENV];
  if (rawPool !== undefined && rawPool.trim().length > 0) {
    return JSON.parse(rawPool) as CoordinatorPoolConfig;
  }

  const preset = env[COORDINATOR_PRESET_ENV] ?? "dev";
  return {
    endpoints: preset === PROD_PRESET ? invisibleProd() : invisibleDev(),
  };
}

export function mutationsEnabled(env: Env = process.env): boolean {
  return env.INVISIBLE_ENABLE_MUTATIONS === "true";
}

export function serverPort(env: Env = process.env): number {
  const raw = env[SERVER_PORT_ENV];
  if (raw === undefined) return DEFAULT_PORT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_PORT;
  return parsed;
}
