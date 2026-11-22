import { z } from "zod";

import { COVER_STYLES, FONT_IDS } from "@/config/books";

export const coverStyleSchema = z.enum(COVER_STYLES);
export type CoverStyle = z.infer<typeof coverStyleSchema>;

export const fontIdSchema = z.enum(FONT_IDS);
export type FontId = z.infer<typeof fontIdSchema>;
