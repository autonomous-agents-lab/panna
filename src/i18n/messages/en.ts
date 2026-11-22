/**
 * The English catalogue, and the source of the message keys. Keys are flat and dotted by area.
 * Values may use `{name}` placeholders; the brand always comes in as `{appName}`.
 */
export const en = {
  "home.tagline": "A digital book for everyone. Write your thoughts in Hindi or English, page by page.",
  "localeSwitch.label": "Language",
  "localeSwitch.endonym": "English",
  "shell.homeLink": "{appName}, home",
} as const satisfies Record<string, string>;
