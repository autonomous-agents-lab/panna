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
  "username.error.too_short": "Usernames need at least {min} characters.",
  "username.error.too_long": "Usernames can have at most {max} characters.",
  "username.error.invalid_characters": "Use only English letters a to z, digits and underscores (_).",
  "username.error.must_start_with_letter": "Usernames must start with a letter.",
  "username.error.reserved": "That username is reserved. Please choose another.",
  "username.error.held": "That username was used recently and isn’t available yet.",
  "username.error.taken": "That username is already taken.",
} as const satisfies Record<string, string>;
