export type ReorderResult = { ok: true; positions: Map<string, number> } | { ok: false; error: "invalid_order" };

/**
 * New positions 0..n-1 in the order of `requestedIds`, which must be exactly the ids in scope
 * (`existingIds`): no foreign, missing or repeated id.
 */
export function reorder(existingIds: readonly string[], requestedIds: readonly string[]): ReorderResult {
  const existing = new Set(existingIds);
  const isPermutation =
    requestedIds.length === existing.size &&
    new Set(requestedIds).size === requestedIds.length &&
    requestedIds.every((id) => existing.has(id));
  if (!isPermutation) return { ok: false, error: "invalid_order" };
  return { ok: true, positions: new Map(requestedIds.map((id, index) => [id, index])) };
}

/** The position after the last item, so an append never collides; 0 for an empty list. */
export function nextPosition(items: readonly { position: number }[]): number {
  return items.reduce((next, item) => Math.max(next, item.position + 1), 0);
}
