// Renders the Supabase Auth email templates from NEXT_PUBLIC_APP_NAME (`npm run auth:emails`).
// Supabase Auth can't read the app's env, so the HTML files and the subjects in config.toml are
// generated here and committed; tests/repo/auth-email-templates.test.ts fails if they drift.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import nextEnv from "@next/env";

import { DEFAULT_APP_NAME } from "../src/config/defaults.ts";
import { AUTH_EMAIL_TEMPLATES, renderAuthEmails } from "../src/lib/auth/email-templates.ts";

const REPO_ROOT = join(import.meta.dirname, "..");
export const CONFIG_TOML = "supabase/config.toml";

/** The committed template file for `template`, relative to the repo root. */
export function templatePath(template) {
  return `supabase/templates/${template}.html`;
}

/** The app name as src/config resolves it: the default when unset, trimmed, never blank. */
export function resolveAppName(env) {
  const value = env.NEXT_PUBLIC_APP_NAME;
  if (value === undefined) return DEFAULT_APP_NAME;
  const name = value.trim();
  if (name === "") throw new Error("NEXT_PUBLIC_APP_NAME must not be blank.");
  return name;
}

/** Rewrites the `subject` line of each `[auth.email.template.<name>]` section in config.toml. */
export function updateConfigSubjects(toml, emails) {
  let updated = toml;
  for (const template of AUTH_EMAIL_TEMPLATES) {
    const subjectLine = new RegExp(`(^\\[auth\\.email\\.template\\.${template}\\]\\r?\\nsubject = ).*$`, "m");
    if (!subjectLine.test(updated)) {
      throw new Error(`${CONFIG_TOML} has no [auth.email.template.${template}] section starting with a subject line.`);
    }
    // JSON string escapes are valid in a TOML basic string.
    updated = updated.replace(subjectLine, (_line, prefix) => `${prefix}${JSON.stringify(emails[template].subject)}`);
  }
  return updated;
}

/** Writes the templates and subjects for the configured name and returns the process exit code. */
export function main({
  env = process.env,
  read = (path) => readFileSync(join(REPO_ROOT, path), "utf8"),
  write = (path, content) => {
    mkdirSync(dirname(join(REPO_ROOT, path)), { recursive: true });
    writeFileSync(join(REPO_ROOT, path), content);
  },
  log = console,
} = {}) {
  try {
    const appName = resolveAppName(env);
    const emails = renderAuthEmails({ appName });
    for (const template of AUTH_EMAIL_TEMPLATES) write(templatePath(template), emails[template].html);
    write(CONFIG_TOML, updateConfigSubjects(read(CONFIG_TOML), emails));
    log.log(`Rendered the auth emails for ${JSON.stringify(appName)}. Commit supabase/ and restart Supabase.`);
    return 0;
  } catch (error) {
    log.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Reads .env.local and friends the way Next does, so the name matches the app's.
  nextEnv.loadEnvConfig(REPO_ROOT);
  process.exitCode = main();
}
