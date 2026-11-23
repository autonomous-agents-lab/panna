import { z } from "zod";

/** The signed-in writer and their one book. */
export const currentWriterSchema = z.strictObject({
  userId: z.uuid(),
  bookId: z.uuid(),
});

export type CurrentWriter = z.infer<typeof currentWriterSchema>;

/**
 * Who is writing, resolved on the server for the current request; null when signed out. The
 * writing epic uses a stand-in until the auth epic (BOOK-17) implements this unchanged.
 */
export type GetCurrentWriter = () => Promise<CurrentWriter | null>;
