import { useCallback, useEffect, useRef, useState } from "react";

import { USERNAME_CHECK_DEBOUNCE_MS } from "@/config/usernames";
import type { UsernameAvailability } from "@/contracts/onboarding";
import {
  createUsernameChecker,
  IDLE_CHECK,
  type UsernameChecker,
  type UsernameCheckState,
} from "@/lib/onboarding/username-checker";

/**
 * The username field's live availability status. `update` takes every change of the field; the
 * debouncing, local rules and stale-answer handling live in `createUsernameChecker`.
 */
export function useUsernameAvailability(check: (username: string) => Promise<UsernameAvailability>): {
  state: UsernameCheckState;
  update: (raw: string) => void;
} {
  const [state, setState] = useState<UsernameCheckState>(IDLE_CHECK);
  const checker = useRef<UsernameChecker | null>(null);

  useEffect(() => {
    const created = createUsernameChecker({ check, onState: setState, delayMs: USERNAME_CHECK_DEBOUNCE_MS });
    checker.current = created;
    return () => created.dispose();
  }, [check]);

  const update = useCallback((raw: string) => checker.current?.update(raw), []);
  return { state, update };
}
