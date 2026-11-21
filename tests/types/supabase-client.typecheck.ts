// Compiled by `tsc` in `npm test`, never run. If the clients lost their `Database` types (became
// `any`), the @ts-expect-error lines would be unused and typecheck would fail.
import type { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Tables } from "@/lib/supabase/database.types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type AppMetaEntry = Pick<Tables<"app_meta">, "key" | "value">;

export async function serverQueriesAreTyped(supabase: ServerClient) {
  const { data } = await supabase.from("app_meta").select("key, value");
  const rows: AppMetaEntry[] | null = data;

  // @ts-expect-error unknown tables are a type error
  supabase.from("not_a_table");

  return rows;
}

export async function browserQueriesAreTyped(supabase: BrowserClient) {
  const { data } = await supabase.from("app_meta").select("key, value");
  const rows: AppMetaEntry[] | null = data;

  // @ts-expect-error unknown tables are a type error
  supabase.from("not_a_table");

  return rows;
}
