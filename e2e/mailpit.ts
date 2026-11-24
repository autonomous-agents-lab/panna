import { expect } from "@playwright/test";

/** Local Supabase's mail inbox (Mailpit). Override with E2E_MAILPIT_URL. */
const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

export type Email = { subject: string; html: string; text: string };

type SearchResponse = { messages: { ID: string }[] };
type MessageResponse = { Subject: string; HTML: string; Text: string };

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(new URL(path, MAILPIT_URL));
  if (!response.ok) throw new Error(`Mailpit ${path} answered HTTP ${response.status}`);
  return (await response.json()) as T;
}

/** The newest email sent to `address`, waiting up to 15 seconds for it to arrive. */
export async function latestEmailTo(address: string): Promise<Email> {
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const query = new URLSearchParams({ query: `to:"${address}"`, limit: "1" });
        id = (await getJson<SearchResponse>(`/api/v1/search?${query}`)).messages[0]?.ID;
        return id;
      },
      { message: `an email to ${address} in Mailpit`, timeout: 15_000 },
    )
    .toBeTruthy();
  const message = await getJson<MessageResponse>(`/api/v1/message/${id}`);
  return { subject: message.Subject, html: message.HTML, text: message.Text };
}

/** The first link in an email's HTML, decoded from its href. */
export function firstLink(html: string): string {
  const href = /<a\s[^>]*href="([^"]+)"/.exec(html)?.[1];
  if (!href) throw new Error("the email has no link");
  return href.replaceAll("&amp;", "&");
}
