import { getTranslator } from "@/i18n/server";

/** The id of the layout's single `<main>`, which the skip link targets. */
export const MAIN_ID = "main";

/**
 * The first focusable element on every page. A plain anchor, not next/link: following the
 * fragment natively moves focus to the `tabIndex={-1}` main landmark.
 */
export async function SkipLink() {
  const { t } = await getTranslator();
  return (
    <a href={`#${MAIN_ID}`} className="skip-link">
      {t("shell.skipToContent")}
    </a>
  );
}
