/** The writing dashboard. */
export const WRITE_PATH = "/write";

/** Where a page opens in the editor. */
export function editorPath(pageId: string): string {
  return `${WRITE_PATH}/pages/${encodeURIComponent(pageId)}`;
}
