import { describe, expect, it } from "vitest";
import { markdownInlineToNotionRichText, markdownToNotionBlocks, notionBlockToMarkdown, notionPageTitle } from "@mindbloom/integrations";

describe("Notion normalization", () => {
  it("preserves nested checklist content as readable markdown", () => {
    expect(notionBlockToMarkdown({
      id: "block-1", type: "to_do", to_do: { checked: true, rich_text: [{ plain_text: "Ship MVP" }] },
    }, "A nested explanation")).toBe("- [x] Ship MVP\nA nested explanation");
  });

  it("finds the title property without assuming its name", () => {
    expect(notionPageTitle({ properties: {
      Name: { type: "title", title: [{ plain_text: "MindBloom notes" }] },
    } })).toBe("MindBloom notes");
  });

  it("preserves Notion rich-text annotations as Markdown", () => {
    expect(notionBlockToMarkdown({ id: "p1", type: "paragraph", paragraph: { rich_text: [
      { plain_text: "A " },
      { plain_text: "strong", annotations: { bold: true } },
      { plain_text: " link", href: "https://example.com" },
    ] } })).toBe("A **strong**[ link](https://example.com)");
  });

  it("converts editable markdown to supported Notion blocks", () => {
    const blocks = markdownToNotionBlocks("# Ideas\n\nA **strong** connection\n\n- [x] Test it\n\n```ts\nconst bloom = true;\n```");
    expect(blocks.map((block) => block.type)).toEqual(["heading_1", "paragraph", "to_do", "code"]);
    expect(blocks[2]).toMatchObject({ type: "to_do", to_do: { checked: true } });
  });

  it("maps common inline markdown to Notion annotations and links", () => {
    expect(markdownInlineToNotionRichText("Use **context** with [MindBloom](https://example.com)")).toEqual([
      { type: "text", text: { content: "Use " } },
      { type: "text", text: { content: "context" }, annotations: { bold: true } },
      { type: "text", text: { content: " with " } },
      { type: "text", text: { content: "MindBloom", link: { url: "https://example.com" } } },
    ]);
  });
});
