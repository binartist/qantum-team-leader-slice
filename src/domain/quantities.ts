/** Sum first, then round up. The 1e6 step stops binary float dust from crossing an integer. */
const QUANTITY_SCALE = 1e6;

export function snapQuantity(sum: number): number {
  return Math.round(sum * QUANTITY_SCALE) / QUANTITY_SCALE;
}

export function roundUpQuantity(sum: number): number {
  return Math.ceil(snapQuantity(sum));
}

/** A negative or non-finite quantity is not a usable amount. */
export function isNonNegativeFinite(quantity: number): boolean {
  return Number.isFinite(quantity) && quantity >= 0;
}

/**
 * Sum of stock rows snapped to the readiness precision.
 * Null when there are no rows, any row is unusable, or the snapped sum is not finite.
 */
export function onHandFromQuantities(quantities: readonly number[]): number | null {
  if (quantities.length === 0) return null;
  let sum = 0;
  let invalid = false;
  for (const quantity of quantities) {
    if (!isNonNegativeFinite(quantity)) {
      invalid = true;
      continue;
    }
    sum += quantity;
    if (!Number.isFinite(sum)) invalid = true;
  }
  const snapped = snapQuantity(sum);
  return invalid || !Number.isFinite(snapped) ? null : snapped;
}
