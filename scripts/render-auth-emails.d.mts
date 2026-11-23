import type { AuthEmailTemplate, RenderedEmail } from "../src/lib/auth/email-templates";

export const CONFIG_TOML: string;

export function templatePath(template: AuthEmailTemplate): string;

export function resolveAppName(env: Record<string, string | undefined>): string;

export function updateConfigSubjects(toml: string, emails: Record<AuthEmailTemplate, RenderedEmail>): string;

export function main(options?: {
  env?: Record<string, string | undefined>;
  read?: (path: string) => string;
  write?: (path: string, content: string) => void;
  log?: Pick<Console, "log" | "error">;
}): number;
