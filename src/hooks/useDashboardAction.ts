"use client";

import { unstable_rethrow } from "next/navigation";
import { startTransition, useActionState, useEffect, useEffectEvent, useMemo, useState } from "react";

import { useTranslator } from "@/i18n/client";
import { IDLE, failSafe, type ActionState, type DashboardAction } from "@/lib/writing/dashboard/action-state";

import { useDashboardStatus } from "./useDashboardStatus";

type OkState = Extract<ActionState, { status: "ok" }>;

/**
 * A dashboard Server Action for a form. Successes are announced in the dashboard's live region
 * and failures shown in its notice, whose retry resubmits the same form data. `submitted` is the
 * last form data sent, so a form can keep what the writer typed after an error.
 */
export function useDashboardAction(action: DashboardAction, onOk?: (state: OkState) => void) {
  const t = useTranslator();
  const status = useDashboardStatus();
  const safeAction = useMemo(
    () => failSafe(action, () => ({ status: "failed", message: t("write.error.saveFailed") }), unstable_rethrow),
    [action, t],
  );
  const [state, dispatch] = useActionState(safeAction, IDLE);
  const [submitted, setSubmitted] = useState<FormData | null>(null);

  const submit = (formData: FormData) => {
    setSubmitted(formData);
    dispatch(formData);
  };

  const report = useEffectEvent((result: ActionState) => {
    if (result.status === "failed" && submitted) {
      status.fail(result.message, () => startTransition(() => dispatch(submitted)));
    } else if (result.status === "ok") {
      status.succeed(result.announcement);
      onOk?.(result);
    }
  });

  useEffect(() => report(state), [state]);

  return { state, submit, submitted };
}
