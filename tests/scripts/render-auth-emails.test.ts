import { describe, expect, it, vi } from "vitest";

import { DEFAULT_APP_NAME } from "@/config/defaults";
import { renderAuthEmails } from "@/lib/auth/email-templates";

import {
  CONFIG_TOML,
  main,
  resolveAppName,
  templatePath,
  updateConfigSubjects,
} from "../../scripts/render-auth-emails.mjs";

const TOML = [
  "[auth.email]",
  "enabled = true",
  "",
  "[auth.email.template.magic_link]",
  'subject = "old"',
  'content_path = "./supabase/templates/magic_link.html"',
  "",
  "[auth.email.template.confirmation]",
  'subject = ""',
  'content_path = "./supabase/templates/confirmation.html"',
  "",
].join("\n");

describe("resolveAppName (AC-7)", () => {
  it("resolves the name as src/config does", () => {
    expect(resolveAppName({})).toBe(DEFAULT_APP_NAME);
    expect(resolveAppName({ NEXT_PUBLIC_APP_NAME: "  Kitaab " })).toBe("Kitaab");
    expect(() => resolveAppName({ NEXT_PUBLIC_APP_NAME: " " })).toThrow("NEXT_PUBLIC_APP_NAME must not be blank.");
  });

  it("refuses a name containing Go template delimiters, which Supabase would parse", () => {
    for (const name of ["{{ .Email }}", "Kitaab {{", "Kitaab }}"]) {
      expect(() => resolveAppName({ NEXT_PUBLIC_APP_NAME: name }), name).toThrow("must not contain {{ or }}");
    }
  });
});

describe("updateConfigSubjects (AC-7)", () => {
  it("rewrites only the subject line of each template section", () => {
    const emails = renderAuthEmails({ appName: 'Say "Kitaab"' });
    const updated = updateConfigSubjects(TOML, emails);
    expect(updated).toBe(
      TOML.replace('subject = "old"', `subject = ${JSON.stringify(emails.magic_link.subject)}`).replace(
        'subject = ""',
        `subject = ${JSON.stringify(emails.confirmation.subject)}`,
      ),
    );
    expect(updated).toContain('Say \\"Kitaab\\"');
    expect(updateConfigSubjects(updated, emails)).toBe(updated);
  });

  it("fails when a section is missing or doesn't start with its subject", () => {
    const emails = renderAuthEmails({ appName: "Kitaab" });
    expect(() => updateConfigSubjects(TOML.replace("[auth.email.template.confirmation]\n", ""), emails)).toThrow(
      "supabase/config.toml has no [auth.email.template.confirmation] section starting with a subject line.",
    );
  });
});

describe("main", () => {
  it("writes both templates and the updated config for the configured name", () => {
    const files = new Map([[CONFIG_TOML, TOML]]);
    const log = { log: vi.fn(), error: vi.fn() };

    const code = main({
      env: { NEXT_PUBLIC_APP_NAME: "Kitaab" },
      read: (path) => files.get(path) ?? "",
      write: (path, content) => void files.set(path, content),
      log,
    });

    const emails = renderAuthEmails({ appName: "Kitaab" });
    expect(code).toBe(0);
    expect(files.get(templatePath("magic_link"))).toBe(emails.magic_link.html);
    expect(files.get(templatePath("confirmation"))).toBe(emails.confirmation.html);
    expect(files.get(CONFIG_TOML)).toBe(updateConfigSubjects(TOML, emails));
    expect(log.log).toHaveBeenCalledWith(expect.stringContaining('"Kitaab"'));
  });

  it("reads the repo's own config.toml by default, which has both template sections", () => {
    const write = vi.fn();
    const log = { log: vi.fn(), error: vi.fn() };

    expect(main({ env: {}, write, log })).toBe(0);

    expect(write).toHaveBeenCalledWith(CONFIG_TOML, expect.stringContaining("[auth.email.template.magic_link]"));
    expect(log.error).not.toHaveBeenCalled();
  });

  it("reports a bad name and exits 1 without writing", () => {
    const write = vi.fn();
    const log = { log: vi.fn(), error: vi.fn() };

    expect(main({ env: { NEXT_PUBLIC_APP_NAME: "" }, read: () => TOML, write, log })).toBe(1);

    expect(write).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith("NEXT_PUBLIC_APP_NAME must not be blank.");
  });

  it("reports a non-Error failure as text", () => {
    const log = { log: vi.fn(), error: vi.fn() };
    const read = () => {
      throw "disk on fire";
    };

    expect(main({ env: {}, read, write: vi.fn(), log })).toBe(1);
    expect(log.error).toHaveBeenCalledWith("disk on fire");
  });
});
