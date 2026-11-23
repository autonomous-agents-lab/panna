"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasSupabaseConfig } from "@/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Signs out of this browser only: Supabase revokes this session and clears its cookies, which the
 * browser client reads too; the user's other devices stay signed in. Every cached page is dropped
 * so nothing still shows the user, then home.
 */
export async function signOut(): Promise<never> {
  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  revalidatePath("/", "layout");
  redirect("/");
}
