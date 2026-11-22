import type { CookieMethodsServer, CookieOptions } from "@supabase/ssr";

/** The part of Next's `cookies()` store the Supabase server client needs. */
export type CookieStore = {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options: CookieOptions): void;
};

/** Adapts a request cookie store to the `getAll`/`setAll` methods `@supabase/ssr` expects. */
export function createCookieAdapter(store: CookieStore): Required<Pick<CookieMethodsServer, "getAll" | "setAll">> {
  return {
    getAll: () => store.getAll(),
    setAll: (cookiesToSet) => {
      try {
        for (const { name, value, options } of cookiesToSet) store.set(name, value, options);
      } catch {
        // Next forbids cookie writes during Server Component rendering; skipping keeps reads working.
      }
    },
  };
}
