import { endonymOf, LOCALES, type Locale, type Translate } from "@/i18n";
import { setLocale } from "@/i18n/set-locale";

import styles from "./LocaleSwitch.module.css";

/**
 * A form of native submit buttons, one per language, so it works without JavaScript and gets
 * Tab focus and Enter/Space for free. Each option is named in its own language and marked with
 * its own `lang`, so screen readers pronounce it and the right font applies.
 */
export function LocaleSwitch({ locale, t }: { locale: Locale; t: Translate }) {
  return (
    <form action={setLocale} role="group" aria-label={t("localeSwitch.label")} className={styles.switch}>
      {LOCALES.map((option) => (
        <button
          key={option}
          type="submit"
          name="locale"
          value={option}
          lang={option}
          aria-pressed={option === locale}
          className={styles.option}
        >
          {endonymOf(option)}
        </button>
      ))}
    </form>
  );
}
