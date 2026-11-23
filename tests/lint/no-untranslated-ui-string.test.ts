import { join } from "node:path";
import { ESLint, RuleTester } from "eslint";
import { describe, expect, it } from "vitest";

import rule from "../../eslint-rules/no-untranslated-ui-string.mjs";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
});

const text = (snippet: string) => ({ code: snippet, errors: [{ messageId: "text" }] });
const attribute = (snippet: string) => ({ code: snippet, errors: [{ messageId: "attribute" }] });

ruleTester.run("no-untranslated-ui-string", rule, {
  valid: [
    '<p>{t("home.tagline")}</p>',
    "<h1>{config.appName}</h1>",
    "<p>   </p>",
    "<p>{' — '}</p>",
    "<p>— 42 · ( ) !</p>",
    "<p>{3}</p>",
    "<p>{`${name}`}</p>",
    '<p>{cond ? t("a") : t("b")}</p>',
    '<p>{"  "}</p>',
    '<img alt="" src="/a.png" />',
    '<img alt={""} src="/a.png" />',
    '<input placeholder="42" />',
    '<button aria-label={t("localeSwitch.label")} />',
    '<button aria-label={`${t("a")} ${n}`} />',
    "<button aria-label />",
    '<div aria-labelledby="heading-id" aria-describedby="hint" />',
    '<a className="nav link" href="/about" id="about" data-testid="about link" lang="en" role="group" />',
    '<a xlink:title="Home" />',
    "<a title=<b /> />",
    'const label = "Not JSX"; foo({ title: "Plain object" });',
    'foo(<Bar render={"inline string prop"} />)',
  ],
  invalid: [
    text("<p>Hello</p>"),
    text("<p>नमस्ते</p>"),
    text("<><b>{count}</b> items</>"),
    text('<p>{"Hello"}</p>'),
    text("<p>{`Hello`}</p>"),
    text('<>{"Hello"}</>'),
    { code: '<p>{done ? "Done" : "Pending"}</p>', errors: [{ messageId: "text" }, { messageId: "text" }] },
    text('<p>{name || "Anonymous"}</p>'),
    text('<p>{ok && "Saved"}</p>'),
    attribute('<img alt="Cover" src="/a.png" />'),
    attribute('<abbr title="Hypertext" />'),
    attribute('<input placeholder="Search" />'),
    attribute('<input placeholder={"Search"} />'),
    attribute("<input placeholder={`Search`} />"),
    attribute('<img alt={big ? "Large cover" : ""} />'),
    {
      code: "<p>\n  A long sentence that keeps on going well past the limit we show in lint output\n</p>",
      errors: [{ message: /^UI text "A long sentence that keeps on going well…" must come from the i18n layer/ }],
    },
    {
      code: '<button aria-label="Close" />',
      errors: [{ message: 'aria-label="Close" must come from the i18n layer: add it to both catalogues and use t("…").' }],
    },
  ],
});

// The first lint loads the whole project config (typescript-eslint, Next's plugins), which can take
// several seconds while the rest of the suite runs in parallel workers.
describe("the i18n lint rule in the project's ESLint config", { timeout: 30_000 }, () => {
  const repoRoot = join(import.meta.dirname, "..", "..");
  const eslint = new ESLint({ cwd: repoRoot });
  const probe = 'export function Probe() {\n  return (\n    <p title="Greeting">\n      Hello\n    </p>\n  );\n}\n';

  async function lint(filePath: string) {
    const [result] = await eslint.lintText(probe, { filePath: join(repoRoot, filePath) });
    return result?.messages.filter((message) => message.ruleId === "i18n/no-untranslated-ui-string") ?? [];
  }

  it.each(["src/components/Probe.tsx", "src/app/probe/page.tsx"])(
    "fails %s with the line of each untranslated string",
    async (filePath) => {
      const messages = await lint(filePath);
      expect(messages.map(({ line, column, severity }) => ({ line, column, severity }))).toEqual([
        { line: 3, column: 14, severity: 2 },
        { line: 4, column: 7, severity: 2 },
      ]);
    },
  );

  it.each(["src/lib/probe.tsx", "src/components/Probe.test.tsx", "tests/probe.tsx"])(
    "does not apply to %s",
    async (filePath) => {
      expect(await lint(filePath)).toEqual([]);
    },
  );

  it("passes on the real app and components", async () => {
    const results = await eslint.lintFiles(["src/app", "src/components"]);
    const problems = results.flatMap((result) =>
      result.messages
        .filter((message) => message.ruleId === "i18n/no-untranslated-ui-string")
        .map((message) => `${result.filePath}:${message.line} ${message.message}`),
    );
    expect(problems).toEqual([]);
  });
});
