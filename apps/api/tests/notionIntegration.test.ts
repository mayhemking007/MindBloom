import { describe, expect, it } from "vitest";
import { notionBlockToMarkdown, notionPageTitle } from "@mindbloom/integrations";

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
});
