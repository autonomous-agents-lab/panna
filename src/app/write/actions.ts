"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getTranslator } from "@/i18n/server";
import { getWritingServices } from "@/lib/writing";
import type { ActionState } from "@/lib/writing/dashboard/action-state";
import { createDashboardActions } from "@/lib/writing/dashboard/actions";

import { assertWritingEnabled } from "./guard";

// The dashboard's Server Actions: createDashboardActions bound to this request.

async function dashboard() {
  assertWritingEnabled();
  const { locale, t } = await getTranslator();
  return createDashboardActions({
    services: getWritingServices(),
    revalidate: (path) => revalidatePath(path),
    redirect,
    t,
    language: locale,
  });
}

export async function startWriting(state: ActionState, formData: FormData): Promise<ActionState> {
  return (await dashboard()).startWriting(state, formData);
}

export async function createChapter(state: ActionState, formData: FormData): Promise<ActionState> {
  return (await dashboard()).createChapter(state, formData);
}

export async function createPage(state: ActionState, formData: FormData): Promise<ActionState> {
  return (await dashboard()).createPage(state, formData);
}

export async function renameChapter(state: ActionState, formData: FormData): Promise<ActionState> {
  return (await dashboard()).renameChapter(state, formData);
}

export async function renamePage(state: ActionState, formData: FormData): Promise<ActionState> {
  return (await dashboard()).renamePage(state, formData);
}

export async function moveChapter(state: ActionState, formData: FormData): Promise<ActionState> {
  return (await dashboard()).moveChapter(state, formData);
}

export async function movePage(state: ActionState, formData: FormData): Promise<ActionState> {
  return (await dashboard()).movePage(state, formData);
}
