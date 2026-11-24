import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { hasSupabaseConfig } from "@/config";
import { ERROR_PARAM, loginErrorCodeSchema, NEXT_PARAM } from "@/contracts/auth";
import { getTranslator } from "@/i18n/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/page-metadata";

import styles from "./page.module.css";

type SearchParams = Record<string, string | string[] | undefined>;

export function generateMetadata() {
  return pageMetadata({ path: "/login", titleKey: "auth.login.title", noindex: true });
}

/** Sign in with an emailed link or Google. A signed-in visitor goes straight on to `next`. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const next = safeNextPath(params[NEXT_PARAM]);
  const [{ t }, user] = await Promise.all([getTranslator(), getCurrentUser()]);
  if (user) redirect(next);

  const loginError = loginErrorCodeSchema.safeParse(params[ERROR_PARAM]);
  return (
    <div className={styles.login}>
      <h1 className={styles.title}>{t("auth.login.title")}</h1>
      {hasSupabaseConfig() ? (
        <>
          <p className={styles.intro}>{t("auth.login.intro")}</p>
          <LoginForm next={next} loginError={loginError.success ? loginError.data : undefined} />
        </>
      ) : (
        <p role="status">{t("auth.login.unavailable")}</p>
      )}
    </div>
  );
}
