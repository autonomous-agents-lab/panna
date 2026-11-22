import Link from "next/link";

import { getTranslator } from "@/i18n/server";
import { pageMetadata } from "@/lib/page-metadata";

// not-found can't see the requested path, so the canonical is the home page it links to.
export function generateMetadata() {
  return pageMetadata({ path: "/", titleKey: "notFound.title", noindex: true });
}

export default async function NotFound() {
  const { t } = await getTranslator();
  return (
    <>
      <h1>{t("notFound.title")}</h1>
      <p>{t("notFound.body")}</p>
      <p>
        <Link href="/">{t("notFound.home")}</Link>
      </p>
    </>
  );
}
