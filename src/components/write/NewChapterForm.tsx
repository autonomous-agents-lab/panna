"use client";

import { useId } from "react";

import { useDashboardAction } from "@/hooks/useDashboardAction";
import { useTranslator } from "@/i18n/client";
import { submittedText, type DashboardAction } from "@/lib/writing/dashboard/action-state";

import { TitleField } from "./TitleField";
import styles from "./write.module.css";

/** Adds a chapter at the end of the book. What was typed stays after an error, and clears once saved. */
export function NewChapterForm({ action }: { action: DashboardAction }) {
  const t = useTranslator();
  const id = useId();
  const { state, submit, submitted } = useDashboardAction(action);
  const keepTyped = state.status === "fieldError" || state.status === "failed";
  return (
    <form action={submit} className={styles.inlineForm}>
      <TitleField
        id={id}
        label={t("write.newChapter.label")}
        defaultValue={keepTyped ? submittedText(submitted, "title") : ""}
        error={state.status === "fieldError" ? state.message : undefined}
      />
      <button type="submit" className={styles.control}>
        {t("write.newChapter.submit")}
      </button>
    </form>
  );
}
