"use client";

import { useActionState, useId } from "react";

import { requestMagicLink, signInWithGoogle } from "@/app/login/actions";
import { NEXT_PARAM, type LoginErrorCode, type MagicLinkResult } from "@/contracts/auth";
import type { MessageKey } from "@/i18n";
import { useTranslator } from "@/i18n/client";

import styles from "./LoginForm.module.css";
import authStyles from "./auth.module.css";

const IDLE: MagicLinkResult = { status: "idle" };

const LOGIN_ERROR_MESSAGES: Record<LoginErrorCode, MessageKey> = {
  link_invalid: "auth.error.linkInvalid",
  send_failed: "auth.error.sendFailed",
  oauth_failed: "auth.error.oauthFailed",
};

type LoginFormProps = {
  /** The safe path to return to after sign-in. */
  next: string;
  /** Why the user was sent back to /login, e.g. an expired link. */
  loginError?: LoginErrorCode;
};

/** The magic-link and Google sign-in forms, wired to their Server Actions. */
export function LoginForm(props: LoginFormProps) {
  const [result, magicLinkAction, pending] = useActionState(requestMagicLink, IDLE);
  return <LoginFormFields {...props} result={result} pending={pending} magicLinkAction={magicLinkAction} />;
}

type LoginFormFieldsProps = LoginFormProps & {
  result: MagicLinkResult;
  pending: boolean;
  magicLinkAction: (formData: FormData) => void;
};

/**
 * What the sign-in forms show for a given state. Native forms with `noValidate`, so they work
 * without JavaScript and the email error comes in the page's language, not the browser's.
 */
export function LoginFormFields({ next, loginError, result, pending, magicLinkAction }: LoginFormFieldsProps) {
  const t = useTranslator();
  const id = useId();
  const emailId = `${id}-email`;
  const emailErrorId = `${id}-email-error`;
  const formErrorId = `${id}-form-error`;
  const invalid = result.status === "invalid";
  // A form-level error: from the last submit, else the one /login was opened with.
  const formError = result.status === "failed" ? "send_failed" : result.status === "idle" ? loginError : undefined;
  const describedBy = [invalid && emailErrorId, formError && formErrorId].filter(Boolean).join(" ");

  return (
    <div>
      <div role="alert">
        {formError && (
          <p id={formErrorId} className={`${styles.message} ${styles.error}`}>
            {t(LOGIN_ERROR_MESSAGES[formError])}
          </p>
        )}
      </div>
      <div role="status">
        {result.status === "sent" && (
          <p className={styles.message}>{t("auth.login.sent", { email: result.email })}</p>
        )}
      </div>

      <form action={magicLinkAction} noValidate className={styles.form}>
        <input type="hidden" name={NEXT_PARAM} value={next} />
        <label htmlFor={emailId} className={styles.label}>
          {t("auth.login.emailLabel")}
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          required
          defaultValue={result.status === "idle" ? "" : result.email}
          aria-invalid={invalid}
          aria-describedby={describedBy || undefined}
          // Back from a failed link, the next step is typing the email again.
          autoFocus={loginError !== undefined && result.status === "idle"}
          className={styles.input}
        />
        {invalid && (
          <p id={emailErrorId} role="alert" className={`${styles.fieldError} ${styles.error}`}>
            {t("auth.error.emailInvalid")}
          </p>
        )}
        <button type="submit" disabled={pending} className={authStyles.primaryButton}>
          {pending ? t("auth.login.sending") : t("auth.login.submit")}
        </button>
      </form>

      <p className={styles.or}>{t("auth.login.or")}</p>

      <form action={signInWithGoogle} className={styles.form}>
        <input type="hidden" name={NEXT_PARAM} value={next} />
        <button type="submit" className={authStyles.secondaryButton}>
          {t("auth.login.google")}
        </button>
      </form>
    </div>
  );
}
