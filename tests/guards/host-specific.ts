import type { SourceFile } from "./find-literal";

export type HostHit = { path: string; line: number; match: string };

/** Packages tied to one host. App code must run on any Node host. */
const HOST_IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["'`]((?:@netlify|@vercel|@opennextjs)\/[^"'`]*|netlify(?:\/[^"'`]*)?)["'`]/g;

/** Env names only a host sets. Distinctive enough to ban anywhere they appear. */
const HOST_ENV_NAME =
  /(?<![A-Za-z0-9_])(?:[A-Z0-9_]*(?:NETLIFY|VERCEL)[A-Z0-9_]*|COMMIT_REF|DEPLOY_URL|DEPLOY_PRIME_URL|DEPLOY_ID|SITE_ID|SITE_NAME|GITHUB_SHA)(?![A-Za-z0-9_])/g;

/** Host env names too generic to ban as words, so only reading them from process.env counts. */
const GENERIC_HOST_ENV = "URL|CONTEXT|BRANCH|HEAD|REVIEW_ID";
const GENERIC_HOST_ENV_ACCESS = new RegExp(
  `process\\.env(?:\\.(?:${GENERIC_HOST_ENV})(?![A-Za-z0-9_])|\\[\\s*["'\`](?:${GENERIC_HOST_ENV})["'\`]\\s*\\])`,
  "g",
);

/** Every host-specific import or env variable in `files`, one hit per match. */
export function findHostSpecificCode(files: SourceFile[]): HostHit[] {
  return files.flatMap((file) =>
    file.content.split(/\r?\n/).flatMap((text, index) =>
      [HOST_IMPORT, HOST_ENV_NAME, GENERIC_HOST_ENV_ACCESS].flatMap((pattern) =>
        [...text.matchAll(pattern)].map((match) => ({ path: file.path, line: index + 1, match: match[0] })),
      ),
    ),
  );
}
