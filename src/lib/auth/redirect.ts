import { config } from "@/config";
import { AUTH_ROUTES } from "@/contracts/auth";

const HOME = "/";

// Slash-slash or slash-backslash makes a browser treat the rest as a host; control characters are
// stripped by URL parsers, so "/\t/evil.com" would become "//evil.com".
const OFF_SITE_SHAPE = /^[/\\]{2}|[\\\u0000-\u001F\u007F]/;

/** Paths that would send a signed-in user back into the sign-in flow. */
function isAuthPath(pathname: string): boolean {
  return [AUTH_ROUTES.login, "/auth"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function decodeOrNull(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Where to send a user after sign-in. Only a same-site path (with its query and hash) survives;
 * anything absolute, protocol-relative, backslashed, encoded to look like either, malformed, or
 * pointing back into /login or /auth/* becomes "/". Every `next` value goes through here.
 */
export function safeNextPath(value: unknown, base: string = config.siteUrl): string {
  if (typeof value !== "string" || !value.startsWith("/")) return HOME;
  const decoded = decodeOrNull(value);
  if (decoded === null || OFF_SITE_SHAPE.test(value) || OFF_SITE_SHAPE.test(decoded)) return HOME;

  const origin = new URL(base).origin;
  const url = new URL(value, origin);
  if (url.origin !== origin || isAuthPath(url.pathname)) return HOME;
  return `${url.pathname}${url.search}${url.hash}`;
}
