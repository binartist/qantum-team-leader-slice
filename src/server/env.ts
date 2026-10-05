import { z } from "zod";
import { InternalError } from "@/ports";

const boundedInt = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform((value) => Number(value))
    .refine((value) => Number.isInteger(value) && value >= min && value <= max);

const EnvSchema = z.object({
  ACTIONS_STORE: z.enum(["memory", "postgres"]).optional(),
  DB_HOST: z.string().min(1).optional(),
  DB_PORT: boundedInt(1, 65535).optional(),
  DB_USER: z.string().min(1).optional(),
  DB_PASSWORD: z.string().min(1).optional(),
  DB_NAME: z.string().min(1).optional(),
  DB_SSL: z.enum(["disable", "require", "verify-full"]).optional(),
  DB_SSL_CA: z.string().min(1).optional(),
  DB_POOL_MAX: boundedInt(1, 10).optional(),
  DEMO_USER_ID: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/).optional(),
});

export interface AppEnv {
  readonly actionsStore: "memory" | "postgres" | undefined;
  readonly dbHost: string | undefined;
  readonly dbPort: number;
  readonly dbUser: string | undefined;
  readonly dbPassword: string | undefined;
  readonly dbName: string | undefined;
  readonly dbSsl: "disable" | "require" | "verify-full";
  readonly dbSslCa: string | undefined;
  readonly dbPoolMax: number;
  readonly demoUserId: string;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  return value;
}

export function readEnv(source: Readonly<Record<string, string | undefined>> = process.env): AppEnv {
  const parsed = EnvSchema.safeParse({
    ACTIONS_STORE: emptyToUndefined(source.ACTIONS_STORE),
    DB_HOST: emptyToUndefined(source.DB_HOST),
    DB_PORT: emptyToUndefined(source.DB_PORT),
    DB_USER: emptyToUndefined(source.DB_USER),
    DB_PASSWORD: emptyToUndefined(source.DB_PASSWORD),
    DB_NAME: emptyToUndefined(source.DB_NAME),
    DB_SSL: emptyToUndefined(source.DB_SSL),
    DB_SSL_CA: emptyToUndefined(source.DB_SSL_CA),
    DB_POOL_MAX: emptyToUndefined(source.DB_POOL_MAX),
    DEMO_USER_ID: emptyToUndefined(source.DEMO_USER_ID),
  });
  if (!parsed.success) throw new InternalError("config_invalid");
  return {
    actionsStore: parsed.data.ACTIONS_STORE,
    dbHost: parsed.data.DB_HOST,
    dbPort: parsed.data.DB_PORT ?? 5432,
    dbUser: parsed.data.DB_USER,
    dbPassword: parsed.data.DB_PASSWORD,
    dbName: parsed.data.DB_NAME,
    dbSsl: parsed.data.DB_SSL ?? "require",
    dbSslCa: parsed.data.DB_SSL_CA,
    dbPoolMax: parsed.data.DB_POOL_MAX ?? 1,
    demoUserId: parsed.data.DEMO_USER_ID ?? "demo-leader",
  };
}
