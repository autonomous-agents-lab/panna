import { SignOutForm } from "@/components/auth/SignOutForm";
import { getTranslator } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/page-metadata";

const PATH = "/settings";

export function generateMetadata() {
  return pageMetadata({ path: PATH, titleKey: "settings.title", noindex: true });
}

/** A placeholder for the settings stories: who is signed in, and a way to sign out. */
export default async function SettingsPage() {
  const [{ t }, user] = await Promise.all([getTranslator(), requireUser(PATH)]);
  return (
    <>
      <h1>{t("settings.title")}</h1>
      <p>{t("auth.signedInAs", { email: user.email ?? "" })}</p>
      <SignOutForm t={t} />
    </>
  );
}
