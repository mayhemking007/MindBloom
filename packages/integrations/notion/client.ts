import { Client } from "@notionhq/client";
import { notionBlockToMarkdown, notionPageTitle } from "./normalize.js";
import type { NotionBlockLike, NotionDocument, NotionPageSummary } from "./types.js";

const NOTION_VERSION = "2026-03-11";

export class NotionIntegration {
  private readonly client: Client;

  constructor(token: string) {
    this.client = new Client({ auth: token, notionVersion: NOTION_VERSION });
  }

  async listAccessiblePages(): Promise<NotionPageSummary[]> {
    const pages: NotionPageSummary[] = [];
    let startCursor: string | undefined;
    do {
      const response = await this.client.search({
        filter: { property: "object", value: "page" },
        page_size: 100,
        start_cursor: startCursor,
        sort: { direction: "descending", timestamp: "last_edited_time" },
      });
      for (const item of response.results) {
        if (!("properties" in item)) continue;
        const page = item as unknown as Record<string, unknown>;
        pages.push({
          id: String(page.id),
          title: notionPageTitle(page),
          url: String(page.url ?? ""),
          createdAt: String(page.created_time),
          updatedAt: String(page.last_edited_time),
        });
      }
      startCursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (startCursor);
    return pages;
  }

  async retrievePage(pageId: string): Promise<NotionDocument> {
    const item = await this.client.pages.retrieve({ page_id: pageId });
    if (!("properties" in item)) throw new Error("Notion returned a partial page");
    const page = item as unknown as Record<string, unknown>;
    return {
      id: String(page.id),
      title: notionPageTitle(page),
      url: String(page.url ?? ""),
      createdAt: String(page.created_time),
      updatedAt: String(page.last_edited_time),
      content: await this.readChildren(pageId),
    };
  }

  private async readChildren(blockId: string): Promise<string> {
    const output: string[] = [];
    let startCursor: string | undefined;
    do {
      const response = await this.client.blocks.children.list({
        block_id: blockId,
        page_size: 100,
        start_cursor: startCursor,
      });
      for (const item of response.results) {
        if (!("type" in item)) continue;
        const block = item as unknown as NotionBlockLike;
        const children = block.has_children ? await this.readChildren(block.id) : "";
        const markdown = notionBlockToMarkdown(block, children);
        if (markdown.trim()) output.push(markdown);
      }
      startCursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (startCursor);
    return output.join("\n\n").trim();
  }
}
