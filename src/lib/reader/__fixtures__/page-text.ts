import type { PageBlock, PageBody, PageInline } from "@/contracts";

// Test helpers for finding a page's text in rendered HTML.

function inlineText(content: readonly PageInline[] = []): string {
  return content.map((node) => (node.type === "text" ? node.text : "\n")).join("");
}

function blockTexts(block: PageBlock): string[] {
  switch (block.type) {
    case "image":
      return [];
    case "blockquote":
      return block.content.flatMap(blockTexts);
    default:
      return [inlineText(block.content)];
  }
}

/** The body's text without formatting: blocks separated by a blank line, line breaks kept. */
export function pageBodyPlainText(body: PageBody): string {
  return body.content.flatMap(blockTexts).join("\n\n");
}

/** Runs of text long enough not to match by accident, each as it appears between tags. */
export function pageBodyTextRuns(body: PageBody): string[] {
  const runs = (block: PageBlock): string[] => {
    if (block.type === "image") return [];
    if (block.type === "blockquote") return block.content.flatMap(runs);
    return (block.content ?? []).flatMap((node) =>
      node.type === "text" && node.text.trim().length >= 5 ? [node.text] : [],
    );
  };
  return body.content.flatMap(runs);
}
