import type { MoveDirection } from "./move";

/** Where an item went, so the move controls can keep focus on it. */
export interface Moved {
  direction: MoveDirection;
  position: number;
  count: number;
}

/**
 * What a dashboard Server Action tells the form that called it. Messages are already translated.
 * fieldError is an invalid title, shown inline; failed is anything else that saved nothing.
 */
export type ActionState =
  | { status: "idle" }
  | { status: "ok"; announcement?: string; moved?: Moved }
  | { status: "fieldError"; message: string }
  | { status: "failed"; message: string };

export const IDLE: ActionState = { status: "idle" };

/** A dashboard Server Action, in the shape useActionState takes. */
export type DashboardAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * `action`, with a call that rejects (e.g. the network is down) turned into `failed()` instead of
 * the error page. `rethrow` lets framework signals such as a redirect through.
 */
export function failSafe(
  action: DashboardAction,
  failed: () => ActionState,
  rethrow: (error: unknown) => void,
): DashboardAction {
  return async (state, formData) => {
    try {
      return await action(state, formData);
    } catch (error) {
      rethrow(error);
      return failed();
    }
  };
}

/** A submitted text field, or "" when there was none. */
export function submittedText(formData: FormData | null, name: string): string {
  const value = formData?.get(name);
  return typeof value === "string" ? value : "";
}
