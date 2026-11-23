import { SIGN_IN_NEXT_PARAM, SIGN_IN_PATH } from "@/config/auth";
import type { CurrentWriter, GetCurrentWriter } from "@/contracts";

/**
 * The sign-in URL that comes back to `next` afterwards. Callers pass a fixed internal path, never
 * one taken from the request, so this can't become an open redirect.
 */
export function signInPath(next: string): string {
  return `${SIGN_IN_PATH}?${new URLSearchParams({ [SIGN_IN_NEXT_PARAM]: next })}`;
}

/**
 * The signed-in writer, or a redirect to sign-in. The stand-in guard for now; the auth epic's
 * getCurrentWriter (BOOK-17) plugs in unchanged.
 */
export async function requireWriter(
  getCurrentWriter: GetCurrentWriter,
  redirect: (url: string) => never,
  next: string,
): Promise<CurrentWriter> {
  return (await getCurrentWriter()) ?? redirect(signInPath(next));
}
