"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import { useDashboardAction } from "@/hooks/useDashboardAction";
import { useTranslator } from "@/i18n/client";
import type { DashboardAction, Moved } from "@/lib/writing/dashboard/action-state";
import { focusTargetAfterMove } from "@/lib/writing/dashboard/move";

import styles from "./write.module.css";

/**
 * Move up and Move down buttons for one item, disabled at either end. After a move, focus stays
 * on this item's controls once the list shows it in its new place, and the live region announces
 * the new position.
 */
export function MoveControls({
  action,
  idField,
  id,
  title,
  index,
  count,
}: {
  action: DashboardAction;
  idField: "chapterId" | "pageId";
  id: string;
  title: string;
  /** 0-based place among the items it moves between. */
  index: number;
  count: number;
}) {
  const t = useTranslator();
  const up = useRef<HTMLButtonElement>(null);
  const down = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<Moved | null>(null);

  // The action's result and the reordered list may arrive in different renders; focus moves
  // once both have.
  const placeFocus = (position: number) => {
    const moved = pendingFocus.current;
    if (!moved || moved.position !== position) return;
    pendingFocus.current = null;
    const target = focusTargetAfterMove(moved.direction, moved.position, moved.count);
    (target === "up" ? up : down).current?.focus();
  };

  const { submit } = useDashboardAction(action, (state) => {
    pendingFocus.current = state.moved ?? null;
    placeFocus(index + 1);
  });

  const onPlaced = useEffectEvent(() => placeFocus(index + 1));
  useEffect(() => onPlaced(), [index]);

  return (
    <form action={submit}>
      <input type="hidden" name={idField} value={id} />
      <button
        ref={up}
        type="submit"
        name="direction"
        value="up"
        className={styles.control}
        disabled={index === 0}
        aria-label={t("write.action.moveUpNamed", { title })}
      >
        {t("write.action.moveUp")}
      </button>
      <button
        ref={down}
        type="submit"
        name="direction"
        value="down"
        className={styles.control}
        disabled={index === count - 1}
        aria-label={t("write.action.moveDownNamed", { title })}
      >
        {t("write.action.moveDown")}
      </button>
    </form>
  );
}
