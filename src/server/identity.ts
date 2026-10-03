import { readEnv } from "./env";

/** Demo identity. Replace this function when real authentication arrives. */
export function getCurrentUser(): { id: string } {
  return { id: readEnv().demoUserId };
}
