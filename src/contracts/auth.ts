import { z } from "zod";

/** The app's auth routes. Profile and onboarding stories link to these rather than writing paths. */
export const AUTH_ROUTES = {
  login: "/login",
  callback: "/auth/callback",
} as const;

/** Query parameter carrying the path to return to after sign-in, e.g. `/login?next=%2Fsettings`. */
export const NEXT_PARAM = "next";

/** Query parameter carrying a login error code back to /login, e.g. `/login?error=link_invalid`. */
export const ERROR_PARAM = "error";

/** Why /login was reached with an error: a bad or expired link, a failed send, a failed Google redirect. */
export const LOGIN_ERROR_CODES = ["link_invalid", "send_failed", "oauth_failed"] as const;
export const loginErrorCodeSchema = z.enum(LOGIN_ERROR_CODES);
export type LoginErrorCode = z.infer<typeof loginErrorCodeSchema>;

/** The magic-link form's input. RFC 5321 caps an address at 254 characters. */
export const magicLinkRequestSchema = z.object({
  email: z.string().trim().pipe(z.email().max(254)),
});
export type MagicLinkRequest = z.infer<typeof magicLinkRequestSchema>;

/**
 * The magic-link Server Action's result. It carries codes, not text, so the form shows the message
 * in whichever language is current; `email` refills the field after React resets the form.
 */
export type MagicLinkResult =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "invalid"; email: string }
  | { status: "failed"; email: string };
