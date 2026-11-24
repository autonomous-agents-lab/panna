import type { UsernameErrorCode } from "@/contracts/username";
import type { UsernameAvailability } from "@/contracts/onboarding";
import { validateUsername } from "@/lib/username";

/** What the username field's status region shows. */
export type UsernameCheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; username: string }
  | { status: "unavailable"; code: UsernameErrorCode };

export const IDLE_CHECK: UsernameCheckState = { status: "idle" };

export interface UsernameCheckerOptions {
  /** Asks the server; only called for names that pass the shared rules. */
  check: (username: string) => Promise<UsernameAvailability>;
  onState: (state: UsernameCheckState) => void;
  delayMs: number;
}

export interface UsernameChecker {
  /** Call on every change of the field. */
  update(raw: string): void;
  /** Stops any pending or in-flight check from reporting. */
  dispose(): void;
}

/**
 * Debounces availability checks: nothing is reported until typing pauses for `delayMs`, the
 * shared rules answer locally first, and only the latest server answer is shown, because an
 * older, slower response may arrive after a newer one.
 */
export function createUsernameChecker({ check, onState, delayMs }: UsernameCheckerOptions): UsernameChecker {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest = 0;

  const run = async (raw: string, request: number) => {
    const local = validateUsername(raw);
    if (!local.ok) return onState({ status: "unavailable", code: local.code });
    onState({ status: "checking" });
    const answer = await check(raw).catch((): UsernameAvailability => ({ status: "unknown" }));
    if (request !== latest) return;
    onState(answer.status === "unknown" ? IDLE_CHECK : answer);
  };

  return {
    update(raw) {
      clearTimeout(timer);
      const request = ++latest;
      onState(IDLE_CHECK);
      if (raw.trim() === "") return;
      timer = setTimeout(() => void run(raw, request), delayMs);
    },
    dispose() {
      clearTimeout(timer);
      latest++;
    },
  };
}
