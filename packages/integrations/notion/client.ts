import { Client } from "@notionhq/client";
import { isNotionHeading, notionBlockText, notionBlockToMarkdown, notionPageTitle } from "./normalize.js";
import { markdownToNotionBlocks } from "./markdown.js";
import type { NotionBlockLike, NotionDocument, NotionDocumentSection, NotionPageSummary } from "./types.js";

const NOTION_VERSION = "2026-03-11";
type NormalizedNotionBlock = { block: NotionBlockLike; markdown: string; blockIds: string[] };
const UNSAFE_MARKDOWN_REPLACEMENT_BLOCKS = new Set([
  "child_page", "child_database", "image", "video", "audio", "file", "pdf",
  "table", "table_row", "synced_block", "column_list", "column", "link_to_page",
]);

export class NotionMarkdownWriteUnsupportedError extends Error {
  constructor(readonly blockTypes: string[]) {
    super(`This page contains Notion blocks that cannot be safely replaced from Markdown: ${blockTypes.join(", ")}`);
    this.name = "NotionMarkdownWriteUnsupportedError";
  }
}

export type NotionPageWriteStage = "insert" | "update" | "partial";

export class NotionPageWriteError extends Error {
  constructor(readonly stage: NotionPageWriteStage, readonly cause: unknown) {
    super(stage === "insert"
      ? "Notion did not allow MindBloom to insert page content"
      : stage === "update"
        ? "Notion did not allow MindBloom to replace the existing page content"
        : "Notion accepted new content, but the previous content could not be removed");
    this.name = "NotionPageWriteError";
  }
}

export function notionBlocksToSections(blocks: NormalizedNotionBlock[]): NotionDocumentSection[] {
  const sections: NotionDocumentSection[] = [];
  let current: NotionDocumentSection | null = null;
  for (const item of blocks) {
    if (isNotionHeading(item.block)) {
      if (current?.content.trim()) sections.push({ ...current, order: sections.length });
      current = { id: item.block.id, title: notionBlockText(item.block) || undefined, content: item.markdown, blockIds: item.blockIds, order: 0 };
      continue;
    }
    current ??= { id: `intro:${item.block.id}`, content: "", blockIds: [], order: 0 };
    current.content = [current.content, item.markdown].filter(Boolean).join("\n\n");
    current.blockIds.push(...item.blockIds);
  }
  if (current?.content.trim()) sections.push({ ...current, order: sections.length });
  return sections;
}

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
    const blockTree = await this.readChildren(pageId);
    return {
      id: String(page.id),
      title: notionPageTitle(page),
      url: String(page.url ?? ""),
      createdAt: String(page.created_time),
      updatedAt: String(page.last_edited_time),
      content: blockTree.content,
      sections: notionBlocksToSections(blockTree.blocks),
    };
  }

  async retrievePageSummary(pageId: string): Promise<NotionPageSummary> {
    const item = await this.client.pages.retrieve({ page_id: pageId });
    if (!("properties" in item)) throw new Error("Notion returned a partial page");
    const page = item as unknown as Record<string, unknown>;
    return {
      id: String(page.id),
      title: notionPageTitle(page),
      url: String(page.url ?? ""),
      createdAt: String(page.created_time),
      updatedAt: String(page.last_edited_time),
    };
  }

  async updatePageContent(pageId: string, markdown: string): Promise<void> {
    const existingBlockIds: string[] = [];
    const unsafeTypes = new Set<string>();
    let startCursor: string | undefined;
    do {
      const response = await this.client.blocks.children.list({ block_id: pageId, page_size: 100, start_cursor: startCursor });
      for (const item of response.results) {
        if (!("id" in item) || !("type" in item)) continue;
        existingBlockIds.push(item.id);
        await this.collectUnsafeBlockTypes(item as unknown as NotionBlockLike, unsafeTypes);
      }
      startCursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (startCursor);
    if (unsafeTypes.size) throw new NotionMarkdownWriteUnsupportedError([...unsafeTypes].sort());

    const blocks = markdownToNotionBlocks(markdown);
    const appendedBlockIds: string[] = [];
    try {
      for (let index = 0; index < blocks.length; index += 100) {
        const response = await this.client.blocks.children.append({ block_id: pageId, children: blocks.slice(index, index + 100) });
        appendedBlockIds.push(...response.results.flatMap((item) => "id" in item ? [item.id] : []));
      }
    } catch (error) {
      let rollbackFailed = false;
      for (const blockId of appendedBlockIds) {
        try { await this.client.blocks.update({ block_id: blockId, archived: true }); }
        catch { rollbackFailed = true; }
      }
      throw new NotionPageWriteError(rollbackFailed ? "partial" : "insert", error);
    }
    const archivedOldBlockIds: string[] = [];
    try {
      for (const blockId of existingBlockIds) {
        await this.client.blocks.update({ block_id: blockId, archived: true });
        archivedOldBlockIds.push(blockId);
      }
    } catch (error) {
      let rollbackFailed = false;
      for (const blockId of appendedBlockIds) {
        try { await this.client.blocks.update({ block_id: blockId, archived: true }); }
        catch { rollbackFailed = true; }
      }
      for (const blockId of archivedOldBlockIds) {
        try { await this.client.blocks.update({ block_id: blockId, archived: false }); }
        catch { rollbackFailed = true; }
      }
      throw new NotionPageWriteError(rollbackFailed ? "partial" : "update", error);
    }
  }

  private async collectUnsafeBlockTypes(block: NotionBlockLike, output: Set<string>): Promise<void> {
    if (UNSAFE_MARKDOWN_REPLACEMENT_BLOCKS.has(block.type)) {
      output.add(block.type);
      return;
    }
    if (!block.has_children) return;
    let startCursor: string | undefined;
    do {
      const response = await this.client.blocks.children.list({ block_id: block.id, page_size: 100, start_cursor: startCursor });
      for (const child of response.results) {
        if ("type" in child) await this.collectUnsafeBlockTypes(child as unknown as NotionBlockLike, output);
      }
      startCursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (startCursor);
  }

  private async readChildren(blockId: string): Promise<{ content: string; blocks: NormalizedNotionBlock[] }> {
    const output: string[] = [];
    const blocks: NormalizedNotionBlock[] = [];
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
        const children = block.has_children ? await this.readChildren(block.id) : { content: "", blocks: [] };
        const markdown = notionBlockToMarkdown(block, children.content);
        const blockIds = [block.id, ...children.blocks.flatMap((child) => child.blockIds)];
        if (markdown.trim()) {
          output.push(markdown);
          blocks.push({ block, markdown, blockIds });
        }
      }
      startCursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (startCursor);
    return { content: output.join("\n\n").trim(), blocks };
  }

}
