import { getTranslator } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/page-metadata";

const PATH = "/onboarding";

export function generateMetadata() {
  return pageMetadata({ path: PATH, titleKey: "onboarding.title", noindex: true });
}

/** A placeholder for the onboarding stories: who is signed in. */
export default async function OnboardingPage() {
  const [{ t }, user] = await Promise.all([getTranslator(), requireUser(PATH)]);
  return (
    <>
      <h1>{t("onboarding.title")}</h1>
      <p>{t("auth.signedInAs", { email: user.email ?? "" })}</p>
    </>
  );
}
