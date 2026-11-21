"use server";

import { cookies } from "next/headers";

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE_SECONDS, localeSchema } from "./locales";

/**
 * The locale switch's form action. Setting the cookie makes Next re-render the current route in
 * place, so the URL does not change. Anything but a supported locale is ignored.
 */
export async function setLocale(formData: FormData): Promise<void> {
  const parsed = localeSchema.safeParse(formData.get("locale"));
  if (!parsed.success) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, parsed.data, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
