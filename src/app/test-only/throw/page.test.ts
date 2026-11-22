import { describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ testRoutes: false }));

vi.mock("@/config/server", () => ({ serverConfig: flags }));
vi.mock("@/i18n/server", async () => {
  const { translatorFor } = await import("@/i18n/catalogue");
  return { getTranslator: async () => ({ locale: "en", t: translatorFor("en") }) };
});

const { default: ThrowPage, generateMetadata } = await import("./page");

/** The digest Next puts on the error `notFound()` throws. */
const NOT_FOUND = expect.objectContaining({ digest: expect.stringMatching(/;404$/) });

describe("the test-only throwing route", () => {
  it("is a 404 when ENABLE_TEST_ROUTES is off", () => {
    flags.testRoutes = false;
    expect(() => ThrowPage()).toThrow(NOT_FOUND);
    expect(() => generateMetadata()).toThrow(NOT_FOUND);
  });

  it("throws during render, and is noindex, when ENABLE_TEST_ROUTES is on", async () => {
    flags.testRoutes = true;
    expect(() => ThrowPage()).toThrow("internal secret detail");
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: true });
  });
});
