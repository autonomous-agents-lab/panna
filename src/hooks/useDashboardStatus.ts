"use client";

import { createContext, useContext } from "react";

/** How dashboard forms report back: announce a success, or show a failure with a retry. */
export interface DashboardStatusApi {
  succeed(announcement?: string): void;
  fail(message: string, retry: () => void): void;
}

export const DashboardStatusContext = createContext<DashboardStatusApi | null>(null);

export function useDashboardStatus(): DashboardStatusApi {
  const status = useContext(DashboardStatusContext);
  if (!status) throw new Error("useDashboardStatus must be used inside DashboardStatusProvider");
  return status;
}
