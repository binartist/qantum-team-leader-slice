import { describe, expect, it } from "vitest";
import { poolConfig, type PgConnectionSettings } from "@/adapters/postgres/connection";
import { readEnv } from "@/server/env";
import { InternalError } from "@/ports";

function settings(overrides: Partial<PgConnectionSettings> = {}): PgConnectionSettings {
  return {
    host: "db.example",
    port: 6543,
    user: "qantum_slice",
    password: "db-password-marker",
    database: "qantum_slice",
    ssl: "require",
    poolMax: 1,
    ...overrides,
  };
}

describe("poolConfig", () => {
  it("maps disable, require, and verify-full, and turns CA newline escapes into newlines", () => {
    expect(poolConfig(settings({ ssl: "disable" })).ssl).toBe(false);
    expect(poolConfig(settings({ ssl: "require" })).ssl).toEqual({ rejectUnauthorized: false });
    const verified = poolConfig(settings({ ssl: "verify-full", sslCa: "-----BEGIN CERT-----\\nLINE\\n-----END CERT-----" }));
    expect(verified.ssl).toEqual({
      rejectUnauthorized: true,
      ca: "-----BEGIN CERT-----\nLINE\n-----END CERT-----",
    });
    expect(JSON.stringify(verified.ssl)).not.toContain("db-password-marker");
  });

  it("refuses verify-full without a CA and keeps short timeouts", () => {
    expect(() => poolConfig(settings({ ssl: "verify-full" }))).toThrow(InternalError);
    expect(() => poolConfig(settings({ ssl: "verify-full", sslCa: "" }))).toThrow(InternalError);
    try {
      poolConfig(settings({ ssl: "verify-full" }));
    } catch (error) {
      expect(error).toMatchObject({ reason: "config_invalid", message: "Something went wrong." });
      expect(String(error)).not.toContain("db-password-marker");
    }
    const config = poolConfig(settings());
    expect(config.connectionTimeoutMillis).toBe(5000);
    expect(config.idleTimeoutMillis).toBe(10000);
    expect(config.max).toBe(1);
    expect(config.host).toBe("db.example");
    expect(config.port).toBe(6543);
    expect(config.database).toBe("qantum_slice");
  });

  it("accepts a pool of 1 to 10 and rejects anything outside that", () => {
    expect(poolConfig(settings({ poolMax: 1 })).max).toBe(1);
    expect(poolConfig(settings({ poolMax: 10 })).max).toBe(10);
    for (const poolMax of [0, 11, 1.5, -1]) {
      expect(() => poolConfig(settings({ poolMax }))).toThrow(InternalError);
      try {
        poolConfig(settings({ poolMax }));
      } catch (error) {
        expect((error as InternalError).reason).toBe("config_invalid");
      }
    }
  });
});

describe("database env", () => {
  it("defaults port, ssl, and pool size, and keeps a CA escape sequence for the pool", () => {
    const env = readEnv({ DB_SSL_CA: "line1\\nline2" });
    expect(env.actionsStore).toBeUndefined();
    expect(env.dbHost).toBeUndefined();
    expect(env.dbPort).toBe(5432);
    expect(env.dbSsl).toBe("require");
    expect(env.dbPoolMax).toBe(1);
    expect(env.dbSslCa).toBe("line1\\nline2");
    expect(env.demoUserId).toBe("demo-leader");
  });

  it("rejects an out-of-range port, pool size, or ssl mode with config_invalid", () => {
    for (const source of [
      { DB_PORT: "0" },
      { DB_PORT: "65536" },
      { DB_PORT: "5432abc" },
      { DB_POOL_MAX: "0" },
      { DB_POOL_MAX: "11" },
      { DB_POOL_MAX: "1.5" },
      { DB_SSL: "allow" },
      { ACTIONS_STORE: "supabase" },
    ]) {
      expect(() => readEnv(source)).toThrow(InternalError);
      try {
        readEnv(source);
      } catch (error) {
        expect((error as InternalError).reason).toBe("config_invalid");
        expect(String(error)).toBe("InternalError: Something went wrong.");
      }
    }
    const env = readEnv({
      ACTIONS_STORE: "postgres",
      DB_HOST: "db.example",
      DB_PORT: "6543",
      DB_USER: "qantum_slice",
      DB_PASSWORD: "db-password-marker",
      DB_NAME: "qantum_slice",
      DB_SSL: "disable",
      DB_POOL_MAX: "10",
    });
    expect(env).toMatchObject({
      actionsStore: "postgres",
      dbHost: "db.example",
      dbPort: 6543,
      dbUser: "qantum_slice",
      dbPassword: "db-password-marker",
      dbName: "qantum_slice",
      dbSsl: "disable",
      dbPoolMax: 10,
    });
  });
});
