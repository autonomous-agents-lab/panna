"use client";

import { useMemo, useReducer, type ReactNode } from "react";

import { DashboardStatusContext, type DashboardStatusApi } from "@/hooks/useDashboardStatus";
import { useTranslator } from "@/i18n/client";
import { INITIAL_STATUS, statusReducer } from "@/lib/writing/dashboard/status";

import styles from "./write.module.css";

/**
 * Gives the dashboard's forms one polite live region for announcements and one failure notice
 * with a retry. The notice is inline and takes no focus, so the writer can carry on.
 */
export function DashboardStatusProvider({ children }: { children: ReactNode }) {
  const [{ announcement, failure }, dispatch] = useReducer(statusReducer, INITIAL_STATUS);
  const api = useMemo<DashboardStatusApi>(
    () => ({
      succeed: (message) => dispatch({ type: "succeed", announcement: message }),
      fail: (message, retry) => dispatch({ type: "fail", message, retry }),
    }),
    [],
  );
  const dismiss = () => dispatch({ type: "dismiss" });
  const retry = () => {
    dismiss();
    failure?.retry();
  };

  return (
    <DashboardStatusContext value={api}>
      <DashboardNotice message={failure?.message} onRetry={retry} onDismiss={dismiss} />
      {children}
      <p role="status" className={styles.visuallyHidden}>
        {announcement && <span key={announcement.id}>{announcement.message}</span>}
      </p>
    </DashboardStatusContext>
  );
}

/** The failure notice. Its alert region is always there, so a new message is announced. */
export function DashboardNotice({
  message,
  onRetry,
  onDismiss,
}: {
  message?: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslator();
  return (
    <div className={message ? styles.notice : undefined}>
      <p role="alert" className={styles.alert}>
        {message}
      </p>
      {message && (
        <>
          <button type="button" className={styles.control} onClick={onRetry}>
            {t("write.error.retry")}
          </button>
          <button type="button" className={styles.control} onClick={onDismiss}>
            {t("write.error.dismiss")}
          </button>
        </>
      )}
    </div>
  );
}
