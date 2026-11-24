"use server";

import { persistLocale } from "./locale-cookie";
import { localeSchema } from "./locales";

/**
 * The locale switch's form action. Setting the cookie makes Next re-render the current route in
 * place, so the URL does not change. Anything but a supported locale is ignored.
 */
export async function setLocale(formData: FormData): Promise<void> {
  const parsed = localeSchema.safeParse(formData.get("locale"));
  if (!parsed.success) return;
  await persistLocale(parsed.data);
}
