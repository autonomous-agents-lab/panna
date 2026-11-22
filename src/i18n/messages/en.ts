/**
 * The English catalogue, and the source of the message keys. Keys are flat and dotted by area.
 * Values may use `{name}` placeholders; the brand always comes in as `{appName}`.
 */
export const en = {
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
} as const satisfies Record<string, string>;
