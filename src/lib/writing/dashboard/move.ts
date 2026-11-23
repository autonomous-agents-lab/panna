import type { PageSummary } from "@/contracts";

export const MOVE_DIRECTIONS = ["up", "down"] as const;

export type MoveDirection = (typeof MOVE_DIRECTIONS)[number];

/** A new order, and where the moved item now is in it (1-based, as people count). */
export interface Move {
  ids: string[];
  position: number;
  count: number;
}

/** `ids` with `id` swapped with its neighbour; null for an unknown id or a move past either end. */
export function moveId(ids: readonly string[], id: string, direction: MoveDirection): Move | null {
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= ids.length) return null;
  const order = [...ids];
  order[from] = ids[to]!;
  order[to] = id;
  return { ids: order, position: to + 1, count: order.length };
}

/**
 * Moves a page among its chapter's pages that aren't archived, which are the ones the dashboard
 * lists in order. The contract's reorderPages needs every page id, so the archived ones follow,
 * in their existing relative order. Position and count are among the listed pages.
 */
export function pageOrderAfterMove(
  pages: readonly Pick<PageSummary, "id" | "status">[],
  id: string,
  direction: MoveDirection,
): Move | null {
  const listed = moveId(
    pages.filter((page) => page.status !== "archived").map((page) => page.id),
    id,
    direction,
  );
  if (!listed) return null;
  const archived = pages.filter((page) => page.status === "archived").map((page) => page.id);
  return { ...listed, ids: [...listed.ids, ...archived] };
}

/**
 * Which move button keeps focus after a move: the one pressed, unless the item has reached that
 * end and the button is now disabled, in which case the other one.
 */
export function focusTargetAfterMove(direction: MoveDirection, position: number, count: number): MoveDirection {
  if (direction === "up" && position === 1) return "down";
  if (direction === "down" && position === count) return "up";
  return direction;
}
