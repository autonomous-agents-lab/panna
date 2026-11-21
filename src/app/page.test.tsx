import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("renders the shell without any Supabase variables set", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
  vi.resetModules();

  const { default: RootLayout } = await import("./layout");
  const { default: HomePage } = await import("./page");
  const { config } = await import("@/config");

  const html = renderToString(
    <RootLayout>
      <HomePage />
    </RootLayout>,
  );

  expect(html).toContain(`<h1>${config.appName}</h1>`);
});
