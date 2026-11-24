/**
 * The dashboard's shared status: the latest announcement for the live region and the failure
 * notice, if any. Each announcement gets a new id, so the same words are announced again.
 */
export interface DashboardStatusState {
  announcement: { id: number; message: string } | null;
  failure: { message: string; retry: () => void } | null;
}

export type DashboardStatusEvent =
  | { type: "succeed"; announcement?: string }
  | { type: "fail"; message: string; retry: () => void }
  | { type: "dismiss" };

export const INITIAL_STATUS: DashboardStatusState = { announcement: null, failure: null };

/** A success clears the failure notice; a failure replaces it, keeping the last announcement. */
export function statusReducer(state: DashboardStatusState, event: DashboardStatusEvent): DashboardStatusState {
  switch (event.type) {
    case "succeed":
      return {
        failure: null,
        announcement:
          event.announcement === undefined
            ? state.announcement
            : { id: (state.announcement?.id ?? 0) + 1, message: event.announcement },
      };
    case "fail":
      return { ...state, failure: { message: event.message, retry: event.retry } };
    case "dismiss":
      return { ...state, failure: null };
  }
}
