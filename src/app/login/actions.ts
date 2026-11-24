"use server";

import { redirect } from "next/navigation";

import { config, hasSupabaseConfig } from "@/config";
import { magicLinkRequestSchema, NEXT_PARAM, type MagicLinkResult } from "@/contracts/auth";
import { buildAuthCallbackUrl } from "@/lib/auth/callback-url";
import { loginPath } from "@/lib/auth/login-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The magic-link form's action. An invalid email is reported without calling Supabase. A valid
 * one gets a link back to /auth/callback on the configured site, carrying the safe `next` path.
 */
export async function requestMagicLink(_previous: MagicLinkResult, formData: FormData): Promise<MagicLinkResult> {
  const raw = formData.get("email");
  const email = typeof raw === "string" ? raw.trim() : "";
  const parsed = magicLinkRequestSchema.safeParse({ email: raw });
  if (!parsed.success) return { status: "invalid", email };
  if (!hasSupabaseConfig()) return { status: "failed", email };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: buildAuthCallbackUrl(config.siteUrl, formData.get(NEXT_PARAM)) },
  });
  return error ? { status: "failed", email } : { status: "sent", email: parsed.data.email };
}

/**
 * The "Continue with Google" action. Runs on the server so the PKCE verifier cookie is set
 * there, then sends the browser to Supabase's Google flow.
 */
export async function signInWithGoogle(formData: FormData): Promise<never> {
  const next = formData.get(NEXT_PARAM);
  if (!hasSupabaseConfig()) redirect(loginPath({ error: "oauth_failed", next }));

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: buildAuthCallbackUrl(config.siteUrl, next) },
  });
  if (error || !data.url) redirect(loginPath({ error: "oauth_failed", next }));
  redirect(data.url);
}
