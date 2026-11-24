"use client";

import { useActionState, useEffect, useId, useRef, type Ref } from "react";

import { checkUsername, createProfile } from "@/app/onboarding/actions";
import { config, CONTENT_LANGUAGES, TEXT_LIMITS, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/config";
import type { Language } from "@/contracts/language";
import type { OnboardingResult } from "@/contracts/onboarding";
import { useUsernameAvailability } from "@/hooks/useUsernameAvailability";
import { endonymOf, type MessageKey } from "@/i18n";
import { useTranslator } from "@/i18n/client";
import { focusFirstInvalid } from "@/lib/onboarding/focus";
import type { UsernameCheckState } from "@/lib/onboarding/username-checker";
import { usernameErrorMessage } from "@/lib/username";

import authStyles from "../auth/auth.module.css";
import styles from "./OnboardingForm.module.css";
import { UsernameStatus } from "./UsernameStatus";

const IDLE: OnboardingResult = { status: "idle" };

const DISPLAY_NAME_ERRORS = {
  required: "onboarding.displayName.error.required",
  too_long: "onboarding.displayName.error.too_long",
} as const satisfies Record<string, MessageKey>;

/** The onboarding form, wired to its Server Actions, moving focus to the first invalid field. */
export function OnboardingForm({ defaultLanguage }: { defaultLanguage: Language }) {
  const [result, action, pending] = useActionState(createProfile, IDLE);
  const availability = useUsernameAvailability(checkUsername);
  const username = useRef<HTMLInputElement>(null);
  const displayName = useRef<HTMLInputElement>(null);
  const language = useRef<HTMLInputElement>(null);
  const { update } = availability;

  useEffect(() => {
    if (result.status !== "invalid") return;
    // The server's answer replaces the live status, which may say a name it just refused is free.
    if (result.errors.username) update("");
    focusFirstInvalid(result.errors, {
      username: username.current,
      display_name: displayName.current,
      preferred_language: language.current,
    });
  }, [result, update]);

  return (
    <OnboardingFormFields
      defaultLanguage={defaultLanguage}
      result={result}
      pending={pending}
      action={action}
      availability={availability.state}
      onUsernameChange={update}
      refs={{ username, displayName, language }}
    />
  );
}

type OnboardingFormFieldsProps = {
  defaultLanguage: Language;
  result: OnboardingResult;
  pending: boolean;
  action: (formData: FormData) => void;
  availability: UsernameCheckState;
  onUsernameChange: (raw: string) => void;
  refs?: {
    username: Ref<HTMLInputElement>;
    displayName: Ref<HTMLInputElement>;
    language: Ref<HTMLInputElement>;
  };
};

const ids = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ") || undefined;

/**
 * What the onboarding form shows for a given state. A native form with `noValidate`, so errors
 * come from the server in the page's language; each is inline, tied to its field and announced.
 */
export function OnboardingFormFields({
  defaultLanguage,
  result,
  pending,
  action,
  availability,
  onUsernameChange,
  refs,
}: OnboardingFormFieldsProps) {
  const t = useTranslator();
  const id = useId();
  const errors = result.status === "invalid" ? result.errors : {};
  const values = result.status === "idle" ? undefined : result.values;
  const chosen = CONTENT_LANGUAGES.find((language) => language === values?.preferred_language) ?? defaultLanguage;

  const field = (name: string) => ({
    input: `${id}-${name}`,
    hint: `${id}-${name}-hint`,
    error: `${id}-${name}-error`,
  });
  const usernameIds = { ...field("username"), status: `${id}-username-status` };
  const displayNameIds = field("display-name");
  const languageIds = field("language");
  const formErrorId = `${id}-form-error`;
  const usernameError = errors.username && usernameErrorMessage(errors.username);

  return (
    <form action={action} noValidate className={styles.form}>
      <div role="alert">
        {result.status === "failed" && (
          <p id={formErrorId} className={`${styles.message} ${styles.error}`}>
            {t("onboarding.failed")}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor={usernameIds.input} className={styles.label}>
          {t("onboarding.username.label")}
        </label>
        <p id={usernameIds.hint} className={styles.hint}>
          {t("onboarding.username.hint", { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH })}
        </p>
        <input
          ref={refs?.username}
          id={usernameIds.input}
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={values?.username ?? ""}
          onChange={(event) => onUsernameChange(event.target.value)}
          aria-invalid={usernameError !== undefined}
          aria-describedby={ids(usernameIds.hint, usernameError && usernameIds.error, usernameIds.status)}
          className={styles.input}
        />
        {usernameError && (
          <p id={usernameIds.error} role="alert" className={`${styles.fieldError} ${styles.error}`}>
            {t(usernameError.key, usernameError.values)}
          </p>
        )}
        <UsernameStatus id={usernameIds.status} state={availability} />
      </div>

      <div className={styles.field}>
        <label htmlFor={displayNameIds.input} className={styles.label}>
          {t("onboarding.displayName.label")}
        </label>
        <p id={displayNameIds.hint} className={styles.hint}>
          {t("onboarding.displayName.hint", { max: TEXT_LIMITS.displayName.max })}
        </p>
        <input
          ref={refs?.displayName}
          id={displayNameIds.input}
          name="display_name"
          type="text"
          autoComplete="name"
          required
          defaultValue={values?.display_name ?? ""}
          aria-invalid={errors.display_name !== undefined}
          aria-describedby={ids(displayNameIds.hint, errors.display_name && displayNameIds.error)}
          className={styles.input}
        />
        {errors.display_name && (
          <p id={displayNameIds.error} role="alert" className={`${styles.fieldError} ${styles.error}`}>
            {t(DISPLAY_NAME_ERRORS[errors.display_name], { max: TEXT_LIMITS.displayName.max })}
          </p>
        )}
      </div>

      <fieldset
        className={styles.fieldset}
        aria-describedby={ids(languageIds.hint, errors.preferred_language && languageIds.error)}
      >
        <legend className={styles.label}>{t("onboarding.language.legend")}</legend>
        <p id={languageIds.hint} className={styles.hint}>
          {t("onboarding.language.hint", { appName: config.appName })}
        </p>
        {CONTENT_LANGUAGES.map((language, index) => (
          <label key={language} className={styles.choice}>
            <input
              ref={index === 0 ? refs?.language : undefined}
              type="radio"
              name="preferred_language"
              value={language}
              defaultChecked={language === chosen}
            />
            <span lang={language}>{endonymOf(language)}</span>
          </label>
        ))}
        {errors.preferred_language && (
          <p id={languageIds.error} role="alert" className={`${styles.fieldError} ${styles.error}`}>
            {t("onboarding.language.error.unsupported")}
          </p>
        )}
      </fieldset>

      <button type="submit" disabled={pending} className={authStyles.primaryButton}>
        {pending ? t("onboarding.submitting") : t("onboarding.submit")}
      </button>
    </form>
  );
}
