"use client";

import { useTranslator } from "@/i18n/client";

/**
 * Shown when a route throws while rendering. It never renders the error's message, stack or
 * digest. The home link is a plain anchor so it fully reloads, leaving the broken state behind.
 * The text is announced as an alert instead of taking focus, so the first Tab still reaches the
 * skip link.
 */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslator();
  return (
    <>
      <div role="alert">
        <h1>{t("error.title")}</h1>
        <p>{t("error.body")}</p>
      </div>
      <p>
        <button type="button" onClick={reset}>
          {t("error.retry")}
        </button>
      </p>
      <p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload is the point */}
        <a href="/">{t("error.home")}</a>
      </p>
    </>
  );
}
