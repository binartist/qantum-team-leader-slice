const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "unknown";
  const rounded = Math.round(value * 1e6) / 1e6;
  if (Object.is(rounded, -0)) return "0";
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatNeed(required: number, onHand: number | null, shortfall: number | null, unit: string): string {
  if (onHand === null || shortfall === null) return `Need ${formatQuantity(required)}, stock unknown`;
  return `Need ${formatQuantity(required)}, have ${formatQuantity(onHand)}, short ${formatQuantity(shortfall)} ${unit}`;
}

function utcStamp(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const month = MONTHS[date.getUTCMonth()]!;
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}, ${hours}:${minutes} UTC`;
}

export function formatAsOf(iso: string): string {
  const stamp = utcStamp(iso);
  return stamp ? `As of ${stamp}` : "As of unknown";
}

export function formatRecordedAt(iso: string): string {
  return utcStamp(iso) ?? "Time unknown";
}

export function formatMaterialSummary(
  lines: readonly { readonly materialId: string; readonly requiredQty: number; readonly onHandQty: number | null }[],
  materials: Readonly<Record<string, { readonly name: string }>>,
): string {
  return lines
    .map((line) => {
      const name = materials[line.materialId]?.name ?? line.materialId;
      return `${name} x${formatQuantity(line.requiredQty)}`;
    })
    .join(", ");
}

export function characterCountLabel(value: string): string {
  return `${value.trim().length} of 500 characters`;
}

export function formatRating(integrity: number | null, insulation: number | null): string {
  const left = integrity === null ? "not claimed" : formatQuantity(integrity);
  const right = insulation === null ? "not claimed" : formatQuantity(insulation);
  return `${left}/${right}`;
}

export function affectedCount(count: number): string {
  return count === 1 ? "Affects 1 penetration" : `Affects ${count} penetrations`;
}

export function sitePath(siteId: string): string {
  return `/sites/${encodeURIComponent(siteId)}`;
}

export function actionsPath(siteId: string): string {
  return `/sites/${encodeURIComponent(siteId)}/actions`;
}

export function penetrationPath(siteId: string, penetrationId: string): string {
  return `/sites/${encodeURIComponent(siteId)}/penetrations/${encodeURIComponent(penetrationId)}`;
}

export function actionTarget(
  siteId: string,
  shortageId: string,
  materials: Readonly<Record<string, { readonly name: string }>>,
  penetrations: Readonly<Record<string, { readonly floor: string; readonly location: string }>>,
): string {
  const prefix = `${siteId}:`;
  const rest = shortageId.startsWith(prefix) ? shortageId.slice(prefix.length) : shortageId;
  if (rest.startsWith("blocker.")) {
    const penetrationId = rest.slice("blocker.".length);
    if (penetrationId.length === 0) return shortageId;
    const place = penetrations[penetrationId];
    if (!place) return penetrationId;
    return `${place.floor}, ${place.location}`;
  }
  return materials[rest]?.name ?? rest;
}

export function actionSentence(
  kind: "wait" | "escalate",
  escalateTo: "purchasing" | "warehouse" | null,
  target: string,
): string {
  if (kind === "wait") return `Wait: ${target}`;
  if (escalateTo === "purchasing") return `Escalated to purchasing: ${target}`;
  if (escalateTo === "warehouse") return `Escalated to warehouse: ${target}`;
  return `Escalated: ${target}`;
}

export function proposalSentence(fromCode: string, toCode: string): string {
  return `Proposed substitute: ${fromCode} to ${toCode}`;
}
