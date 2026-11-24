import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { ONBOARDING_PATH } from "@/contracts/onboarding";
import { getTranslator } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/page-metadata";
import { getCurrentProfile } from "@/lib/profile/current-profile";

export function generateMetadata() {
  return pageMetadata({ path: ONBOARDING_PATH, titleKey: "onboarding.title", noindex: true });
}

/** Claim a username, a display name and a language; a user who already has a book goes to it. */
export default async function OnboardingPage() {
  const [{ locale, t }] = await Promise.all([getTranslator(), requireUser(ONBOARDING_PATH)]);
  const profile = await getCurrentProfile();
  if (profile) redirect(`/${profile.username}`);
  return (
    <>
      <h1>{t("onboarding.title")}</h1>
      <p>{t("onboarding.intro")}</p>
      <OnboardingForm defaultLanguage={locale} />
    </>
  );
}
