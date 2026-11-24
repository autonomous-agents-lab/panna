import { expect, vi } from "vitest";

import type { CurrentWriter, WritingRepository } from "@/contracts";
import { options } from "@/contracts/page-body/__fixtures__/documents";
import { createInMemoryWritingRepository } from "@/lib/writing/in-memory-repository";
import { STAND_IN_WRITER } from "@/lib/writing/stand-in-writer";
import { withValidation } from "@/lib/writing/validating-repository";

/** What the /write routes' mocks of server config, i18n and the writing services read. */
export const routeState = {
  serverConfig: { writingDataSource: "stand-in" as const, standInWriting: true },
  locale: "en" as "en" | "hi",
  writer: STAND_IN_WRITER as CurrentWriter | null,
  repository: freshRepository(),
};

export function freshRepository(): WritingRepository {
  return withValidation(
    createInMemoryWritingRepository({ books: [{ id: STAND_IN_WRITER.bookId, userId: STAND_IN_WRITER.userId }] }),
    options,
  );
}

export function resetRouteState() {
  routeState.serverConfig.standInWriting = true;
  routeState.locale = "en";
  routeState.writer = STAND_IN_WRITER;
  routeState.repository = freshRepository();
}

export const getWritingServices = vi.fn(() => ({
  repository: routeState.repository,
  getCurrentWriter: async () => routeState.writer,
}));

/** The digests Next puts on the errors `notFound()` and `redirect()` throw. */
export const NOT_FOUND = { digest: expect.stringMatching(/;404$/) };
export const redirectedTo = (path: string) => ({
  digest: expect.stringMatching(new RegExp(`^NEXT_REDIRECT;\\w+;${path.replace(/[?]/g, "\\?")};`)),
});

export const mockServerConfig = async () => ({ serverConfig: routeState.serverConfig });

export const mockTranslator = async () => {
  const { translatorFor } = await import("@/i18n/catalogue");
  return { getTranslator: async () => ({ locale: routeState.locale, t: translatorFor(routeState.locale) }) };
};
