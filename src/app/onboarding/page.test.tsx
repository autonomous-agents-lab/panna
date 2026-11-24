import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogues } from "@/i18n/catalogue";
import { I18nProvider } from "@/i18n/client";
import { createTranslator } from "@/i18n/translate";

class Redirect extends Error {
  constructor(readonly location: string) {
    super(`NEXT_REDIRECT ${location}`);
  }
}

const locale = vi.hoisted(() => ({ current: "en" as "en" | "hi" }));
const requireUser = vi.hoisted(() => vi.fn());
const getCurrentProfile = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: (location: string) => {
    throw new Redirect(location);
  },
}));
vi.mock("@/app/onboarding/actions", () => ({ createProfile: async () => ({ status: "idle" }), checkUsername: async () => ({ status: "unknown" }) }));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/profile/current-profile", () => ({ getCurrentProfile }));
vi.mock("@/i18n/server", () => ({
  getTranslator: async () => ({ locale: locale.current, t: createTranslator(catalogues[locale.current]) }),
}));

const { default: OnboardingPage, generateMetadata } = await import("./page");

async function render(): Promise<string> {
  const page = await OnboardingPage();
  return renderToStaticMarkup(
    <I18nProvider locale={locale.current} messages={catalogues[locale.current]}>
      {page}
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "u1", email: "writer@example.org" });
  getCurrentProfile.mockResolvedValue(null);
});

describe("the onboarding page (AC-1)", () => {
  it.each(["en", "hi"] as const)("in %s, shows the form to a signed-in user without a profile", async (current) => {
    locale.current = current;
    const t = catalogues[current];
    const html = await render();
    expect(requireUser).toHaveBeenCalledWith("/onboarding");
    expect(html).toContain(`<h1>${t["onboarding.title"]}</h1>`);
    expect(html).toContain(`<p>${t["onboarding.intro"]}</p>`);
    expect(html).toContain(`>${t["onboarding.submit"]}</button>`);
  });

  it.each(["en", "hi"] as const)("preselects the current UI language (%s) as the preferred language", async (current) => {
    locale.current = current;
    const html = await render();
    expect(html).toMatch(new RegExp(`<input[^>]*checked=""[^>]*value="${current}"/>`));
    expect(html.match(/checked=""/g)).toHaveLength(1);
  });

  it("sends a user who already has a profile to their book", async () => {
    getCurrentProfile.mockResolvedValue({ id: "u1", username: "asha" });
    await expect(OnboardingPage()).rejects.toMatchObject({ location: "/asha" });
  });

  it("is noindex at its own canonical path", async () => {
    const metadata = await generateMetadata();
    expect(metadata.alternates).toEqual({ canonical: "/onboarding" });
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
