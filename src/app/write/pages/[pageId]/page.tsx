import Link from "next/link";
import { notFound } from "next/navigation";

import { PageTitle } from "@/components/write/PageItem";
import { StatusBadge } from "@/components/write/StatusBadge";
import styles from "@/components/write/write.module.css";
import { pageStatusOf, type Language } from "@/contracts";
import type { MessageKey } from "@/i18n";
import { getTranslator } from "@/i18n/server";
import { pageMetadata } from "@/lib/page-metadata";
import { WRITE_PATH } from "@/lib/writing/routes";

import { assertWritingEnabled, loadWriting } from "../../guard";

const LANGUAGE_NAMES = {
  en: "write.language.en",
  hi: "write.language.hi",
} as const satisfies Record<Language, MessageKey>;

export function generateMetadata() {
  assertWritingEnabled();
  return pageMetadata({ titleKey: "write.editor.title", noindex: true });
}

/**
 * Where a page opens for editing. A placeholder until the editor story replaces its body: it
 * shows the page's details and links back. Unknown pages, and other writers', are a 404.
 */
export default async function EditorPage({ params }: { params: Promise<{ pageId: string }> }) {
  const [{ repository, writer }, { pageId }] = await Promise.all([loadWriting(), params]);
  const [{ t }, result] = await Promise.all([getTranslator(), repository.getPageForEdit(writer, { pageId })]);
  if (!result.ok) notFound();
  const page = result.value;

  return (
    <div className={styles.dashboard}>
      <h1>{t("write.editor.title")}</h1>
      <p>
        <PageTitle page={page} t={t} />
      </p>
      <dl className={styles.details}>
        <dt>{t("write.editor.language")}</dt>
        <dd>{t(LANGUAGE_NAMES[page.language])}</dd>
        <dt>{t("write.editor.status")}</dt>
        <dd>
          <StatusBadge status={pageStatusOf(page)} t={t} />
        </dd>
      </dl>
      <p>{t("write.editor.comingSoon")}</p>
      <p>
        <Link href={WRITE_PATH} className={styles.link}>
          {t("write.editor.back")}
        </Link>
      </p>
    </div>
  );
}
