import type { NotionBlockLike, NotionRichText } from "./types.js";

function richText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map((item) => (item as NotionRichText).plain_text ?? "").join("");
}

function blockPayload(block: NotionBlockLike): Record<string, unknown> {
  const value = block[block.type];
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function notionBlockToMarkdown(block: NotionBlockLike, children = ""): string {
  const payload = blockPayload(block);
  const text = richText(payload.rich_text);
  let line = "";
  switch (block.type) {
    case "paragraph": line = text; break;
    case "heading_1": line = `# ${text}`; break;
    case "heading_2": line = `## ${text}`; break;
    case "heading_3": line = `### ${text}`; break;
    case "bulleted_list_item": line = `- ${text}`; break;
    case "numbered_list_item": line = `1. ${text}`; break;
    case "to_do": line = `- [${payload.checked ? "x" : " "}] ${text}`; break;
    case "toggle": line = text; break;
    case "quote": line = `> ${text}`; break;
    case "callout": line = `> ${text}`; break;
    case "code": line = `\`\`\`${String(payload.language ?? "")}\n${text}\n\`\`\``; break;
    case "divider": line = "---"; break;
    case "bookmark":
    case "embed":
    case "link_preview": line = String(payload.url ?? ""); break;
    case "child_page": line = `## ${String(payload.title ?? "Untitled")}`; break;
    case "child_database": line = `## ${String(payload.title ?? "Untitled database")}`; break;
    default: line = text;
  }
  return [line, children].filter((part) => part.trim()).join("\n");
}

export function notionPageTitle(page: Record<string, unknown>): string {
  const properties = page.properties as Record<string, Record<string, unknown>> | undefined;
  for (const property of Object.values(properties ?? {})) {
    if (property.type === "title") {
      return richText(property.title).trim() || "Untitled";
    }
  }
  return "Untitled";
}
