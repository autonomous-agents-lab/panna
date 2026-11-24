"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useDashboardAction } from "@/hooks/useDashboardAction";
import { useTranslator } from "@/i18n/client";
import { submittedText, type DashboardAction } from "@/lib/writing/dashboard/action-state";

import { TitleField } from "./TitleField";
import styles from "./write.module.css";

interface RenameProps {
  action: DashboardAction;
  /** The form field that carries the id: chapterId or pageId. */
  idField: "chapterId" | "pageId";
  id: string;
  /** The current title; null for an untitled page. */
  title: string | null;
  /** What the item is called on screen, for the button's accessible name. */
  displayTitle: string;
  label: string;
}

/**
 * A Rename button that turns into an inline title form. Saving or cancelling (also with Escape)
 * closes it and puts focus back on the Rename button.
 */
export function RenameForm({ displayTitle, ...props }: RenameProps) {
  const t = useTranslator();
  const [editing, setEditing] = useState(false);
  const renameButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (editing || !returnFocus.current) return;
    returnFocus.current = false;
    renameButton.current?.focus();
  }, [editing]);

  const close = () => {
    returnFocus.current = true;
    setEditing(false);
  };

  if (editing) return <RenameEditor {...props} onDone={close} />;
  return (
    <button
      ref={renameButton}
      type="button"
      className={styles.control}
      aria-label={t("write.action.renameNamed", { title: displayTitle })}
      onClick={() => setEditing(true)}
    >
      {t("write.action.rename")}
    </button>
  );
}

/** Mounted per edit, so an error from an earlier attempt never shows again. */
function RenameEditor({ action, idField, id, title, label, onDone }: Omit<RenameProps, "displayTitle"> & { onDone: () => void }) {
  const t = useTranslator();
  const inputId = useId();
  const { state, submit, submitted } = useDashboardAction(action, onDone);
  const keepTyped = state.status === "fieldError" || state.status === "failed";
  return (
    <form
      action={submit}
      className={styles.inlineForm}
      onKeyDown={(event) => {
        if (event.key === "Escape") onDone();
      }}
    >
      <input type="hidden" name={idField} value={id} />
      <TitleField
        id={inputId}
        label={label}
        defaultValue={keepTyped ? submittedText(submitted, "title") : (title ?? "")}
        error={state.status === "fieldError" ? state.message : undefined}
        autoFocus
      />
      <button type="submit" className={styles.control}>
        {t("write.action.save")}
      </button>
      <button type="button" className={styles.control} onClick={onDone}>
        {t("write.action.cancel")}
      </button>
    </form>
  );
}
