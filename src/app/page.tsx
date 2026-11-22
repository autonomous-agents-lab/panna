import { config } from "@/config";
import { getTranslator } from "@/i18n/server";
import { pageMetadata } from "@/lib/page-metadata";

export function generateMetadata() {
  return pageMetadata({ path: "/" });
}

export default async function HomePage() {
  const { t } = await getTranslator();
  return (
    <>
      <h1>{config.appName}</h1>
      <p>{t("home.tagline")}</p>
    </>
  );
}
