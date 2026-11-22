import { z } from "zod";

import { CONTENT_LANGUAGES } from "@/config/books";

/** The language a profile or book is written in (not the UI locale). */
export const languageSchema = z.enum(CONTENT_LANGUAGES);

export type Language = z.infer<typeof languageSchema>;
