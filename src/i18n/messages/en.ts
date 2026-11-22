/**
 * The English catalogue, and the source of the message keys. Keys are flat and dotted by area.
 * Values may use `{name}` placeholders; the brand always comes in as `{appName}`.
 */
export const en = {
  "home.comingSoon": "Coming soon",
  "home.tagline": "A digital book for everyone. Write your thoughts in Hindi or English, page by page.",
  "localeSwitch.label": "Language",
  "localeSwitch.endonym": "English",
  "shell.homeLink": "{appName}, home",
  "shell.skipToContent": "Skip to content",
  "shell.description":
    "A digital book for everyone. Write in Hindi or English, page by page, and let readers turn your pages like a real notebook.",
  "shell.footer": "{appName}: a digital book for everyone",
  "notFound.title": "Page not found",
  "notFound.body": "We couldn’t find the page you were looking for. It may have moved, or the link may be wrong.",
  "notFound.home": "Go to the home page",
  "error.title": "Something went wrong",
  "error.body": "This page couldn’t be shown. Please try again, or go back to the home page.",
  "error.retry": "Try again",
  "error.home": "Go to the home page",
  "auth.login.title": "Sign in",
  "auth.login.intro": "Get a sign-in link by email, or continue with your Google account.",
  "auth.login.emailLabel": "Email address",
  "auth.login.submit": "Email me a sign-in link",
  "auth.login.sending": "Sending…",
  "auth.login.or": "or",
  "auth.login.google": "Continue with Google",
  "auth.login.sent": "Check your email. We sent a sign-in link to {email}. Open it in this browser to finish signing in.",
  "auth.login.unavailable": "Sign-in isn’t available right now. Please try again later.",
  "auth.error.emailInvalid": "Enter a valid email address, like name@example.com.",
  "auth.error.sendFailed": "We couldn’t send the sign-in link. Please try again in a moment.",
  "auth.error.linkInvalid":
    "That sign-in link didn’t work. It may have expired or been used already, or it was opened in a different browser. Enter your email to get a new link.",
  "auth.error.oauthFailed": "Signing in with Google didn’t work. Please try again, or get a sign-in link by email.",
  "auth.nav.signIn": "Sign in",
  "auth.nav.signOut": "Sign out",
  "auth.signedInAs": "Signed in as {email}",
  "settings.title": "Settings",
  "onboarding.title": "Welcome",
} as const satisfies Record<string, string>;
