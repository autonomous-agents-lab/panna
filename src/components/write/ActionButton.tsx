"use client";

import { useDashboardAction } from "@/hooks/useDashboardAction";
import type { DashboardAction } from "@/lib/writing/dashboard/action-state";

/** A one-button form that runs a dashboard action with fixed fields, e.g. "Add page" for a chapter. */
export function ActionButton({
  action,
  fields = {},
  label,
  accessibleName,
  className,
}: {
  action: DashboardAction;
  fields?: Record<string, string>;
  label: string;
  /** When the visible label alone is ambiguous; it should start with the label. */
  accessibleName?: string;
  className?: string;
}) {
  const { submit } = useDashboardAction(action);
  return (
    <form action={submit}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" aria-label={accessibleName} className={className}>
        {label}
      </button>
    </form>
  );
}
