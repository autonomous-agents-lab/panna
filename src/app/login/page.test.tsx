import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogues } from "@/i18n/catalogue";
import { createTranslator } from "@/i18n/translate";

const locale = vi.hoisted(() => ({ current: "en" as "en" | "hi" }));
const getCurrentUser = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
);

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser }));
vi.mock("@/components/auth/LoginForm", () => ({ LoginForm: () => null }));
vi.mock("@/i18n/server", () => ({
  getTranslator: async () => ({ locale: locale.current, t: createTranslator(catalogues[locale.current]) }),
}));

const { default: LoginPage, generateMetadata } = await import("./page");
const { LoginForm } = await import("@/components/auth/LoginForm");

type Element = ReactElement<{ children?: unknown; [key: string]: unknown }>;

/** Every element in the tree, without rendering function components. */
function elements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children)];
}

async function page(params: Record<string, string | string[]> = {}) {
  return LoginPage({ searchParams: Promise.resolve(params) });
}

function formProps(tree: unknown) {
  return elements(tree).find((element) => element.type === LoginForm)?.props;
}

beforeEach(() => {
  locale.current = "en";
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  getCurrentUser.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("LoginPage", () => {
  it.each(["en", "hi"] as const)("in %s, has a translated heading and intro and the sign-in forms (AC-1)", async (current) => {
    locale.current = current;
    const html = renderToStaticMarkup(await page());
    expect(html).toContain(`>${catalogues[current]["auth.login.title"]}</h1>`);
    expect(html).toContain(`>${catalogues[current]["auth.login.intro"]}</p>`);
  });

  it("hands the form a safe next and no error by default", async () => {
    expect(formProps(await page({ next: "/settings?tab=1" }))).toEqual({ next: "/settings?tab=1", loginError: undefined });
    expect(formProps(await page({ next: "//evil.com" }))).toEqual({ next: "/", loginError: undefined });
    expect(formProps(await page({ next: ["/settings", "/onboarding"] }))).toMatchObject({ next: "/" });
  });

  it.each(["link_invalid", "send_failed", "oauth_failed"])("passes the known error %s on to the form (AC-8)", async (error) => {
    expect(formProps(await page({ error, next: "/onboarding" }))).toEqual({ next: "/onboarding", loginError: error });
  });

  it("ignores an unknown error code", async () => {
    expect(formProps(await page({ error: "<script>" }))?.loginError).toBeUndefined();
  });

  it("sends a signed-in visitor on to the safe next, never back to /login", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1" });
    await expect(page({ next: "/settings" })).rejects.toThrow("NEXT_REDIRECT /settings");
    await expect(page({ next: "/login" })).rejects.toThrow("NEXT_REDIRECT /");
    expect(redirect).toHaveBeenLastCalledWith("/");
  });

  it.each(["en", "hi"] as const)("in %s, says sign-in is unavailable when Supabase isn't configured", async (current) => {
    locale.current = current;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    const tree = await page();
    expect(formProps(tree)).toBeUndefined();
    expect(renderToStaticMarkup(tree)).toContain(`<p role="status">${catalogues[current]["auth.login.unavailable"]}</p>`);
  });
});

describe("LoginPage metadata (AC-9)", () => {
  it.each(["en", "hi"] as const)("in %s, has a translated title, its canonical path and noindex", async (current) => {
    locale.current = current;
    const metadata = await generateMetadata();
    expect(metadata.title).toEqual({ absolute: expect.stringMatching(new RegExp(`^${catalogues[current]["auth.login.title"]} · `)) });
    expect(metadata.alternates).toEqual({ canonical: "/login" });
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.openGraph).toMatchObject({ locale: current === "en" ? "en_IN" : "hi_IN" });
  });
});
