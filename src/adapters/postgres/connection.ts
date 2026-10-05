import type { PoolConfig } from "pg";
import { InternalError } from "@/ports";

export interface PgConnectionSettings {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
  readonly ssl: "disable" | "require" | "verify-full";
  readonly sslCa?: string;
  readonly poolMax: number;
}

/** Transaction-pooler safe: callers must send unnamed queries. One connection per function (max 1) unless DB_POOL_MAX says otherwise. */
export function poolConfig(settings: PgConnectionSettings): PoolConfig {
  if (!Number.isInteger(settings.poolMax) || settings.poolMax < 1 || settings.poolMax > 10) {
    throw new InternalError("config_invalid");
  }
  return {
    host: settings.host,
    port: settings.port,
    user: settings.user,
    password: settings.password,
    database: settings.database,
    max: settings.poolMax,
    ssl: sslConfig(settings),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  };
}

function sslConfig(settings: PgConnectionSettings): PoolConfig["ssl"] {
  if (settings.ssl === "disable") return false;
  if (settings.ssl === "require") return { rejectUnauthorized: false };
  const ca = expandCa(settings.sslCa);
  if (!ca) throw new InternalError("config_invalid");
  return { rejectUnauthorized: true, ca };
}

function expandCa(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  return value.replace(/\\n/g, "\n");
}
