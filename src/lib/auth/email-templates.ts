// No imports on purpose: scripts/render-auth-emails.mjs loads this file with Node's type
// stripping, which can't resolve extensionless or `@/` imports.

/** The Supabase Auth email templates this app customises (keys of `[auth.email.template.*]`). */
export const AUTH_EMAIL_TEMPLATES = ["magic_link", "confirmation"] as const;
export type AuthEmailTemplate = (typeof AUTH_EMAIL_TEMPLATES)[number];

export type RenderedEmail = { subject: string; html: string };

/** The Go template variable Supabase Auth replaces with the sign-in link. */
export const CONFIRMATION_URL = "{{ .ConfirmationURL }}";

type Copy = { subject: string; heading: string; body: string; button: string; ignore: string };
type Language = "en" | "hi";

const IGNORE: Record<Language, string> = {
  en: "If you didn’t ask for this, you can ignore this email.",
  hi: "अगर आपने यह नहीं माँगा था, तो इस ईमेल को अनदेखा कर दें।",
};

// Supabase Auth doesn't know the reader's UI language when it sends, so every email carries both.
const COPY: Record<AuthEmailTemplate, Record<Language, Copy>> = {
  magic_link: {
    en: {
      subject: "Your {appName} sign-in link",
      heading: "Sign in to {appName}",
      body: "Open this link in the same browser where you asked for it. It works once and expires soon.",
      button: "Sign in",
      ignore: IGNORE.en,
    },
    hi: {
      subject: "आपका {appName} साइन-इन लिंक",
      heading: "{appName} में साइन इन करें",
      body: "यह लिंक उसी ब्राउज़र में खोलें जिसमें आपने इसे माँगा था। यह एक ही बार काम करता है और जल्द ही ख़त्म हो जाता है।",
      button: "साइन इन करें",
      ignore: IGNORE.hi,
    },
  },
  confirmation: {
    en: {
      subject: "Confirm your email for {appName}",
      heading: "Welcome to {appName}",
      body: "Confirm your email to finish signing in. Open this link in the same browser where you asked for it. It works once and expires soon.",
      button: "Confirm and sign in",
      ignore: IGNORE.en,
    },
    hi: {
      subject: "{appName} के लिए अपना ईमेल पक्का करें",
      heading: "{appName} में आपका स्वागत है",
      body: "साइन इन पूरा करने के लिए अपना ईमेल पक्का करें। यह लिंक उसी ब्राउज़र में खोलें जिसमें आपने इसे माँगा था। यह एक ही बार काम करता है और जल्द ही ख़त्म हो जाता है।",
      button: "पक्का करें और साइन इन करें",
      ignore: IGNORE.hi,
    },
  },
};

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fill(message: string, appName: string): string {
  return message.replaceAll("{appName}", appName);
}

function renderHtml(copy: Record<Language, Copy>, appName: string): string {
  const name = escapeHtml(appName);
  const section = (language: Language) => {
    const { heading, body } = copy[language];
    return [
      `  <div lang="${language}">`,
      `    <h1 style="font-size: 1.25rem;">${fill(heading, name)}</h1>`,
      `    <p>${body}</p>`,
      `  </div>`,
    ];
  };
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${name}</title>`,
    "</head>",
    `<body style="margin: 0; padding: 24px; font-family: Georgia, 'Noto Serif Devanagari', serif; line-height: 1.6;">`,
    ...section("en"),
    ...section("hi"),
    "  <p>",
    `    <a href="${CONFIRMATION_URL}" style="display: inline-block; padding: 12px 20px; border: 2px solid currentColor; border-radius: 8px; font-weight: bold; text-decoration: none;">` +
      `<span lang="en">${copy.en.button}</span> · <span lang="hi">${copy.hi.button}</span></a>`,
    "  </p>",
    `  <p lang="en">${copy.en.ignore}</p>`,
    `  <p lang="hi">${copy.hi.ignore}</p>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/**
 * The subject and HTML of each auth email, in English and Hindi, named after the configured app.
 * Supabase Auth can't read env, so these are rendered into supabase/ by `npm run auth:emails`.
 */
export function renderAuthEmails({ appName }: { appName: string }): Record<AuthEmailTemplate, RenderedEmail> {
  const render = (template: AuthEmailTemplate): RenderedEmail => {
    const copy = COPY[template];
    return {
      subject: `${fill(copy.en.subject, appName)} · ${fill(copy.hi.subject, appName)}`,
      html: renderHtml(copy, appName),
    };
  };
  return { magic_link: render("magic_link"), confirmation: render("confirmation") };
}
