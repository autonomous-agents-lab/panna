import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";

import { config } from "@/config";
import { AUTH_EMAIL_TEMPLATES, renderAuthEmails } from "@/lib/auth/email-templates";

import { templatePath } from "../../scripts/render-auth-emails.mjs";

const repoRoot = join(import.meta.dirname, "..", "..");
const read = (file: string) => readFileSync(join(repoRoot, file), "utf8");

type Provider = { enabled: boolean; client_id: string; secret: string; skip_nonce_check: boolean };
type SupabaseConfig = {
  auth: {
    site_url: string;
    additional_redirect_urls: string[];
    email: { template: Record<string, { subject: string; content_path: string }> };
    external: Record<string, Provider>;
  };
};

const supabase = parse(read("supabase/config.toml")) as unknown as SupabaseConfig;

describe("Supabase auth email templates (AC-7)", () => {
  const emails = renderAuthEmails({ appName: config.appName });

  it.each(AUTH_EMAIL_TEMPLATES)(
    "the committed %s template and subject are rendered from the configured app name (run `npm run auth:emails`)",
    (template) => {
      const entry = supabase.auth.email.template[template];
      expect(entry?.content_path).toBe(`./${templatePath(template)}`);
      expect(read(templatePath(template))).toBe(emails[template].html);
      expect(entry?.subject).toBe(emails[template].subject);
      expect(entry?.subject).toContain(config.appName);
    },
  );

  it("the generator is an npm script", () => {
    const { scripts } = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(scripts["auth:emails"]).toBe("node scripts/render-auth-emails.mjs");
  });
});

describe("local Supabase Auth config (AC-2, AC-3)", () => {
  it("lets auth redirect back to the callback of the dev and e2e servers, on localhost", () => {
    expect(supabase.auth.site_url).toBe("http://localhost:3000");
    expect(supabase.auth.additional_redirect_urls).toEqual([
      "http://localhost:3000/auth/callback**",
      "http://localhost:3100/auth/callback**",
    ]);
  });

  it("turns on Google with credentials from the environment, never committed", () => {
    expect(supabase.auth.external.google).toMatchObject({
      enabled: true,
      client_id: "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)",
      secret: "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)",
      skip_nonce_check: true,
    });
  });
});
