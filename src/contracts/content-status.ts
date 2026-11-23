import { z } from "zod";

import { CONTENT_STATUSES } from "@/config/content";

/** A chapter's or page's status. Only published ones (and not archived) are visible to others. */
export const contentStatusSchema = z.enum(CONTENT_STATUSES);

export type ContentStatus = z.infer<typeof contentStatusSchema>;

/** A position in a chapter or page list: a Postgres `integer` that is at least 0. */
export const positionSchema = z.int32().min(0);
