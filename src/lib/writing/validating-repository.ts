import type { z } from "zod";

import {
  writingInputSchemas,
  type PageBodyOptions,
  type WritingRepository,
  type WritingResult,
} from "@/contracts";

async function validated<Input, T>(
  schema: z.ZodType<Input>,
  input: unknown,
  call: (parsed: Input) => Promise<WritingResult<T>>,
): Promise<WritingResult<T>> {
  const parsed = schema.safeParse(input);
  return parsed.success ? call(parsed.data) : { ok: false, error: "invalid_input", issues: parsed.error.issues };
}

/**
 * Wraps a repository so every input is checked against the contract's schemas first. Invalid
 * input comes back as invalid_input with the zod issues and never reaches `repository`; valid
 * input reaches it parsed, so bodies are always sanitised. Server code takes input from clients
 * through this, never straight to a repository.
 */
export function withValidation(repository: WritingRepository, options: PageBodyOptions): WritingRepository {
  const schemas = writingInputSchemas(options);
  return {
    listChapters: (writer) => repository.listChapters(writer),
    createChapter: (writer, input) =>
      validated(schemas.createChapter, input, (parsed) => repository.createChapter(writer, parsed)),
    renameChapter: (writer, input) =>
      validated(schemas.renameChapter, input, (parsed) => repository.renameChapter(writer, parsed)),
    reorderChapters: (writer, input) =>
      validated(schemas.reorderChapters, input, (parsed) => repository.reorderChapters(writer, parsed)),
    createPage: (writer, input) =>
      validated(schemas.createPage, input, (parsed) => repository.createPage(writer, parsed)),
    renamePage: (writer, input) =>
      validated(schemas.renamePage, input, (parsed) => repository.renamePage(writer, parsed)),
    reorderPages: (writer, input) =>
      validated(schemas.reorderPages, input, (parsed) => repository.reorderPages(writer, parsed)),
    getPageForEdit: (writer, input) =>
      validated(schemas.getPageForEdit, input, (parsed) => repository.getPageForEdit(writer, parsed)),
    savePageContent: (writer, input) =>
      validated(schemas.savePageContent, input, (parsed) => repository.savePageContent(writer, parsed)),
    setPageLanguage: (writer, input) =>
      validated(schemas.setPageLanguage, input, (parsed) => repository.setPageLanguage(writer, parsed)),
    publishPage: (writer, input) =>
      validated(schemas.publishPage, input, (parsed) => repository.publishPage(writer, parsed)),
    unpublishPage: (writer, input) =>
      validated(schemas.unpublishPage, input, (parsed) => repository.unpublishPage(writer, parsed)),
    archivePage: (writer, input) =>
      validated(schemas.archivePage, input, (parsed) => repository.archivePage(writer, parsed)),
    restorePage: (writer, input) =>
      validated(schemas.restorePage, input, (parsed) => repository.restorePage(writer, parsed)),
  };
}
