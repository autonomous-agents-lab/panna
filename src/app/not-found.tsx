import Link from "next/link";

import { getTranslator } from "@/i18n/server";
import { notFoundMetadata } from "@/lib/page-metadata";

export function generateMetadata() {
  return notFoundMetadata();
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
