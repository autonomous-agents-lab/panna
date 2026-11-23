import { describe, expect, it } from "vitest";

import { AUTH_EMAIL_TEMPLATES, CONFIRMATION_URL, renderAuthEmails } from "./email-templates";

describe("renderAuthEmails (AC-7)", () => {
  const emails = renderAuthEmails({ appName: "Kitaab" });

  it("renders the magic-link and confirmation templates", () => {
    expect(Object.keys(emails)).toEqual([...AUTH_EMAIL_TEMPLATES]);
  });

  it.each(AUTH_EMAIL_TEMPLATES)("names the configured app in the %s subject, in English and Hindi", (template) => {
    const { subject } = emails[template];
    expect(subject.split(" · ")).toHaveLength(2);
    for (const part of subject.split(" · ")) expect(part).toContain("Kitaab");
    expect(subject).toMatch(/[ऀ-ॿ]/);
  });

  it.each(AUTH_EMAIL_TEMPLATES)("the %s body names the app and has one sign-in link", (template) => {
    const { html } = emails[template];
    expect(html).toContain("Kitaab");
    expect(html).not.toContain("{appName}");
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain(`href="${CONFIRMATION_URL}"`);
    expect(CONFIRMATION_URL).toBe("{{ .ConfirmationURL }}");
    expect(html).toContain('<div lang="en">');
    expect(html).toContain('<div lang="hi">');
  });

  it("escapes the app name in HTML but not in the subject", () => {
    const { magic_link } = renderAuthEmails({ appName: `Tom & "Jerry's" <Book>` });
    expect(magic_link.html).toContain("Tom &amp; &quot;Jerry&#39;s&quot; &lt;Book&gt;");
    expect(magic_link.html).not.toContain("<Book>");
    expect(magic_link.subject).toContain(`Tom & "Jerry's" <Book>`);
  });
});
