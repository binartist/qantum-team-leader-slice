/** Comparison key for substrate, service type and service size. Does not strip commas or reformat sizes. */
export function normaliseText(value: string): string {
  const collapsed = value.trim().replace(/\s+/g, " ");
  const parentheses = collapsed.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  const units = parentheses.replace(/(\d)\s+mm/gi, "$1mm");
  return units.toLowerCase();
}

/** A substrate cut off after the family name. Trailing whitespace does not make it complete. */
export function isIncompleteSubstrate(raw: string): boolean {
  return raw.trim().endsWith(",");
}
