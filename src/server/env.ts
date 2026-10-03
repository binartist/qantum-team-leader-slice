import { z } from "zod";
import { InternalError } from "@/ports";

const httpUrl = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
});

const EnvSchema = z.object({
  SUPABASE_URL: httpUrl.optional(),
  SUPABASE_SERVICE_KEY: z.string().min(1).optional(),
  ACTIONS_STORE: z.enum(["memory", "supabase"]).optional(),
  DEMO_USER_ID: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/).optional(),
});

export interface AppEnv {
  readonly supabaseUrl: string | undefined;
  readonly supabaseServiceKey: string | undefined;
  readonly actionsStore: "memory" | "supabase" | undefined;
  readonly demoUserId: string;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  return value;
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = EnvSchema.safeParse({
    SUPABASE_URL: emptyToUndefined(source.SUPABASE_URL),
    SUPABASE_SERVICE_KEY: emptyToUndefined(source.SUPABASE_SERVICE_KEY),
    ACTIONS_STORE: emptyToUndefined(source.ACTIONS_STORE),
    DEMO_USER_ID: emptyToUndefined(source.DEMO_USER_ID),
  });
  if (!parsed.success) throw new InternalError("config_invalid");
  return {
    supabaseUrl: parsed.data.SUPABASE_URL,
    supabaseServiceKey: parsed.data.SUPABASE_SERVICE_KEY,
    actionsStore: parsed.data.ACTIONS_STORE,
    demoUserId: parsed.data.DEMO_USER_ID ?? "demo-leader",
  };
}
