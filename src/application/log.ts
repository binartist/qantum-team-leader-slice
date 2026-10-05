const EVENT = /^[a-z0-9_]{1,40}$/;
const FIELD = /^(siteId|shortageId|penetrationId|code|system|kind|status|created|reason|host|port|user|database|ssl|passwordPresent)$/;
const TOKEN = /^[A-Za-z0-9._:-]{1,80}$/;

/** One JSON line. Drops notes, reasons, bodies, keys, and upstream messages. */
export function log(event: string, fields: Readonly<Record<string, unknown>> = {}): void {
  if (!EVENT.test(event)) return;
  const safe: Record<string, string | number | boolean | null> = { event };
  for (const [key, value] of Object.entries(fields)) {
    if (!FIELD.test(key)) continue;
    if (typeof value === "string") {
      if (!TOKEN.test(value)) continue;
      safe[key] = value;
      continue;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) continue;
      safe[key] = value;
      continue;
    }
    if (typeof value === "boolean" || value === null) safe[key] = value;
  }
  console.log(JSON.stringify(safe));
}
