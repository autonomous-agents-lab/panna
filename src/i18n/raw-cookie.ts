/**
 * The undecoded value of the first cookie called `name` in a `Cookie` header. Next's `cookies()`
 * drops a cookie whose value is not valid percent-encoding, so this tells such a tampered cookie
 * apart from one that was never set.
 */
export function readRawCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator !== -1 && pair.slice(0, separator).trim() === name) return pair.slice(separator + 1).trim();
  }
  return undefined;
}
