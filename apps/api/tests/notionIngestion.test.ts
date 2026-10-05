import { describe, expect, it } from "vitest";
import type { NotionDocument } from "@mindbloom/integrations";
import { notionBlocksToSections } from "@mindbloom/integrations";
import { markdownToDocumentSections, NOTION_INGESTION_TIMEOUT_MS, notionIngestionOptions, notionIngestionOptionsFor, toMemoGrafterDocument } from "../src/services/notionIngestion.js";

describe("Notion structured ingestion", () => {
  it("groups top-level blocks into heading-based sections and keeps nested block ids", () => {
    const sections = notionBlocksToSections([
      { block: { id: "intro", type: "paragraph", paragraph: { rich_text: [{ plain_text: "Opening" }] } }, markdown: "Opening", blockIds: ["intro"] },
      { block: { id: "h1", type: "heading_1", heading_1: { rich_text: [{ plain_text: "Ideas" }] } }, markdown: "# Ideas", blockIds: ["h1"] },
      { block: { id: "toggle", type: "toggle", toggle: { rich_text: [{ plain_text: "Details" }] } }, markdown: "Details\n- Nested", blockIds: ["toggle", "nested"] },
      { block: { id: "h2", type: "heading_2", heading_2: { rich_text: [{ plain_text: "Next" }] } }, markdown: "## Next", blockIds: ["h2"] },
    ]);

    expect(sections).toHaveLength(3);
    expect(sections.map((section) => section.title)).toEqual([undefined, "Ideas", "Next"]);
    expect(sections[1]?.blockIds).toEqual(["h1", "toggle", "nested"]);
    expect(sections.map((section) => section.order)).toEqual([0, 1, 2]);
  });

  it("maps Notion sections to MemoGrafter source-aware document input", () => {
    const page: NotionDocument = {
      id: "page-1", title: "Product ideas", url: "https://notion.so/page-1",
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
      content: "# Themes\nContextual suggestions",
      sections: [{ id: "heading-1", title: "Themes", content: "# Themes\nContextual suggestions", blockIds: ["heading-1", "paragraph-1"], order: 0 }],
    };

    expect(toMemoGrafterDocument(page)).toEqual(expect.objectContaining({
      id: "page-1",
      sections: [expect.objectContaining({ id: "heading-1", metadata: { blockIds: ["heading-1", "paragraph-1"], order: 0 } })],
    }));
  });

  it("caps expensive work and memory volume", () => {
    expect(notionIngestionOptions.chunking).toMatchObject({ maxChunks: 8, maxCharacters: 3_000 });
    expect(notionIngestionOptions.segmentation).toMatchObject({ maxTopics: 6 });
    expect(notionIngestionOptions.memoryBudget).toMatchObject({ maxPerSegment: 4, maxPerDocument: 12, deduplicate: true });
    expect(notionIngestionOptions.qualityPolicy).toMatchObject({ mode: "enforce", minExplicitness: 0.65 });
    expect(NOTION_INGESTION_TIMEOUT_MS).toBe(120_000);
  });

  it("uses heading-aligned topics for a structured page and smaller drift chunks otherwise", () => {
    const base: NotionDocument = {
      id: "page", title: "Notes", url: "https://notion.so/page", createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z", content: "", sections: [],
    };
    const structured = { ...base, sections: [
      { id: "a", title: "A", content: "A".repeat(100), blockIds: [], order: 0 },
      { id: "b", title: "B", content: "B".repeat(100), blockIds: [], order: 1 },
    ] };
    expect(notionIngestionOptionsFor(structured)).toMatchObject({
      chunking: { strategy: "section", targetCharacters: 1_000, maxChunks: 6 },
      segmentation: { strategy: "per-chunk", maxTopics: 6 },
    });
    expect(notionIngestionOptionsFor(base)).toMatchObject({
      chunking: { strategy: "paragraph", targetCharacters: 1_000 },
      segmentation: { strategy: "drift", minChunks: 1 },
    });
  });

  it("reconstructs editable Markdown sections without treating fenced headings as structure", () => {
    const sections = markdownToDocumentSections("Intro\n\n# Ideas\nText\n\n```md\n# Not a section\n```\n\n## Next\nMore");
    expect(sections.map((section) => section.title)).toEqual([undefined, "Ideas", "Next"]);
    expect(sections[1]?.content).toContain("# Not a section");
  });
});
