import { config } from "@/config";
import { getTranslator } from "@/i18n/server";

export default async function HomePage() {
  const { t } = await getTranslator();
  return (
    <main>
      <h1>{config.appName}</h1>
      <p>{t("home.tagline")}</p>
    </main>
  );
}
